import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { Attachment } from '../common/file-storage/entities/attachment.entity';
import * as fs from 'fs-extra';
import * as path from 'path';

async function migrateStorage() {
  // Config override for script execution if needed
  const config = { ...databaseConfig, entities: [Attachment] };
  const dataSource = new DataSource(
    config as import('typeorm').DataSourceOptions
  );
  await dataSource.initialize();

  try {
    const attachmentRepo = dataSource.getRepository(Attachment);

    // Find all permanent attachments
    const attachments = await attachmentRepo.find({
      where: { isTemporary: false },
    });

    let _movedCount = 0;
    let _errorCount = 0;
    let _skippedCount = 0;

    // Define base permanent directory
    // Note: Adjust path based on execution context (e.g., from backend root)
    const permanentBaseDir =
      process.env.UPLOAD_PERMANENT_DIR ||
      path.join(process.cwd(), 'uploads', 'permanent');

    if (!fs.existsSync(permanentBaseDir)) {
      //       console.warn(
      //         `Base directory not found: ${permanentBaseDir}. Creating it...`
      //       );
      await fs.ensureDir(permanentBaseDir);
    }

    for (const att of attachments) {
      if (!att.filePath) {
        _skippedCount++;
        continue;
      }

      const currentPath = att.filePath;
      if (!fs.existsSync(currentPath)) {
        _errorCount++;
        continue;
      }

      // Check if already in new structure (contains /General/YYYY/MM or similar)
      const newStructureRegex =
        /permanent[/\\](ContractDrawing|ShopDrawing|AsBuiltDrawing|General)[/\\]\d{4}[/\\]\d{2}/;
      if (newStructureRegex.test(currentPath)) {
        _skippedCount++;
        continue;
      }

      // Determine target date
      const refDate = att.referenceDate
        ? new Date(att.referenceDate)
        : new Date(att.createdAt);
      if (isNaN(refDate.getTime())) {
        _errorCount++;
        continue;
      }

      const year = refDate.getFullYear().toString();
      const month = (refDate.getMonth() + 1).toString().padStart(2, '0');

      // Determine Doc Type (Default 'General' as we don't know easily without joins)
      const docType = 'General';

      const newDir = path.join(permanentBaseDir, docType, year, month);
      const newPath = path.join(newDir, att.storedFilename);

      if (path.resolve(currentPath) === path.resolve(newPath)) {
        _skippedCount++;
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
        _movedCount++;
      } catch (_err: unknown) {
        _errorCount++;
      }
    }
  } catch (_error) {
    // Ignore error as logs are removed
  } finally {
    await dataSource.destroy();
  }
}

void migrateStorage();
