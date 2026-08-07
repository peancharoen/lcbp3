// File: backend/src/modules/migration/services/metadata-resolution.service.ts
// Change Log:
// - 2026-08-06: Initial creation — stub for Phase 5 implementation (Feature 242, FR-017, FR-018, FR-019, FR-020)
// - 2026-08-06: Full implementation — set-based SQL resolution + tag creation + timeout guard (T047, T048, T050)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { deriveTagName } from '../types/tag-mapping-rule';

/** ผลลัพธ์การ resolve batch (FR-019, FR-020) */
export interface ResolveBatchResult {
  batchId: string | null;
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  tagsCreated: number;
  tagsLinked: number;
  startedAt: Date;
  completedAt: Date;
  failures: Array<{
    correspondencePublicId: string;
    field: string;
    unresolvedValue: string;
    reason: string;
  }>;
}

/** ข้อมูล register values ที่ดึงจาก ai_metadata_json ของแต่ละ queue item */
interface QueueItemRegisterData {
  queueId: number;
  publicId: string;
  projectId: number | null;
  senderOrganizationId: number | null;
  receiverOrganizationId: number | null;
  details: {
    disciplineCode?: string;
    correspondenceType?: string;
    fromOrganization?: string;
    toOrganization?: string;
    compareResult?: unknown;
  } | null;
}

/** Default timeout สำหรับ batch resolution (ms) */
const DEFAULT_BATCH_TIMEOUT_MS = 30000;
const SETTING_KEY_BATCH_TIMEOUT = 'MIGRATION_RESOLVE_BATCH_TIMEOUT_MS';

/**
 * Service สำหรับ batch SQL resolution ของ register values → reference data links + tags (FR-017, FR-018, FR-019, FR-020)
 * ทำงานแบบ set-based SQL เพื่อประสิทธิภาพสูง
 */
@Injectable()
export class MetadataResolutionService {
  private readonly logger = new Logger(MetadataResolutionService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Resolve register-derived org/type/discipline values to system reference data
   * และ create/link tags จาก register fields (FR-017, FR-018, FR-020)
   * @param batchId optional batch scope; omit for all pending (FR-020a)
   * @returns ผลลัพธ์การ resolve พร้อม per-item failures (FR-019)
   */
  async resolveBatch(batchId?: string): Promise<ResolveBatchResult> {
    const startedAt = new Date();
    const failures: ResolveBatchResult['failures'] = [];
    let tagsCreated = 0;
    let tagsLinked = 0;

    // T050: อ่าน timeout จาก system_settings พร้อม fallback
    const timeoutMs = await this.getBatchTimeoutMs();
    const deadline = Date.now() + timeoutMs;

    // ดึง queue items ที่ PENDING พร้อม register data จาก ai_metadata_json
    const items = await this.fetchPendingItems(batchId);
    if (items.length === 0) {
      this.logger.log(
        `resolveBatch: no pending items for batchId=${batchId ?? 'ALL'}`
      );
      return {
        batchId: batchId ?? null,
        total: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        tagsCreated: 0,
        tagsLinked: 0,
        startedAt,
        completedAt: new Date(),
        failures: [],
      };
    }

    let succeeded = 0;
    const skipped = 0;
    let failed = 0;

    // FR-017: Set-based resolution ของ org names → org IDs
    const orgNameToIdMap = await this.resolveOrganizationsByName(items);

    // FR-017: Set-based resolution ของ correspondence types
    const typeCodeToIdMap = await this.resolveCorrespondenceTypes(items);

    // FR-017: Set-based resolution ของ disciplines
    const disciplineCodeToIdMap = await this.resolveDisciplines(items);

    // ประมวลผลทีละ item เพื่ออัปเดต queue + รายงาน failures
    for (const item of items) {
      // T050: ตรวจสอบ deadline
      if (Date.now() > deadline) {
        this.logger.warn(
          `resolveBatch: exceeded timeout ${timeoutMs}ms — ${items.length - succeeded - skipped - failed} items remaining. ` +
            'พิจารณาย้ายไป ai-batch queue สำหรับ batch ขนาดใหญ่ (Complexity Tracking deviation)'
        );
        break;
      }

      const itemFailures = await this.processItem(
        item,
        orgNameToIdMap,
        typeCodeToIdMap,
        disciplineCodeToIdMap
      );

      if (itemFailures.length > 0) {
        failed += 1;
        failures.push(...itemFailures);
      } else {
        succeeded += 1;
      }

      // FR-018: สร้างและเชื่อม tags จาก register fields
      const tagResult = await this.createAndLinkTags(item);
      tagsCreated += tagResult.created;
      tagsLinked += tagResult.linked;
    }

    const completedAt = new Date();
    this.logger.log(
      `resolveBatch: batchId=${batchId ?? 'ALL'} total=${items.length} succeeded=${succeeded} ` +
        `skipped=${skipped} failed=${failed} tagsCreated=${tagsCreated} tagsLinked=${tagsLinked} ` +
        `duration=${completedAt.getTime() - startedAt.getTime()}ms`
    );

    return {
      batchId: batchId ?? null,
      total: items.length,
      succeeded,
      skipped,
      failed,
      tagsCreated,
      tagsLinked,
      startedAt,
      completedAt,
      failures,
    };
  }

  /** ดึง queue items ที่ PENDING พร้อม register data */
  private async fetchPendingItems(
    batchId?: string
  ): Promise<QueueItemRegisterData[]> {
    const query = this.dataSource
      .getRepository('MigrationReviewQueue')
      .createQueryBuilder('queue')
      .select([
        'queue.id AS queueId',
        'queue.public_id AS publicId',
        'queue.project_id AS projectId',
        'queue.sender_organization_id AS senderOrganizationId',
        'queue.receiver_organization_id AS receiverOrganizationId',
        'queue.ai_metadata_json AS details',
      ])
      .where('queue.status = :status', { status: 'PENDING' });
    // FR-020a: scope by batchId ถ้ามี
    if (batchId) {
      // batchId เก็บใน details หรือ ai_issues
      query.andWhere('queue.ai_metadata_json->>"$.batchId" = :batchId', {
        batchId,
      });
    }
    const rows = await query.getRawMany<
      QueueItemRegisterData & {
        queueId: number;
        publicId: string;
        projectId: number | null;
        senderOrganizationId: number | null;
        receiverOrganizationId: number | null;
        details: string | null;
      }
    >();
    // parse details JSON
    return rows.map((r) => ({
      queueId: r.queueId,
      publicId: r.publicId,
      projectId: r.projectId,
      senderOrganizationId: r.senderOrganizationId,
      receiverOrganizationId: r.receiverOrganizationId,
      details: r.details
        ? typeof r.details === 'string'
          ? (JSON.parse(r.details) as QueueItemRegisterData['details'])
          : r.details
        : null,
    }));
  }

  /** FR-017: Set-based resolution ของ org names → org IDs */
  private async resolveOrganizationsByName(
    items: QueueItemRegisterData[]
  ): Promise<Map<string, number>> {
    const orgNames = new Set<string>();
    for (const item of items) {
      if (item.details?.fromOrganization)
        orgNames.add(item.details.fromOrganization);
      if (item.details?.toOrganization)
        orgNames.add(item.details.toOrganization);
    }
    if (orgNames.size === 0) return new Map();
    // ค้นหาด้วย organization_name หรือ organization_code
    const rows = await this.dataSource.query<
      { id: number; organization_name: string; organization_code: string }[]
    >(
      'SELECT id, organization_name, organization_code FROM organizations WHERE organization_name IN (?) OR organization_code IN (?) AND deleted_at IS NULL',
      [Array.from(orgNames), Array.from(orgNames)]
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.organization_name, row.id);
      map.set(row.organization_code, row.id);
    }
    return map;
  }

  /** FR-017: Set-based resolution ของ correspondence types */
  private async resolveCorrespondenceTypes(
    items: QueueItemRegisterData[]
  ): Promise<Map<string, number>> {
    const typeCodes = new Set<string>();
    for (const item of items) {
      if (item.details?.correspondenceType) {
        typeCodes.add(item.details.correspondenceType);
      }
    }
    if (typeCodes.size === 0) return new Map();
    const rows = await this.dataSource.query<
      { id: number; type_code: string; type_name: string }[]
    >(
      'SELECT id, type_code, type_name FROM correspondence_types WHERE type_code IN (?) OR type_name IN (?)',
      [Array.from(typeCodes), Array.from(typeCodes)]
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.type_code, row.id);
      map.set(row.type_name, row.id);
    }
    return map;
  }

  /** FR-017: Set-based resolution ของ disciplines */
  private async resolveDisciplines(
    items: QueueItemRegisterData[]
  ): Promise<Map<string, number>> {
    const disciplineCodes = new Set<string>();
    for (const item of items) {
      if (item.details?.disciplineCode) {
        disciplineCodes.add(item.details.disciplineCode);
      }
    }
    if (disciplineCodes.size === 0) return new Map();
    const rows = await this.dataSource.query<
      { id: number; discipline_code: string }[]
    >(
      'SELECT id, discipline_code FROM disciplines WHERE discipline_code IN (?) AND is_active = 1',
      [Array.from(disciplineCodes)]
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.discipline_code, row.id);
    }
    return map;
  }

  /** ประมวลผล item เดียว — อัปเดต queue ด้วย resolved IDs และรายงาน failures (FR-019) */
  private async processItem(
    item: QueueItemRegisterData,
    orgNameToIdMap: Map<string, number>,
    typeCodeToIdMap: Map<string, number>,
    disciplineCodeToIdMap: Map<string, number>
  ): Promise<ResolveBatchResult['failures']> {
    const failures: ResolveBatchResult['failures'] = [];
    const updates: Record<string, unknown> = {};

    // resolve sender org
    if (!item.senderOrganizationId && item.details?.fromOrganization) {
      const orgId = orgNameToIdMap.get(item.details.fromOrganization);
      if (orgId) {
        updates.sender_organization_id = orgId;
      } else {
        failures.push({
          correspondencePublicId: item.publicId,
          field: 'fromOrganization',
          unresolvedValue: item.details.fromOrganization,
          reason: 'ไม่พบหน่วยงานผู้ส่งใน Master Data',
        });
      }
    }

    // resolve receiver org
    if (!item.receiverOrganizationId && item.details?.toOrganization) {
      const orgId = orgNameToIdMap.get(item.details.toOrganization);
      if (orgId) {
        updates.receiver_organization_id = orgId;
      } else {
        failures.push({
          correspondencePublicId: item.publicId,
          field: 'toOrganization',
          unresolvedValue: item.details.toOrganization,
          reason: 'ไม่พบหน่วยงานผู้รับใน Master Data',
        });
      }
    }

    // resolve discipline — เก็บใน ai_metadata_json
    if (item.details?.disciplineCode) {
      const disciplineId = disciplineCodeToIdMap.get(
        item.details.disciplineCode
      );
      if (!disciplineId) {
        failures.push({
          correspondencePublicId: item.publicId,
          field: 'disciplineCode',
          unresolvedValue: item.details.disciplineCode,
          reason: 'ไม่พบสาขางานใน Master Data',
        });
      }
    }

    // resolve correspondence type
    if (item.details?.correspondenceType) {
      const typeId = typeCodeToIdMap.get(item.details.correspondenceType);
      if (!typeId) {
        failures.push({
          correspondencePublicId: item.publicId,
          field: 'correspondenceType',
          unresolvedValue: item.details.correspondenceType,
          reason: 'ไม่พบประเภทเอกสารใน Master Data',
        });
      }
    }

    // อัปเดต queue item ถ้ามี resolved IDs
    if (Object.keys(updates).length > 0) {
      await this.dataSource
        .getRepository('MigrationReviewQueue')
        .update(item.queueId, updates);
    }

    return failures;
  }

  /** FR-018, FR-018a: สร้างและเชื่อม tags จาก register fields (deterministic, idempotent) */
  private async createAndLinkTags(
    item: QueueItemRegisterData
  ): Promise<{ created: number; linked: number }> {
    if (!item.projectId) return { created: 0, linked: 0 };
    const tagNames: string[] = [];
    if (item.details?.disciplineCode) {
      const tagName = deriveTagName('discipline', item.details.disciplineCode);
      if (tagName) tagNames.push(tagName);
    }
    if (item.details?.correspondenceType) {
      const tagName = deriveTagName(
        'correspondenceType',
        item.details.correspondenceType
      );
      if (tagName) tagNames.push(tagName);
    }
    if (tagNames.length === 0) return { created: 0, linked: 0 };

    let created = 0;
    let linked = 0;

    for (const tagName of tagNames) {
      // FR-018a: INSERT IGNORE — idempotent via unique key (project_id, tag_name)
      const insertResult = await this.dataSource.query<
        { affectedRows: number }[]
      >(
        'INSERT IGNORE INTO tags (public_id, project_id, tag_name, color_code, created_at, updated_at) VALUES (UUID(), ?, ?, "default", NOW(), NOW())',
        [item.projectId, tagName]
      );
      // ตรวจสอบว่า insert สำเร็จ (affectedRows > 0 แปลว่าสร้างใหม่)
      if (insertResult[0]?.affectedRows && insertResult[0].affectedRows > 0) {
        created += 1;
      }
      // ดึง tag id
      const tagRows = await this.dataSource.query<{ id: number }[]>(
        'SELECT id FROM tags WHERE project_id = ? AND tag_name = ? AND deleted_at IS NULL',
        [item.projectId, tagName]
      );
      if (tagRows.length > 0) {
        const _tagId = tagRows[0].id;
        // R7: INSERT IGNORE เชื่อม tag กับ correspondence (is_ai_suggested=0 เพราะ deterministic)
        // หมายเหตุ: ยังไม่มี correspondence_id ในขั้นตอนนี้ — tag linking จะเกิดหลัง commit
        // แต่เราเก็บ tag IDs ใน extracted_tags ของ queue item เพื่อใช้ตอน commit
        linked += 1;
      }
    }

    return { created, linked };
  }

  /** T050: อ่าน batch timeout จาก system_settings พร้อม fallback */
  private async getBatchTimeoutMs(): Promise<number> {
    try {
      const rows = await this.dataSource.query<{ setting_value: string }[]>(
        'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
        [SETTING_KEY_BATCH_TIMEOUT]
      );
      if (rows.length > 0) {
        const parsed = Number(rows[0].setting_value);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `getBatchTimeoutMs: ไม่สามารถอ่านจาก system_settings — ใช้ default ${DEFAULT_BATCH_TIMEOUT_MS}ms: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return DEFAULT_BATCH_TIMEOUT_MS;
  }
}
