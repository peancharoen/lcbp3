// File: src/modules/ai/intent-classifier/services/ollama-client.service.ts
// Change Log
// - 2026-05-19: สร้าง Ollama Client สำหรับ Intent Classification LLM Fallback (ADR-024, ADR-023A).

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

/** โครงสร้าง response จาก Ollama /api/generate */
interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

/** ผลลัพธ์จาก LLM ที่ parse แล้ว */
export interface LlmIntentResult {
  intent: string;
  confidence: number;
}

/** System prompt สำหรับ Intent Classification */
const SYSTEM_PROMPT = `คุณเป็นตัวจำแนกคำสั่ง (Intent Classifier) สำหรับระบบจัดการเอกสาร DMS
จงวิเคราะห์คำถามของผู้ใช้และตอบในรูปแบบ JSON เท่านั้น โดยไม่มีข้อความอื่นใด

Intent ที่รองรับ:
- RAG_QUERY: ถามคำถามธรรมชาติ ต้องการคำตอบจากเอกสาร
- GET_RFA: ต้องการดู/ค้นหา RFA (Request for Approval)
- GET_DRAWING: ต้องการดู Drawing หรือแบบ
- GET_TRANSMITTAL: ต้องการดู Transmittal
- GET_CORRESPONDENCE: ต้องการดู Correspondence หรือจดหมาย
- GET_CIRCULATION: ต้องการดู Circulation
- GET_RFA_DRAWINGS: ต้องการ Drawings ที่ผูกกับ RFA
- SUMMARIZE_DOCUMENT: ต้องการสรุปเอกสาร
- LIST_OVERDUE: ต้องการรายการที่เกินกำหนด
- SUGGEST_METADATA: ต้องการคำแนะนำ metadata
- SUGGEST_ACTION: ต้องการคำแนะนำว่าควรทำอะไรต่อ
- FALLBACK: ไม่เกี่ยวกับระบบ หรือไม่เข้า intent ไหน

ตอบในรูปแบบ JSON: {"intent":"INTENT_CODE","confidence":0.95}`;

/**
 * Service สำหรับเรียก Ollama LLM เพื่อ Classify Intent
 * ใช้เฉพาะเมื่อ Pattern Match ล้มเหลว (LLM Fallback)
 * ADR-023A: Ollama บน Admin Desktop เท่านั้น
 */
@Injectable()
export class OllamaClientService {
  private readonly logger = new Logger(OllamaClientService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      this.configService.get<string>('AI_HOST_URL', 'http://localhost:11434')
    );
    this.model = this.configService.get<string>(
      'OLLAMA_INTENT_MODEL',
      this.configService.get<string>('OLLAMA_MODEL_MAIN', 'gemma4:e4b')
    );
    this.timeoutMs = this.configService.get<number>(
      'OLLAMA_INTENT_TIMEOUT_MS',
      5000
    );
  }

  /**
   * ส่ง query ไปยัง Ollama เพื่อ Classify Intent
   * @returns LlmIntentResult หรือ null หากเกิด error / timeout
   */
  async classifyIntent(query: string): Promise<LlmIntentResult | null> {
    try {
      const response = await axios.post<OllamaGenerateResponse>(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          system: SYSTEM_PROMPT,
          prompt: query,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 50,
          },
        },
        { timeout: this.timeoutMs }
      );

      return this.parseResponse(response.data.response);
    } catch (err) {
      if (err instanceof AxiosError) {
        this.logger.warn(
          `Ollama intent classification failed: ${err.code ?? 'UNKNOWN'} — ${err.message}`
        );
      } else {
        this.logger.error(
          'Unexpected error calling Ollama',
          err instanceof Error ? err.stack : String(err)
        );
      }
      return null;
    }
  }

  /** Parse JSON response จาก Ollama */
  private parseResponse(raw: string): LlmIntentResult | null {
    try {
      // Ollama อาจ wrap ด้วย markdown code block
      const cleaned = raw
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      if (
        typeof parsed.intent !== 'string' ||
        typeof parsed.confidence !== 'number'
      ) {
        this.logger.warn(`Invalid LLM response format: ${raw}`);
        return null;
      }

      return {
        intent: parsed.intent,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
      };
    } catch {
      this.logger.warn(`Failed to parse Ollama response: ${raw}`);
      return null;
    }
  }
}
