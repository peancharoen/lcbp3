// File: backend/src/modules/migration/services/excel-business-rules.service.ts
// Change Log:
// - 2026-09-06: Initial creation — Layer 2 Business Rules Validator (T008)
//   ตรวจสอบ cross-table: duplicate doc number+revision (DB + within file),
//   organization resolution, type/discipline resolution, project mismatch,
//   chronology guard, attachment filename matching, revision semantics
//   ผลลัพธ์เป็น ReviewFinding[] ระดับ BLOCK/WARN ส่งต่อ Layer 3

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../../master/entities/discipline.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { Project } from '../../project/entities/project.entity';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewTargetMode,
} from '../types/excel-review.types';
import { ExcelDateParserService } from './excel-date-parser.service';

/**
 * Input สำหรับ Layer 2 validation
 * - rows: แถวจาก Layer 1 (พร้อม findings ของ Layer 1)
 * - projectPublicId: UUID ของโครงการปลายทาง (บังคับ 1 ไฟล์ต่อ 1 โครงการ)
 * - targetMode: MIGRATION_STAGING หรือ DIRECT_IMPORT
 * - attachmentFileNames: รายชื่อไฟล์ PDF ที่ส่งมาใน .zip (ว่าง = ไม่มี attachment)
 */
export interface BusinessRulesInput {
  rows: ExcelCorrespondenceRow[];
  projectPublicId: string;
  targetMode: ReviewTargetMode;
  /** ชื่อไฟล์ PDF ที่ส่งมาใน .zip (ถ้าเป็น .xlsx เดี่ยว ๆ จะเป็น []) */
  attachmentFileNames: string[];
}

/**
 * ผลลัพธ์ Layer 2
 * - findings: รายการปัญหาที่พบ (BLOCK/WARN)
 * - rows: ส่งต่อ rows พร้อม findings ของ Layer 2 ที่เพิ่มเข้าไปในแต่ละแถว
 */
export interface BusinessRulesResult {
  findings: ReviewFinding[];
  rows: ExcelCorrespondenceRow[];
}

/**
 * ExcelBusinessRulesService — Layer 2 ของ 4-Layer Pipeline (T008)
 *
 * ตรวจสอบ cross-table ทั้งหมด:
 * - FR-005: Chronology guard (issued <= received <= NOW+1)
 * - FR-006: Organization resolution (exact match → WARN ถ้าไม่เจอ)
 * - FR-007: Revision semantics (doc+rev ซ้ำใน DB = BLOCK, ซ้ำในไฟล์ = BLOCK)
 * - D14: Project mismatch (BLOCK)
 * - D9: Attachment filename matching (WARN ถ้าระบุแต่ไม่ส่งไฟล์มา)
 * - Type/Discipline resolution (WARN ถ้าไม่เจอใน master)
 *
 * ไม่ตรวจ AI (Layer 3) ไม่ตรวจ schema (Layer 1)
 */
@Injectable()
export class ExcelBusinessRulesService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceType)
    private readonly typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Discipline)
    private readonly disciplineRepo: Repository<Discipline>,
    @InjectRepository(Correspondence)
    private readonly correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly dateParser: ExcelDateParserService
  ) {}

  /**
   * ตรวจ Layer 2 จาก rows ที่ผ่าน Layer 1
   * คืน rows พร้อม findings ของ Layer 2 ที่เพิ่มเข้าไปในแต่ละแถว
   */
  async validate(input: BusinessRulesInput): Promise<BusinessRulesResult> {
    const allFindings: ReviewFinding[] = [];
    const rows = input.rows.map((r) => ({ ...r, findings: [...r.findings] }));

    // 1) ตรวจ project มีอยู่จริง
    const project = await this.projectRepo.findOne({
      where: { publicId: input.projectPublicId },
    });
    if (!project) {
      allFindings.push({
        row: 0,
        column: 'Project',
        level: 'BLOCK',
        message: `ไม่พบโครงการที่มี publicId "${input.projectPublicId}" ในระบบ`,
        originalValue: input.projectPublicId,
      });
      // ถ้า project ไม่มี ตรวจต่อไม่ได้ — คืนเลย
      return { findings: allFindings, rows };
    }

    // 2) ตรวจ duplicate doc number + revision ภายในไฟล์
    this.checkDuplicateWithinFile(rows, allFindings);

    // 3) ตรวจ duplicate doc number + revision ใน DB
    await this.checkDuplicateInDb(rows, project.id, allFindings);

    // 4) ตรวจ organization resolution
    await this.checkOrganizations(rows, allFindings, input.targetMode);

    // 5) ตรวจ type/discipline resolution
    await this.checkTypeAndDiscipline(rows, allFindings);

    // 6) ตรวจ chronology guard (FR-005)
    this.checkChronology(rows, allFindings);

    // 7) ตรวจ attachment filename matching (D9)
    this.checkAttachments(rows, input.attachmentFileNames, allFindings);

    return { findings: allFindings, rows };
  }

  // ---------- internals ----------

  /** ตรวจ duplicate doc number + revision ภายในไฟล์เดียวกัน */
  private checkDuplicateWithinFile(
    rows: ExcelCorrespondenceRow[],
    findings: ReviewFinding[]
  ): void {
    const seen = new Map<string, number>(); // key = "docNumber|revision"

    for (const row of rows) {
      const key = `${row.documentNumber}|${row.revisionNumber}`;
      const firstRow = seen.get(key);
      if (firstRow !== undefined) {
        const finding: ReviewFinding = {
          row: row.rowIndex,
          column: 'Document Number',
          level: 'BLOCK',
          message: `เลขที่เอกสาร "${row.documentNumber}" Revision "${row.revisionNumber}" ซ้ำกับแถวที่ ${firstRow} ในไฟล์เดียวกัน`,
          originalValue: row.documentNumber,
        };
        row.findings.push(finding);
        findings.push(finding);
      } else {
        seen.set(key, row.rowIndex);
      }
    }
  }

  /** ตรวจ duplicate doc number + revision ใน DB ของโครงการ */
  private async checkDuplicateInDb(
    rows: ExcelCorrespondenceRow[],
    projectId: number,
    findings: ReviewFinding[]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    // ดึง doc numbers ทั้งหมดในไฟล์
    const docNumbers = rows.map((r) => r.documentNumber);

    // ค้น correspondences ที่มี doc number ตรงในโครงการ
    const existingCorrespondences = await this.correspondenceRepo.find({
      where: {
        projectId,
        correspondenceNumber: In(docNumbers),
      },
      relations: ['revisions'],
    });

    // สร้าง map: "docNumber|revisionNumber" → correspondenceId
    const existingMap = new Map<string, number>();
    for (const corr of existingCorrespondences) {
      if (corr.revisions) {
        for (const rev of corr.revisions) {
          const key = `${corr.correspondenceNumber}|${String(rev.revisionNumber)}`;
          existingMap.set(key, corr.id);
        }
      }
    }

    for (const row of rows) {
      const key = `${row.documentNumber}|${row.revisionNumber}`;
      if (existingMap.has(key)) {
        const finding: ReviewFinding = {
          row: row.rowIndex,
          column: 'Document Number',
          level: 'BLOCK',
          message: `เลขที่เอกสาร "${row.documentNumber}" Revision "${row.revisionNumber}" มีอยู่แล้วในฐานข้อมูลของโครงการ — ห้ามเขียนทับ Revision เดิม`,
          originalValue: row.documentNumber,
        };
        row.findings.push(finding);
        findings.push(finding);
      }
      // หมายเหตุ: doc number เดิม + revision ใหม่ = อนุญาต (FR-007) ไม่ติด BLOCK
    }
  }

  /** ตรวจ organization resolution (FR-006) */
  private async checkOrganizations(
    rows: ExcelCorrespondenceRow[],
    findings: ReviewFinding[],
    targetMode: ReviewTargetMode
  ): Promise<void> {
    // รวมชื่อ org ทั้งหมดที่ต้อง resolve
    const orgNames = new Set<string>();
    for (const row of rows) {
      if (row.senderOrgRaw) orgNames.add(row.senderOrgRaw.trim());
      if (row.receiverOrgRaw) orgNames.add(row.receiverOrgRaw.trim());
    }

    if (orgNames.size === 0) {
      return;
    }

    // ค้น exact match ใน master organizations
    const orgs = await this.orgRepo.find({
      where: [
        { organizationName: In([...orgNames]) },
        { organizationCode: In([...orgNames]) },
      ],
    });

    // สร้าง map: name/code → orgId
    const orgMap = new Map<string, number>();
    for (const org of orgs) {
      orgMap.set(org.organizationName.toLowerCase(), org.id);
      orgMap.set(org.organizationCode.toLowerCase(), org.id);
    }

    for (const row of rows) {
      if (row.senderOrgRaw) {
        const resolved = orgMap.get(row.senderOrgRaw.trim().toLowerCase());
        if (resolved !== undefined) {
          row.senderOrgId = resolved;
        } else {
          const level = targetMode === 'DIRECT_IMPORT' ? 'BLOCK' : 'WARN';
          const finding: ReviewFinding = {
            row: row.rowIndex,
            column: 'From',
            level,
            message:
              targetMode === 'DIRECT_IMPORT'
                ? `หน่วยงานผู้ส่ง "${row.senderOrgRaw}" ไม่ตรงกับ Master Organization — Direct Import บังคับต้อง resolve ก่อน commit`
                : `หน่วยงานผู้ส่ง "${row.senderOrgRaw}" ไม่ตรงกับ Master Organization — Migration Staging อนุญาตให้เข้าคิวเพื่อ resolve ภายหลัง`,
            originalValue: row.senderOrgRaw,
          };
          row.findings.push(finding);
          findings.push(finding);
        }
      }

      if (row.receiverOrgRaw) {
        const resolved = orgMap.get(row.receiverOrgRaw.trim().toLowerCase());
        if (resolved !== undefined) {
          row.receiverOrgId = resolved;
        } else {
          const level = targetMode === 'DIRECT_IMPORT' ? 'BLOCK' : 'WARN';
          const finding: ReviewFinding = {
            row: row.rowIndex,
            column: 'To',
            level,
            message:
              targetMode === 'DIRECT_IMPORT'
                ? `หน่วยงานผู้รับ "${row.receiverOrgRaw}" ไม่ตรงกับ Master Organization — Direct Import บังคับต้อง resolve ก่อน commit`
                : `หน่วยงานผู้รับ "${row.receiverOrgRaw}" ไม่ตรงกับ Master Organization — Migration Staging อนุญาตให้เข้าคิวเพื่อ resolve ภายหลัง`,
            originalValue: row.receiverOrgRaw,
          };
          row.findings.push(finding);
          findings.push(finding);
        }
      }
    }
  }

  /** ตรวจ type/discipline resolution */
  private async checkTypeAndDiscipline(
    rows: ExcelCorrespondenceRow[],
    findings: ReviewFinding[]
  ): Promise<void> {
    const typeCodes = new Set<string>();
    const disciplineCodes = new Set<string>();
    for (const row of rows) {
      if (row.correspondenceTypeCode)
        typeCodes.add(row.correspondenceTypeCode.trim());
      if (row.disciplineCode) disciplineCodes.add(row.disciplineCode.trim());
    }

    let typeMap = new Map<string, number>();
    if (typeCodes.size > 0) {
      const types = await this.typeRepo.find({
        where: { typeCode: In([...typeCodes]) },
      });
      typeMap = new Map(types.map((t) => [t.typeCode.toLowerCase(), t.id]));
    }

    let disciplineMap = new Map<string, number>();
    if (disciplineCodes.size > 0) {
      const disciplines = await this.disciplineRepo.find({
        where: { disciplineCode: In([...disciplineCodes]) },
      });
      disciplineMap = new Map(
        disciplines.map((d) => [d.disciplineCode.toLowerCase(), d.id])
      );
    }

    for (const row of rows) {
      if (
        row.correspondenceTypeCode &&
        row.correspondenceTypeCode.trim() !== ''
      ) {
        const resolved = typeMap.get(
          row.correspondenceTypeCode.trim().toLowerCase()
        );
        if (resolved === undefined) {
          const finding: ReviewFinding = {
            row: row.rowIndex,
            column: 'Category',
            level: 'WARN',
            message: `ประเภทเอกสาร "${row.correspondenceTypeCode}" ไม่ตรงกับ Master Correspondence Type — AI อาจช่วยเสนอประเภทที่ถูกต้อง`,
            originalValue: row.correspondenceTypeCode,
          };
          row.findings.push(finding);
          findings.push(finding);
        }
      }

      if (row.disciplineCode && row.disciplineCode.trim() !== '') {
        const resolved = disciplineMap.get(
          row.disciplineCode.trim().toLowerCase()
        );
        if (resolved === undefined) {
          const finding: ReviewFinding = {
            row: row.rowIndex,
            column: 'Discipline',
            level: 'WARN',
            message: `Discipline "${row.disciplineCode}" ไม่ตรงกับ Master Discipline — AI อาจช่วยเสนอ Discipline ที่ถูกต้อง`,
            originalValue: row.disciplineCode,
          };
          row.findings.push(finding);
          findings.push(finding);
        }
      }
    }
  }

  /** ตรวจ chronology guard (FR-005) */
  private checkChronology(
    rows: ExcelCorrespondenceRow[],
    findings: ReviewFinding[]
  ): void {
    for (const row of rows) {
      if (
        !this.dateParser.isChronologyValid(row.issuedDate, row.receivedDate)
      ) {
        const finding: ReviewFinding = {
          row: row.rowIndex,
          column: 'Date',
          level: 'BLOCK',
          message:
            'ลำดับวันที่ขัดแย้งเชิงตรรกะ: วันที่ออกต้องไม่เกินวันที่รับ และทั้งคู่ต้องไม่เกิน NOW+1 วัน',
          originalValue: {
            issued: row.issuedDate?.toISOString(),
            received: row.receivedDate?.toISOString(),
          },
        };
        row.findings.push(finding);
        findings.push(finding);
      }
    }
  }

  /** ตรวจ attachment filename matching (D9) */
  private checkAttachments(
    rows: ExcelCorrespondenceRow[],
    attachmentFileNames: string[],
    findings: ReviewFinding[]
  ): void {
    const attachmentSet = new Set(
      attachmentFileNames.map((n) => n.toLowerCase())
    );

    for (const row of rows) {
      if (!row.fileName || row.fileName.trim() === '') {
        // ไม่ระบุชื่อไฟล์ = ลงทะเบียนล่วงหน้าไม่มีไฟล์แนบ (ผ่าน)
        continue;
      }

      if (!attachmentSet.has(row.fileName.trim().toLowerCase())) {
        const finding: ReviewFinding = {
          row: row.rowIndex,
          column: 'File Name',
          level: 'WARN',
          message: `ระบุชื่อไฟล์ "${row.fileName}" แต่ไม่พบไฟล์ในแพ็กเกจที่อัปโหลด — หากเป็นการลงทะเบียนล่วงหน้าให้เว้นว่าง หากต้องการแนบไฟล์ให้ส่งใน .zip`,
          originalValue: row.fileName,
        };
        row.findings.push(finding);
        findings.push(finding);
      }
    }
  }
}
