// File: backend/src/scripts/legacy-ingest.ts
// Change Log:
// - 2026-08-20: สร้าง CLI Command Script สำหรับรัน Streaming Ingestion บน Server โดยตรง (ADR-047)

/* eslint-disable no-console, @typescript-eslint/no-floating-promises */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LegacyIngestionService } from '../modules/migration/services/legacy-ingestion.service';
import { Project } from '../modules/project/entities/project.entity';
import { DataSource } from 'typeorm';

function parseArgs(): Record<string, string | boolean> {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const equalIndex = arg.indexOf('=');
      if (equalIndex > -1) {
        const key = arg.slice(2, equalIndex);
        const value = arg.slice(equalIndex + 1);
        parsed[key] = value;
      } else {
        const key = arg.slice(2);
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

async function bootstrap() {
  const args = parseArgs();
  const filePath = (args.file as string) || (args.f as string);
  const projectInput = (args.project as string) || (args.p as string);
  const contractCode = args.contract as string | undefined;
  const sheetName = args.sheet as string | undefined;
  const pdfFolderPath =
    (args.staging as string) || (args.pdf as string) || undefined;
  const batchId = args.batch as string | undefined;
  const resume = Boolean(args.resume);

  if (!filePath || !projectInput) {
    console.log(`
========================================================================
📌 LCBP3-DMS: Legacy Documents Streaming Ingestion CLI (ADR-047)
========================================================================
Usage:
  pnpm run migration:ingest --file=<path-to-excel> --project=<project-uuid-or-code> [options]

Options:
  --file, -f       Path to Excel file (.xlsx) (Required)
  --project, -p    Target Project PublicId or Project Code (Required)
  --contract       Target Contract Code (Optional, e.g. LCBP3-C2)
  --sheet          Worksheet Name (Optional, default: first sheet)
  --staging, --pdf Directory path where legacy PDF files are stored (Optional)
  --batch          Custom Batch ID (Optional)
  --resume         Resume from last saved checkpoint (Optional flag)

Example:
  pnpm run migration:ingest --file=/share/np-dms/staging_ai/C22024.xlsx --project=LCBP3-C2 --resume
========================================================================
`);
    process.exit(1);
  }

  console.log(`🚀 กำลังเริ่มต้นระบบ Ingestion Context...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ingestionService = app.get(LegacyIngestionService);
  const dataSource = app.get(DataSource);

  // ตรวจสอบหรือ Resolve Project UUIDv7
  const projectRepo = dataSource.getRepository(Project);
  const project = await projectRepo.findOne({
    where: [{ publicId: projectInput }, { projectCode: projectInput }],
  });

  if (!project) {
    console.error(`❌ ไม่พบโครงการในระบบ: ${projectInput}`);
    await app.close();
    process.exit(1);
  }

  console.log(
    `✅ เชื่อมต่อโครงการ: [${project.projectCode}] (${project.projectName})`
  );
  console.log(`📂 ไฟล์ Excel: ${filePath}`);
  if (pdfFolderPath) console.log(`📁 โฟลเดอร์ PDF Staging: ${pdfFolderPath}`);
  if (sheetName) console.log(`📑 Worksheet: ${sheetName}`);
  if (resume) console.log(`🔄 โหมด Resume: เปิดใช้งาน`);

  const startTime = Date.now();
  let lastReportTime = Date.now();

  try {
    const summary = await ingestionService.startIngestion(
      {
        filePath,
        projectPublicId: project.publicId,
        contractCode,
        sheetName,
        pdfFolderPath,
        batchId,
        resume,
      },
      (progress) => {
        const now = Date.now();
        if (now - lastReportTime >= 500) {
          process.stdout.write(
            `\r📊 ความคืบหน้า: อ่านแล้ว ${progress.processed} แถว | เข้าคิว: ${progress.enqueued} | ข้าม: ${progress.skipped} | ผิดพลาด: ${progress.errors} [ล่าสุด: ${progress.currentDocumentNumber || '-'}]`
          );
          lastReportTime = now;
        }
      }
    );

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `\n\n========================================================================`
    );
    console.log(`🎉 Ingestion เสร็จสมบูรณ์! (ใช้เวลา ${elapsedSec} วินาที)`);
    console.log(
      `========================================================================`
    );
    console.log(`- Batch ID:             ${summary.batchId}`);
    console.log(`- จำนวนแถวทั้งหมด:      ${summary.totalRowsProcessed}`);
    console.log(`- นำเข้า Staging Queue: ${summary.enqueuedCount} รายการ`);
    console.log(`- ข้าม (Skipped):       ${summary.skippedCount} รายการ`);
    console.log(`- ข้อผิดพลาด (Errors):  ${summary.errorCount} รายการ`);
    console.log(`- Checkpoint ล่าสุด:    แถวที่ ${summary.lastProcessedIndex}`);
    console.log(
      `========================================================================\n`
    );
  } catch (error: unknown) {
    console.error(`\n❌ เกิดข้อผิดพลาดระหว่าง Ingestion:`, error);
  } finally {
    await app.close();
  }
}

bootstrap();
