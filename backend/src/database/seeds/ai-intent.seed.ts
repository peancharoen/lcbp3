// File: src/database/seeds/ai-intent.seed.ts
// Change Log
// - 2026-05-19: สร้าง seed ข้อมูล 12 Intent Definitions สำหรับ ADR-024.
// Seed สำหรับ Intent Definitions เริ่มต้น 12 รายการตาม ADR-024

import { DataSource } from 'typeorm';
import { IntentDefinition } from '../../modules/ai/intent-classifier/entities/intent-definition.entity';
import { IntentCategory } from '../../modules/ai/intent-classifier/interfaces/intent-category.enum';

/** โครงสร้างข้อมูลสำหรับ seed */
interface IntentSeedItem {
  intentCode: string;
  descriptionTh: string;
  descriptionEn: string;
  category: IntentCategory;
  isActive: boolean;
}

/** ข้อมูล Intent Definitions 12 รายการ (v1 ตาม ADR-024) */
const INTENT_SEED_DATA: IntentSeedItem[] = [
  // Read Intents
  {
    intentCode: 'RAG_QUERY',
    descriptionTh: 'ถามคำถามธรรมชาติ ตอบจาก vector + doc context',
    descriptionEn: 'Natural language query from vector DB + document context',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_RFA',
    descriptionTh: 'ดึง RFA ตาม filter',
    descriptionEn: 'Get RFA by filters',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_DRAWING',
    descriptionTh: 'ดึง Drawing revision',
    descriptionEn: 'Get Drawing revision',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_TRANSMITTAL',
    descriptionTh: 'ดึง Transmittal',
    descriptionEn: 'Get Transmittal',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_CORRESPONDENCE',
    descriptionTh: 'ดึง Correspondence ทั่วไป',
    descriptionEn: 'Get Correspondence',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_CIRCULATION',
    descriptionTh: 'ดึง Circulation',
    descriptionEn: 'Get Circulation',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'GET_RFA_DRAWINGS',
    descriptionTh: 'ดึง Drawings ที่ผูกกับ RFA',
    descriptionEn: 'Get Drawings linked to RFA',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'SUMMARIZE_DOCUMENT',
    descriptionTh: 'สรุปเอกสารที่เปิดอยู่',
    descriptionEn: 'Summarize current document',
    category: IntentCategory.READ,
    isActive: true,
  },
  {
    intentCode: 'LIST_OVERDUE',
    descriptionTh: 'รายการ cross-entity ที่เกินกำหนด',
    descriptionEn: 'List overdue items across entities',
    category: IntentCategory.READ,
    isActive: true,
  },
  // Suggest Intents
  {
    intentCode: 'SUGGEST_METADATA',
    descriptionTh: 'แนะนำ metadata สำหรับเอกสารที่อัปโหลด',
    descriptionEn: 'Suggest metadata for uploaded document',
    category: IntentCategory.SUGGEST,
    isActive: true,
  },
  {
    intentCode: 'SUGGEST_ACTION',
    descriptionTh: 'แจ้งเตือนว่าควรทำอะไรต่อ',
    descriptionEn: 'Suggest next actions',
    category: IntentCategory.SUGGEST,
    isActive: true,
  },
  // Utility Intents
  {
    intentCode: 'FALLBACK',
    descriptionTh: 'ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ',
    descriptionEn: 'No matching intent / unrelated to system',
    category: IntentCategory.UTILITY,
    isActive: true,
  },
];

/**
 * Seed Intent Definitions ลงฐานข้อมูล
 * ใช้ INSERT IGNORE เพื่อ idempotent — รันซ้ำได้โดยไม่ error
 */
export async function seedAiIntents(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(IntentDefinition);
  for (const data of INTENT_SEED_DATA) {
    const exists = await repo.findOne({
      where: { intentCode: data.intentCode },
    });
    if (!exists) {
      const entity = repo.create(data);
      await repo.save(entity);
    }
  }
}
