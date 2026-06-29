// File: src/modules/ai/intent-classifier/services/llm-semaphore.service.ts
// Change Log
// - 2026-05-19: สร้าง Semaphore สำหรับควบคุม concurrent LLM calls (ADR-024).

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Semaphore Pattern สำหรับจำกัด concurrent LLM calls
 * ป้องกัน GPU overload บน Admin Desktop (ADR-023A)
 * ใช้ Promise-based queue แทน p-limit เพื่อลด dependency
 */
@Injectable()
export class LlmSemaphoreService {
  private readonly logger = new Logger(LlmSemaphoreService.name);
  private readonly maxConcurrent: number;
  private currentCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly configService: ConfigService) {
    this.maxConcurrent = this.configService.get<number>(
      'INTENT_CLASSIFIER_LLM_SEMAPHORE',
      3
    );
    this.logger.log(
      `LLM Semaphore initialized: max ${this.maxConcurrent} concurrent`
    );
  }

  /** จำนวน requests ที่กำลังประมวลผลอยู่ */
  get activeCount(): number {
    return this.currentCount;
  }

  /** จำนวน requests ที่รอใน queue */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** ตรวจสอบว่า semaphore เต็มหรือไม่ */
  get isFull(): boolean {
    return this.currentCount >= this.maxConcurrent;
  }

  /**
   * Acquire semaphore slot — รอถ้าเต็ม
   * @returns release function ที่ต้องเรียกเมื่อเสร็จ
   */
  async acquire(): Promise<() => void> {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return this.createRelease();
    }

    // รอจนกว่าจะมี slot ว่าง
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.currentCount++;
        resolve(this.createRelease());
      });
    });
  }

  /**
   * Try acquire — ไม่รอ ถ้าเต็มจะ return null ทันที
   * ใช้สำหรับ semaphore_overflow fallback
   */
  tryAcquire(): (() => void) | null {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return this.createRelease();
    }
    return null;
  }

  /** สร้าง release function (เรียกได้ครั้งเดียว) */
  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.currentCount--;

      // ปล่อย request ถัดไปใน queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    };
  }
}
