// File: src/modules/response-code/seeders/response-code.seed.ts
// Seed data สำหรับ Master Approval Matrix — Response Codes มาตรฐาน
// อ้างอิง: specs/1-rfa-approval-refactor/spec.md — Comprehensive Master Approval Matrix

import { DataSource } from 'typeorm';
import { ResponseCode } from '../entities/response-code.entity';
import { ResponseCodeCategory } from '../../common/enums/review.enums';

export const responseCodeSeedData = [
  // ─── ENGINEERING Category (Shop Drawing, Method Statement, As-Built) ───────
  {
    code: '1A',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติเพื่อก่อสร้าง',
    descriptionEn: 'Approved for Construction',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1B',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติเพื่อก่อสร้าง พร้อมความเห็น (แก้ไขไม่ต้องส่งกลับ)',
    descriptionEn: 'Approved for Construction with Comments (No Resubmission Required)',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1C',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติ — มีผลต่อสัญญา/Change Order',
    descriptionEn: 'Approved — Contract Implications / Change Order Required',
    implications: { affectsSchedule: true, affectsCost: true, requiresContractReview: true },
    notifyRoles: ['CONTRACT_MANAGER', 'QS_MANAGER'],
    isSystem: true,
  },
  {
    code: '1D',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติทางเลือก — แตกต่างจากแบบสัญญา',
    descriptionEn: 'Approved Alternative — Differs from Contract Drawing',
    implications: { affectsSchedule: false, affectsCost: true, requiresContractReview: true },
    notifyRoles: ['CONTRACT_MANAGER', 'DESIGN_MANAGER'],
    isSystem: true,
  },
  {
    code: '1E',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติเพื่อวัตถุประสงค์การออกแบบเท่านั้น',
    descriptionEn: 'Approved for Design Purpose Only',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1F',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติเพื่ออ้างอิงเท่านั้น',
    descriptionEn: 'Approved for Reference Only',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1G',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติพร้อมเงื่อนไข ESG',
    descriptionEn: 'Approved with ESG Conditions',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false, requiresEiaAmendment: true },
    notifyRoles: ['EIA_OFFICER', 'HSE_MANAGER'],
    isSystem: true,
  },
  {
    code: '2',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'อนุมัติตามหมายเหตุ — ต้องแก้ไขและส่งกลับเพื่อตรวจสอบ',
    descriptionEn: 'Approved as Noted — Revise and Resubmit for Review',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '3',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'ปฏิเสธ — ต้องแก้ไขและส่งใหม่',
    descriptionEn: 'Rejected — Revise and Resubmit',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: ['PROJECT_MANAGER', 'DESIGN_MANAGER'],
    isSystem: true,
  },
  {
    code: '4',
    category: ResponseCodeCategory.ENGINEERING,
    descriptionTh: 'ไม่เกี่ยวข้อง / ถอนคืน',
    descriptionEn: 'Not Applicable / Withdrawn',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },

  // ─── MATERIAL Category ────────────────────────────────────────────────────
  {
    code: '1A',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'อนุมัติวัสดุ/อุปกรณ์เพื่อจัดซื้อ',
    descriptionEn: 'Approved for Procurement',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1B',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'อนุมัติวัสดุ/อุปกรณ์ พร้อมความเห็น',
    descriptionEn: 'Approved for Procurement with Comments',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1C',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'อนุมัติ — มีผลต่อค่าใช้จ่าย',
    descriptionEn: 'Approved — Cost Implications',
    implications: { affectsSchedule: false, affectsCost: true, requiresContractReview: true },
    notifyRoles: ['QS_MANAGER', 'PROCUREMENT_MANAGER'],
    isSystem: true,
  },
  {
    code: '2',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'ส่งข้อมูลเพิ่มเติม',
    descriptionEn: 'Provide Additional Information',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '3',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'ปฏิเสธ — ไม่เป็นไปตามสัญญา',
    descriptionEn: 'Rejected — Non-Compliant with Contract',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: ['PROJECT_MANAGER', 'PROCUREMENT_MANAGER'],
    isSystem: true,
  },
  {
    code: '4',
    category: ResponseCodeCategory.MATERIAL,
    descriptionTh: 'ไม่เกี่ยวข้อง / ถอนคืน',
    descriptionEn: 'Not Applicable / Withdrawn',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },

  // ─── CONTRACT Category ────────────────────────────────────────────────────
  {
    code: '1A',
    category: ResponseCodeCategory.CONTRACT,
    descriptionTh: 'อนุมัติ — ไม่มีผลต่อสัญญา',
    descriptionEn: 'Approved — No Contract Implication',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1C',
    category: ResponseCodeCategory.CONTRACT,
    descriptionTh: 'อนุมัติ — ต้องออก Change Order',
    descriptionEn: 'Approved — Change Order Required',
    implications: { affectsSchedule: true, affectsCost: true, requiresContractReview: true },
    notifyRoles: ['CONTRACT_MANAGER', 'QS_MANAGER', 'PROJECT_MANAGER'],
    isSystem: true,
  },
  {
    code: '2',
    category: ResponseCodeCategory.CONTRACT,
    descriptionTh: 'อยู่ระหว่างการพิจารณา — ต้องการข้อมูลเพิ่มเติม',
    descriptionEn: 'Under Review — Additional Information Required',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '3',
    category: ResponseCodeCategory.CONTRACT,
    descriptionTh: 'ปฏิเสธ — ขัดต่อเงื่อนไขสัญญา',
    descriptionEn: 'Rejected — Contradicts Contract Terms',
    implications: { affectsSchedule: true, affectsCost: true, requiresContractReview: true },
    notifyRoles: ['CONTRACT_MANAGER', 'LEGAL_TEAM', 'PROJECT_MANAGER'],
    isSystem: true,
  },

  // ─── TESTING Category ─────────────────────────────────────────────────────
  {
    code: '1A',
    category: ResponseCodeCategory.TESTING,
    descriptionTh: 'อนุมัติผลการทดสอบ / ส่งมอบ',
    descriptionEn: 'Approved — Test Results / Handover Accepted',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '2',
    category: ResponseCodeCategory.TESTING,
    descriptionTh: 'ผ่านพร้อมข้อบกพร่องเล็กน้อย — ต้องแก้ไขและรายงาน',
    descriptionEn: 'Passed with Minor Defects — Rectify and Report',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false },
    notifyRoles: ['QA_MANAGER'],
    isSystem: true,
  },
  {
    code: '3',
    category: ResponseCodeCategory.TESTING,
    descriptionTh: 'ไม่ผ่าน — ต้องทดสอบซ้ำ',
    descriptionEn: 'Failed — Retest Required',
    implications: { affectsSchedule: true, affectsCost: true, requiresContractReview: false },
    notifyRoles: ['PROJECT_MANAGER', 'QA_MANAGER'],
    isSystem: true,
  },

  // ─── ESG Category ──────────────────────────────────────────────────────────
  {
    code: '1A',
    category: ResponseCodeCategory.ESG,
    descriptionTh: 'อนุมัติ — เป็นไปตามมาตรฐาน ESG',
    descriptionEn: 'Approved — ESG Compliant',
    implications: { affectsSchedule: false, affectsCost: false, requiresContractReview: false },
    notifyRoles: [],
    isSystem: true,
  },
  {
    code: '1G',
    category: ResponseCodeCategory.ESG,
    descriptionTh: 'อนุมัติพร้อมเงื่อนไขด้านสิ่งแวดล้อม',
    descriptionEn: 'Approved with Environmental Conditions',
    implications: { affectsSchedule: true, affectsCost: false, requiresContractReview: false, requiresEiaAmendment: true },
    notifyRoles: ['EIA_OFFICER', 'HSE_MANAGER'],
    isSystem: true,
  },
  {
    code: '3',
    category: ResponseCodeCategory.ESG,
    descriptionTh: 'ปฏิเสธ — ไม่เป็นไปตามข้อกำหนด EIA/ESG',
    descriptionEn: 'Rejected — Non-Compliant with EIA/ESG Requirements',
    implications: { affectsSchedule: true, affectsCost: true, requiresContractReview: false, requiresEiaAmendment: true },
    notifyRoles: ['EIA_OFFICER', 'HSE_MANAGER', 'PROJECT_MANAGER'],
    isSystem: true,
  },
];

/**
 * Seed Response Codes ลงฐานข้อมูล
 * ใช้สำหรับ initial setup และ test environments
 */
export async function seedResponseCodes(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(ResponseCode);

  for (const data of responseCodeSeedData) {
    const exists = await repo.findOne({
      where: { code: data.code, category: data.category as ResponseCodeCategory },
    });

    if (!exists) {
      const entity = repo.create({
        code: data.code,
        category: data.category as ResponseCodeCategory,
        descriptionTh: data.descriptionTh,
        descriptionEn: data.descriptionEn,
        implications: data.implications,
        notifyRoles: data.notifyRoles,
        isSystem: data.isSystem,
        isActive: true,
      });
      await repo.save(entity);
    }
  }
}
