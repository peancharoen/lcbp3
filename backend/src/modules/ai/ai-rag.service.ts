// File: backend/src/modules/ai/ai-rag.service.ts
// Change Log
// - 2026-05-14: เพิ่ม AiRagService สำหรับ BullMQ-backed RAG pipeline ตาม ADR-023 Phase 4.
// - 2026-05-14: แก้ไข corruption ในไฟล์ทั้งหมด — rewrite clean version.
// - 2026-05-14: ย้าย PROMPT_CONTEXT_LIMIT เป็น instance field ที่อ่านจาก RAG_CONTEXT_LIMIT_CHARS (💡 S1).
// - 2026-06-05: ปรับปรุงใช้ Hybrid Search + Reranker ผ่าน Sidecar ตาม ADR-035 (T015, T030)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import axios from 'axios';
import { AiQdrantService } from './qdrant.service';
import { OcrService } from './services/ocr.service';

/** ผลลัพธ์ของ RAG query แต่ละรายการที่ถูก reference ในคำตอบ */
export interface AiRagCitation {
  pointId: string | number;
  score: number;
  docType?: string;
  docNumber?: string;
  snippet?: string;
}

/** ผลลัพธ์สมบูรณ์ของ RAG job ที่เก็บใน Redis */
export interface AiRagJobResult {
  requestPublicId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  answer?: string;
  citations?: AiRagCitation[];
  confidence?: number;
  usedFallbackModel?: boolean;
  errorMessage?: string;
  completedAt?: string;
}

/** TTL สำหรับ Redis result key (5 นาที) */
const RAG_RESULT_TTL_SECONDS = 300;
/** TTL สำหรับ Redis active-job key ต่อ user (5 นาที) */
const RAG_ACTIVE_JOB_TTL_SECONDS = 300;

/** บริการหลักสำหรับประมวลผล RAG query ผ่าน Ollama และ Qdrant (ADR-023) */
@Injectable()
export class AiRagService {
  private readonly logger = new Logger(AiRagService.name);
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly timeoutMs: number;
  /** จำนวนอักขระสูงสุดของ context ที่ส่งให้ LLM — ปรับได้ผ่าน RAG_CONTEXT_LIMIT_CHARS */
  private readonly promptContextLimit: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly qdrantService: AiQdrantService,
    private readonly ocrService: OcrService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434'
    );
    this.ollamaModel = this.configService.get<string>(
      'OLLAMA_RAG_MODEL',
      'gemma2'
    );
    this.timeoutMs = this.configService.get<number>('RAG_TIMEOUT_MS', 30000);
    this.promptContextLimit = this.configService.get<number>(
      'RAG_CONTEXT_LIMIT_CHARS',
      3000
    );
  }

  // ─── Job State Management ────────────────────────────────────────────────────

  /** กำหนด result key สำหรับ Redis */
  private resultKey(requestPublicId: string): string {
    return `ai:rag:result:${requestPublicId}`;
  }

  /** กำหนด active-job key ต่อ user สำหรับ FR-009 (1 active job per user) */
  private activeJobKey(userPublicId: string): string {
    return `ai:rag:active:${userPublicId}`;
  }

  /** กำหนด cancel-flag key สำหรับ T022 (AbortController) */
  cancelKey(requestPublicId: string): string {
    return `ai:rag:cancel:${requestPublicId}`;
  }

  /** ตรวจสอบว่า user มี active job อยู่ หรือไม่ (FR-009) */
  async getActiveJob(userPublicId: string): Promise<string | null> {
    return this.redis.get(this.activeJobKey(userPublicId));
  }

  /** ลงทะเบียน job ใหม่ให้ user เพื่อ enforce FR-009 */
  async registerActiveJob(
    userPublicId: string,
    requestPublicId: string
  ): Promise<void> {
    await this.redis.setex(
      this.activeJobKey(userPublicId),
      RAG_ACTIVE_JOB_TTL_SECONDS,
      requestPublicId
    );
    await this.saveJobResult({
      requestPublicId,
      status: 'pending',
    });
  }

  /** บันทึกผลลัพธ์ job ลง Redis */
  async saveJobResult(result: AiRagJobResult): Promise<void> {
    await this.redis.setex(
      this.resultKey(result.requestPublicId),
      RAG_RESULT_TTL_SECONDS,
      JSON.stringify(result)
    );
  }

  /** ดึงผลลัพธ์ job จาก Redis */
  async getJobResult(requestPublicId: string): Promise<AiRagJobResult | null> {
    const raw = await this.redis.get(this.resultKey(requestPublicId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AiRagJobResult;
    } catch {
      this.logger.warn(
        `Corrupted RAG result in Redis — requestPublicId=${requestPublicId}`
      );
      return null;
    }
  }

  /** ยกเลิก job โดยตั้ง cancel flag ใน Redis */
  async cancelJob(requestPublicId: string): Promise<void> {
    await this.redis.setex(
      this.cancelKey(requestPublicId),
      RAG_RESULT_TTL_SECONDS,
      '1'
    );
    const current = await this.getJobResult(requestPublicId);
    if (
      current &&
      (current.status === 'pending' || current.status === 'processing')
    ) {
      await this.saveJobResult({ ...current, status: 'cancelled' });
    }
  }

  /** ลบ active-job ของ user เมื่อ job เสร็จหรือถูกยกเลิก */
  async clearActiveJob(userPublicId: string): Promise<void> {
    await this.redis.del(this.activeJobKey(userPublicId));
  }

  // ─── Core Processing ─────────────────────────────────────────────────────────

  /**
   * ประมวลผล RAG query:
   * 1. Embed คำถามด้วย BGE-M3 (Dense + Sparse) ผ่าน Sidecar /embed (T015)
   * 2. ค้นหา Qdrant ด้วย Hybrid Search + project isolation (T015)
   * 3. Rerank ด้วย BGE-Reranker-Large ผ่าน Sidecar /rerank (T015)
   * 4. Build prompt จาก context
   * 5. Generate คำตอบผ่าน Ollama
   */
  async processQuery(
    requestPublicId: string,
    question: string,
    projectPublicId: string,
    userPublicId: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.saveJobResult({ requestPublicId, status: 'processing' });

    try {
      // ตรวจสอบว่าถูกยกเลิกก่อนเริ่มทำงาน
      const cancelFlag = await this.redis.get(this.cancelKey(requestPublicId));
      if (cancelFlag || signal?.aborted) {
        await this.saveJobResult({ requestPublicId, status: 'cancelled' });
        await this.clearActiveJob(userPublicId);
        return;
      }

      // 1. สร้าง embedding สำหรับคำถามด้วย BGE-M3 ผ่าน Sidecar
      const embedResult = await this.ocrService.embedViaSidecar(question);

      // ตรวจสอบ cancel อีกครั้งหลัง embed
      if (
        signal?.aborted ||
        (await this.redis.get(this.cancelKey(requestPublicId)))
      ) {
        await this.saveJobResult({ requestPublicId, status: 'cancelled' });
        await this.clearActiveJob(userPublicId);
        return;
      }

      // 2. ค้นหา Qdrant ด้วย Hybrid search และกรองตาม project
      const searchResults = await this.qdrantService.searchByProject(
        embedResult.dense,
        embedResult.sparse,
        projectPublicId,
        15 // topK=15 ตาม FR-014
      );

      // ตรวจสอบ cancel หลัง search
      if (
        signal?.aborted ||
        (await this.redis.get(this.cancelKey(requestPublicId)))
      ) {
        await this.saveJobResult({ requestPublicId, status: 'cancelled' });
        await this.clearActiveJob(userPublicId);
        return;
      }

      // 3. Rerank ผลลัพธ์การค้นหา
      let finalResults = searchResults;
      const rawChunks = searchResults
        .map(
          (r) =>
            (r.payload['chunk_text'] as string) ||
            (r.payload['content_preview'] as string) ||
            ''
        )
        .filter((c) => c.trim().length > 0);

      if (rawChunks.length > 0) {
        this.logger.log(
          `Calling Sidecar /rerank for ${rawChunks.length} candidates...`
        );
        const rerankResult = await this.ocrService.rerankViaSidecar(
          question,
          rawChunks
        );

        // เลือก top 3-5 chunks ที่ได้คะแนนสูงสุด
        const topN = Math.min(5, rerankResult.ranked_indices.length);
        finalResults = [];
        for (let i = 0; i < topN; i++) {
          const originalIndex = rerankResult.ranked_indices[i];
          finalResults.push(searchResults[originalIndex]);
        }

        // Log รายละเอียดการจัดอันดับ (T030)
        this.logger.log(
          `Reranking completed: candidates input ${searchResults.length} -> output ${finalResults.length}. ` +
            `Top-1 score: ${rerankResult.scores[rerankResult.ranked_indices[0]]?.toFixed(4) ?? 'N/A'}`
        );
      }

      // 4. สร้าง context จาก search results
      const context = this.buildContext(finalResults);

      // ตรวจสอบ cancel ก่อนเรียก LLM
      if (
        signal?.aborted ||
        (await this.redis.get(this.cancelKey(requestPublicId)))
      ) {
        await this.saveJobResult({ requestPublicId, status: 'cancelled' });
        await this.clearActiveJob(userPublicId);
        return;
      }

      // 5. Generate คำตอบผ่าน Ollama
      const { answer, usedFallback } = await this.generateAnswer(
        this.sanitizeInput(question),
        context,
        signal
      );

      const citations: AiRagCitation[] = finalResults.map((r) => ({
        pointId: r.pointId,
        score: r.score,
        docType: r.payload['doc_type'] as string | undefined,
        docNumber: r.payload['doc_number'] as string | undefined,
        snippet: (
          (r.payload['chunk_text'] as string) ||
          (r.payload['content_preview'] as string) ||
          ''
        ).slice(0, 200),
      }));

      const confidence = finalResults.length > 0 ? finalResults[0].score : 0;

      await this.saveJobResult({
        requestPublicId,
        status: 'completed',
        answer,
        citations,
        confidence,
        usedFallbackModel: usedFallback,
        completedAt: new Date().toISOString(),
      });

      this.logger.log(
        `RAG query completed — requestPublicId=${requestPublicId}, confidence=${confidence.toFixed(3)}`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `RAG query failed — requestPublicId=${requestPublicId}: ${errMsg}`
      );
      await this.saveJobResult({
        requestPublicId,
        status: 'failed',
        errorMessage: errMsg,
        completedAt: new Date().toISOString(),
      });
    } finally {
      await this.clearActiveJob(userPublicId);
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /** Generate คำตอบจาก Ollama */
  private async generateAnswer(
    question: string,
    context: string,
    signal?: AbortSignal
  ): Promise<{ answer: string; usedFallback: boolean }> {
    const prompt = this.buildPrompt(question, context);
    try {
      const response = await axios.post<{ response: string }>(
        `${this.ollamaUrl}/api/generate`,
        { model: this.ollamaModel, prompt, stream: false },
        { timeout: this.timeoutMs, signal }
      );
      return { answer: response.data.response ?? '', usedFallback: false };
    } catch (err: unknown) {
      if (
        axios.isCancel(err) ||
        (err instanceof Error && err.name === 'CanceledError')
      ) {
        throw err;
      }
      this.logger.warn(
        `Ollama generation failed — model=${this.ollamaModel}: ${err instanceof Error ? err.message : String(err)}`
      );
      return { answer: 'ไม่พบข้อมูลในเอกสารที่ระบุ', usedFallback: true };
    }
  }

  /** สร้าง context string จาก search results ให้ไม่เกิน PROMPT_CONTEXT_LIMIT */
  private buildContext(
    results: Array<{ payload: Record<string, unknown> }>
  ): string {
    let context = '';
    for (const r of results) {
      const docType = (r.payload['doc_type'] as string) ?? '';
      const docNumber = (r.payload['doc_number'] as string) ?? '';
      const preview =
        (r.payload['chunk_text'] as string) ??
        (r.payload['content_preview'] as string) ??
        '';
      const header = `[${docType}${docNumber ? ` - ${docNumber}` : ''}]`;
      const snippet = `${header}\n${preview}\n\n`;
      if ((context + snippet).length > this.promptContextLimit) break;
      context += snippet;
    }
    return context.trim();
  }

  /** สร้าง prompt สำหรับ LLM ตาม RAG pattern ของโครงการ */
  private buildPrompt(question: string, context: string): string {
    return [
      'คุณเป็นผู้ช่วยผู้เชี่ยวชาญด้านเอกสารโครงการก่อสร้าง',
      'ตอบคำถามโดยอ้างอิงจากเอกสารที่ให้มาเท่านั้น ห้ามตอบจากความรู้ทั่วไป',
      'หากข้อมูลในเอกสารไม่เพียงพอ ให้แจ้งว่า "ไม่พบข้อมูลในเอกสารที่ระบุ"',
      '',
      '=== เอกสารอ้างอิง ===',
      context,
      '',
      '=== คำถาม ===',
      question,
    ].join('\n');
  }

  /** กรอง input เพื่อป้องกัน prompt injection */
  private sanitizeInput(text: string): string {
    return text
      .replace(/<CONTEXT_START>|<CONTEXT_END>/gi, '')
      .replace(/ignore previous instructions/gi, '')
      .replace(/system:/gi, '')
      .slice(0, 500);
  }
}
