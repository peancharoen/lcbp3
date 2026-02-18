import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { Attachment } from '../common/file-storage/entities/attachment.entity';
import * as fs from 'fs-extra';
import * as path from 'path';

async function migrateStorage() {
  // Config override for script execution if needed
  const config = { ...databaseConfig, entities: [Attachment] };
  const dataSource = new DataSource(config as any);
  await dataSource.initialize();

  try {
    console.log('🚀 Starting Storage Migration v2...');
    const attachmentRepo = dataSource.getRepository(Attachment);

    // Find all permanent attachments
    const attachments = await attachmentRepo.find({
      where: { isTemporary: false },
    });
    console.log(`Found ${attachments.length} permanent attachments.`);

    let movedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Define base permanent directory
    // Note: Adjust path based on execution context (e.g., from backend root)
    const permanentBaseDir =
      process.env.UPLOAD_PERMANENT_DIR ||
      path.join(process.cwd(), 'uploads', 'permanent');

    console.log(`Target Permanent Directory: ${permanentBaseDir}`);

    if (!fs.existsSync(permanentBaseDir)) {
      console.warn(
        `Base directory not found: ${permanentBaseDir}. Creating it...`
      );
      await fs.ensureDir(permanentBaseDir);
    }

    for (const att of attachments) {
      if (!att.filePath) {
        skippedCount++;
        continue;
      }

      const currentPath = att.filePath;
      if (!fs.existsSync(currentPath)) {
        console.warn(`File not found on disk: ${currentPath} (ID: ${att.id})`);
        errorCount++;
        continue;
      }

      // Check if already in new structure (contains /General/YYYY/MM or similar)
      const newStructureRegex =
        /permanent[\/\\](ContractDrawing|ShopDrawing|AsBuiltDrawing|General)[\/\\]\d{4}[\/\\]\d{2}/;
      if (newStructureRegex.test(currentPath)) {
        skippedCount++;
        continue;
      }

      // Determine target date
      const refDate = att.referenceDate
        ? new Date(att.referenceDate)
        : new Date(att.createdAt);
      if (isNaN(refDate.getTime())) {
        console.warn(`Invalid date for ID ${att.id}, skipping.`);
        errorCount++;
        continue;
      }

      const year = refDate.getFullYear().toString();
      const month = (refDate.getMonth() + 1).toString().padStart(2, '0');

      // Determine Doc Type (Default 'General' as we don't know easily without joins)
      const docType = 'General';

      const newDir = path.join(permanentBaseDir, docType, year, month);
      const newPath = path.join(newDir, att.storedFilename);

      if (path.resolve(currentPath) === path.resolve(newPath)) {
        skippedCount++;
        continue;
      }

      try {
        await fs.ensureDir(newDir);
        await fs.move(currentPath, newPath, { overwrite: true });

        // Update DB
        att.filePath = newPath;
        if (!att.referenceDate) {
          att.referenceDate = refDate;
        }
        await attachmentRepo.save(att);
        movedCount++;
        if (movedCount % 100 === 0) console.log(`Moved ${movedCount} files...`);
      } catch (err: unknown) {
        console.error(
          `Failed to move file ID ${att.id}:`,
          (err as Error).message
        );
        errorCount++;
      }
    }

    console.log(`Migration completed.`);
    console.log(`Moved: ${movedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

migrateStorage();
