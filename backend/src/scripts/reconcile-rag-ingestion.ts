// File: backend/src/scripts/reconcile-rag-ingestion.ts
// Change Log:
// - 2026-09-22: สร้าง reconcile script สำหรับ attachments ที่ค้าง NOT_STARTED
//   ถาวร — commitRecord เคยใช้ deprecated rag-prepare (processor skip) ทำให้
//   queue commits ไม่เคยสร้าง generation; script นี้ compute checksum →
//   ingest() → enqueue ai-rag-ingest ตาม D344 canonical path

/* eslint-disable no-console, @typescript-eslint/no-floating-promises */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { RagAttachmentIngestionService } from '../modules/ai/services/rag-attachment-ingestion.service';
import { AiQueueService } from '../modules/ai/ai-queue.service';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';

interface StuckAttachmentRow {
  publicId: string;
  filePath: string | null;
  checksum: string | null;
}

function parseArgs(): {
  dryRun: boolean;
  limit: number;
  pathMaps: Array<[string, string]>;
} {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit:
      Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 500,
    // รันจาก host ที่ mount path ต่างจาก container — เช่น
    // --path-map=/mnt/legacy-staging=/mnt/asustor-legacy
    // --path-map=/app/uploads/permanent=/mnt/asustor-uploads/permanent
    pathMaps: args
      .filter((a) => a.startsWith('--path-map='))
      .map((a) => a.slice('--path-map='.length).split('=') as [string, string])
      .filter((m) => m.length === 2 && m[0] && m[1]),
  };
}

/** แปลง container path → host path ตาม --path-map (ใช้เฉพาะตอนอ่านไฟล์จาก disk) */
function resolveFsPath(
  filePath: string,
  pathMaps: Array<[string, string]>
): string {
  for (const [from, to] of pathMaps) {
    if (filePath.startsWith(from)) {
      return to + filePath.slice(from.length);
    }
  }
  return filePath;
}

async function computeFileChecksum(filePath: string): Promise<string | null> {
  try {
    if (!existsSync(filePath)) return null;
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

async function bootstrap() {
  const { dryRun, limit, pathMaps } = parseArgs();

  console.log(`
========================================================================
📌 LCBP3-DMS: RAG NOT_STARTED Reconcile (generation-aware, D344)
========================================================================
Mode: ${dryRun ? 'DRY-RUN (list only)' : 'LIVE'} | Limit: ${limit}
${pathMaps.length ? `Path maps: ${pathMaps.map((m) => `${m[0]}→${m[1]}`).join(', ')}` : ''}
`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const dataSource = app.get(DataSource);
  const ingestionService = app.get(RagAttachmentIngestionService);
  const aiQueueService = app.get(AiQueueService);

  // attachments ที่ linked กับเอกสารจริง + มี ocr_text + ไม่มี generation เลย
  // (เงื่อนไขเดียวกับ RAG Admin dashboard NOT_STARTED — Q9)
  const rows = await dataSource.query<StuckAttachmentRow[]>(
    `SELECT a.uuid AS publicId, a.file_path AS filePath, a.CHECKSUM AS checksum
     FROM attachments a
     WHERE (
       EXISTS (SELECT 1 FROM correspondence_revision_attachments l1 WHERE l1.attachment_id = a.id)
       OR EXISTS (SELECT 1 FROM shop_drawing_revision_attachments l2 WHERE l2.attachment_id = a.id)
       OR EXISTS (SELECT 1 FROM contract_drawing_attachments l3 WHERE l3.attachment_id = a.id)
       OR EXISTS (SELECT 1 FROM circulation_attachments l4 WHERE l4.attachment_id = a.id)
       OR EXISTS (SELECT 1 FROM asbuilt_drawing_revision_attachments l5 WHERE l5.attachment_id = a.id)
     )
     AND NOT EXISTS (
       SELECT 1 FROM rag_attachment_generations g WHERE g.attachment_uuid = a.uuid
     )
     AND a.is_temporary = 0
     AND a.ocr_text IS NOT NULL AND CHAR_LENGTH(a.ocr_text) > 0
     ORDER BY a.created_at
     LIMIT ?`,
    [limit]
  );

  console.log(`🔍 พบ ${rows.length} attachments ที่ค้าง NOT_STARTED\n`);
  if (rows.length === 0) {
    await app.close();
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      let checksum = row.checksum;
      if (!checksum && row.filePath) {
        checksum = await computeFileChecksum(
          resolveFsPath(row.filePath, pathMaps)
        );
        if (checksum && !dryRun) {
          await dataSource.query(
            `UPDATE attachments SET CHECKSUM = ?, rag_status = 'PROCESSING' WHERE uuid = ?`,
            [checksum, row.publicId]
          );
        }
      }
      if (!checksum) {
        console.log(
          `⏭️  ${row.publicId} — ไม่มี checksum และไฟล์หาไม่เจอ (${row.filePath ?? 'null'})`
        );
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(
          `[dry-run] ${row.publicId} — checksum=${checksum.slice(0, 12)}…`
        );
        ok += 1;
        continue;
      }
      const generation = await ingestionService.ingest(row.publicId);
      const jobId = await aiQueueService.enqueueRagAttachmentIngestion({
        attachmentPublicId: row.publicId,
        attachmentChecksum: generation.attachmentChecksumSnapshot,
        force: false,
      });
      console.log(
        `✅ ${row.publicId} — generation=${generation.generationUuid} job=${jobId}`
      );
      ok += 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${row.publicId} — ${msg}`);
      failed += 1;
    }
  }

  console.log(`
========================================================================
สรุป: ok=${ok} skipped=${skipped} failed=${failed} (total=${rows.length})
========================================================================
`);
  await app.close();
}

bootstrap();
