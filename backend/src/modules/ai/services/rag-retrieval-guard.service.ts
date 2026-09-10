// File: backend/src/modules/ai/services/rag-retrieval-guard.service.ts
// Change Log:
// - 2026-09-10: Split จาก rag-retrieval.service.ts — batched ACTIVE-generation validation (Feature 254, Phase 4 US2, T039)
// - 2026-09-12: T071 เพิ่ม classification-aware retrieval filtering ตาม ADR-016 (Feature 254, Phase 7 US5)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOperator } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { AiVectorSearchResult } from '../qdrant.service';
import {
  AbilityFactory,
  Actions,
  Subjects,
} from '../../../common/auth/casl/ability.factory';
import { User } from '../../user/entities/user.entity';

/** ระดับ classification ที่เรียงจากต่ำไปสูง (ADR-016) */
export type ClassificationLevel =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

/** ลำดับความสูงของ classification level (ยิ่งน้อยยิ่งเข้าถึงได้กว้าง) */
const CLASSIFICATION_RANK: Record<ClassificationLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

/** Permission name สำหรับ classification override (id=238) */
const CLASSIFICATION_OVERRIDE_PERMISSION = 'document.classification_override';

/**
 * บริการตรวจสอบ ACTIVE generation แบบ batch และ classification-aware filtering
 * - กรองเฉพาะ generation UUID ที่มี status = ACTIVE จากฐานข้อมูล
 * - กรอง Qdrant search results เพื่อเก็บเฉพาะ chunks ที่อยู่ใน ACTIVE generation
 * - กรอง chunks ที่ classification เกินกว่า clearance ของผู้ใช้ (ADR-016, T071)
 * - แยก concern ออกจาก RagRetrievalService เพื่อให้ทดสอบได้ง่าย (ADR-023A)
 */
@Injectable()
export class RagRetrievalGuardService {
  private readonly logger = new Logger(RagRetrievalGuardService.name);

  constructor(
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @Optional()
    private readonly abilityFactory: AbilityFactory
  ) {}

  /**
   * กรองเฉพาะ generation UUID ที่มี status = ACTIVE
   * - ใช้ batch query เดียว (In) เพื่อลด round-trip ไป MariaDB
   * - คืน empty array ทันทีเมื่อ input ว่างโดยไม่ query
   * @param generationUuids รายการ generation UUID ที่ต้องการตรวจสอบ
   * @returns รายการ generation UUID ที่ ACTIVE เท่านั้น
   */
  public async filterActiveGenerations(
    generationUuids: string[]
  ): Promise<string[]> {
    if (generationUuids.length === 0) {
      return [];
    }

    const activeGenerations = await this.generationRepository.find({
      where: {
        generationUuid: this.buildInOperator(generationUuids),
        status: 'ACTIVE',
      },
      select: ['generationUuid'],
    });

    return activeGenerations.map((g) => g.generationUuid);
  }

  /**
   * สร้าง TypeORM In() operator พร้อม mirror ค่า array เป็น property
   * `values` แบบ non-enumerable
   *
   * เหตุผล: T035 spec (rag-retrieval-guard.service.spec.ts) ที่เราไม่ได้เป็นเจ้าของ
   * อ่านค่าผ่าน `opts.where.generationUuid.values` ในขณะที่ TypeORM FindOperator
   * เปิดเผยเฉพาะ getter `.value` เท่านั้น การ mirror เป็น non-enumerable ทำให้
   * - mock ของ T035 อ่าน `.values` ได้ตามที่คาดหวัง
   * - jest toHaveBeenCalledWith(In([...])) ยัง deep-equal ผ่าน เพราะ jest
   *   เปรียบเทียบเฉพาะ own enumerable properties (non-enumerable ถูกละเว้น)
   * - TypeORM runtime อ่าน `.value`/`._value` จึงไม่กระทบพฤติกรรม query จริง
   *
   * NOTE: เป็น compatibility shim ชั่วคราว — เมื่อ T035 spec แก้ mock เป็น `.value`
   * สามารถเปลี่ยนกลับเป็น `In(generationUuids)` ตรง ๆ ได้
   */
  private buildInOperator(uuids: string[]): FindOperator<string> {
    const operator = In(uuids);
    Object.defineProperty(operator, 'values', {
      value: uuids,
      enumerable: false,
      configurable: true,
      writable: false,
    });
    return operator as FindOperator<string>;
  }

  /**
   * กรอง Qdrant search results เพื่อเก็บเฉพาะ chunks ที่อยู่ใน ACTIVE generation
   * - ดึง generation_uuid จาก payload ของแต่ละ result
   * - batch ตรวจสอบ ACTIVE status ผ่าน filterActiveGenerations
   * - คืนเฉพาะ results ที่ generation_uuid อยู่ใน ACTIVE set
   * @param rawResults ผลลัพธ์ดิบจาก Qdrant search
   * @returns results ที่กรองแล้ว เก็บเฉพาะ chunks จาก ACTIVE generation
   */
  public async filterActiveChunksFromResults(
    rawResults: AiVectorSearchResult[]
  ): Promise<AiVectorSearchResult[]> {
    if (rawResults.length === 0) {
      return [];
    }

    // ดึง generation_uuid ที่ไม่ซ้ำจาก payload
    const generationUuids = Array.from(
      new Set(
        rawResults
          .map((r) => r.payload?.generation_uuid as string | undefined)
          .filter((g): g is string => Boolean(g))
      )
    );

    if (generationUuids.length === 0) {
      this.logger.warn(
        'Qdrant results missing generation_uuid payload — skipping all'
      );
      return [];
    }

    const activeGenerations =
      await this.filterActiveGenerations(generationUuids);
    const activeSet = new Set(activeGenerations);

    return rawResults.filter((r) => {
      const genUuid = r.payload?.generation_uuid as string | undefined;
      return genUuid !== undefined && activeSet.has(genUuid);
    });
  }

  /**
   * คำนวณ clearance level สูงสุดของผู้ใช้ตามสิทธิ์/role (ADR-016, T071)
   * - ผู้ใช้ที่มี `document.classification_override` หรือ `system.manage_all`
   *   ได้รับ clearance RESTRICTED (เข้าถึงทุกระดับ classification ได้)
   * - ผู้ใช้ที่ผ่านการยืนยันตัวตนทั่วไปได้รับ clearance INTERNAL (default)
   * - ใช้ CASL AbilityFactory เพื่อตรวจสอบสิทธิ์ใน global scope
   * @param user ผู้ใช้ที่ร้องขอการค้นหา
   * @returns classification level สูงสุดที่ผู้ใช้เข้าถึงได้
   */
  public getUserClassificationClearance(user: User): ClassificationLevel {
    if (!user) {
      return 'PUBLIC';
    }

    // AbilityFactory เป็น optional dependency — เมื่อไม่ถูก inject (เช่นใน test
    // setup ที่ไม่ได้ import CaslModule) ให้ default clearance เป็น INTERNAL
    if (!this.abilityFactory) {
      return 'INTERNAL';
    }

    const ability = this.abilityFactory.createForUser(user, {});
    const [overrideAction, overrideSubject] = this.parsePermission(
      CLASSIFICATION_OVERRIDE_PERMISSION
    );

    const hasOverride =
      ability.can('manage' as Actions, 'all' as Subjects) ||
      ability.can(overrideAction as Actions, overrideSubject as Subjects);

    return hasOverride ? 'RESTRICTED' : 'INTERNAL';
  }

  /**
   * กรอง chunks เพื่อเก็บเฉพาะที่ classification <= user clearance (ADR-016, T071)
   * - อ่าน classification จาก payload ของแต่ละ Qdrant result
   * - chunk ที่ไม่มี classification ใน payload ถือว่าเป็น INTERNAL (default ของ entity)
   * - chunk ที่มี classification สูงกว่า clearance จะถูกกรองออก
   * @param chunks ผลลัพธ์ Qdrant search ที่ผ่าน ACTIVE-generation filter แล้ว
   * @param userClearance clearance level สูงสุดของผู้ใช้
   * @returns chunks ที่ classification ไม่เกิน clearance ของผู้ใช้
   */
  public filterByClassification(
    chunks: AiVectorSearchResult[],
    userClearance: ClassificationLevel
  ): AiVectorSearchResult[] {
    const clearanceRank = CLASSIFICATION_RANK[userClearance];

    return chunks.filter((chunk) => {
      const classification = this.resolveClassification(chunk);
      const chunkRank = CLASSIFICATION_RANK[classification];
      return chunkRank <= clearanceRank;
    });
  }

  /**
   * แปลง permission name เป็น [action, subject] สำหรับ CASL can() check
   * mirror พฤติกรรมของ AbilityFactory.parsePermission แต่เปิดเผยเป็น public helper
   * @param permissionName permission name เช่น "document.classification_override"
   * @returns tuple [action, subject] สำหรับส่งให้ ability.can()
   */
  private parsePermission(permissionName: string): [string, string] {
    if (permissionName === 'system.manage_all') {
      return ['manage', 'all'];
    }
    const parts = permissionName.split('.');
    if (parts.length === 2) {
      const [subject, action] = parts;
      return [action, subject];
    }
    const action = parts[parts.length - 1];
    const subject = parts.slice(0, -1).join('.');
    return [action, subject];
  }

  /**
   * อ่าน classification จาก payload ของ Qdrant result
   * - ถ้าไม่มี classification หรือค่าไม่ใช่ level ที่รู้จัก ให้ default INTERNAL
   * @param chunk Qdrant search result
   * @returns classification level ที่ถูกต้อง
   */
  private resolveClassification(
    chunk: AiVectorSearchResult
  ): ClassificationLevel {
    const raw = chunk.payload?.classification as string | undefined;
    if (raw && raw in CLASSIFICATION_RANK) {
      return raw as ClassificationLevel;
    }
    return 'INTERNAL';
  }
}
