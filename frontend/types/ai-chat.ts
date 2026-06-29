// File: frontend/types/ai-chat.ts
// Change Log:
// - 2026-05-19: สร้างอินเตอร์เฟซและประเภทข้อมูลสำหรับระบบ AI Document Chat

/**
 * ปุ่มสั่งการกระทำที่แนะนำจาก AI
 */
export interface SuggestedAction {
  label: string; // ข้อความแสดงบนปุ่ม Chip
  query: string; // คำค้นหาหรือคำสั่งที่จะส่งหา AI เมื่อคลิก
}

/**
 * โครงสร้างข้อความสนทนาในแต่ละ Session
 */
export interface ChatMessage {
  id: string; // รหัสเฉพาะของข้อความในรูปแบบ UUIDv7 string
  role: 'user' | 'assistant' | 'system'; // บทบาทผู้ส่งข้อความ
  content: string; // เนื้อหาข้อความ (Markdown format)
  timestamp: string; // วันเวลาส่งข้อความในรูปแบบ ISO string
  suggestedActions?: SuggestedAction[]; // ปุ่มสั่งการแนะนำ (ถ้ามี)
  isStreaming?: boolean; // สถานะกำลังรอข้อความแบบ Stream
}

/**
 * บริบทแนบของเอกสารที่คุยอยู่
 */
export interface ChatContext {
  type: 'drawing' | 'rfa' | 'transmittal' | 'correspondence'; // ประเภทของเอกสาร
  publicId: string; // UUIDv7 publicId ของเอกสารนั้นๆ
}

/**
 * ข้อมูลคำขอส่งแชทไปยัง API
 */
export interface ChatRequestDto {
  query: string; // คำถามของผู้ใช้งาน
  context: ChatContext; // บริบทหน้าเอกสาร
}

/**
 * ข้อมูลการตอบกลับแชทจาก API
 */
export interface ChatResponseDto {
  messageId: string; // UUIDv7 ของข้อความตอบกลับ
  role: 'assistant'; // บทบาทผู้ตอบ
  content: string; // เนื้อหาของคำตอบ
  suggestedActions?: SuggestedAction[]; // ปุ่มสั่งการแนะนำ
  latencyMs: number; // ระยะเวลาประมวลผล (มิลลิวินาที)
}
