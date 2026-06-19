// File: backend/src/modules/ai/services/vram-monitor.service.ts
// Change Log:
// - 2026-06-11: Initial creation of VramMonitorService to monitor VRAM headroom from Ollama /api/ps
// - 2026-06-11: เพิ่มการคำนวณ mainModelVramMb ใน getVramHeadroom
// - 2026-06-11: เพิ่ม getVramStatus และ invalidateCache เพื่อความเข้ากันได้กับส่วนอื่น

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { VramHeadroom } from '../interfaces/execution-policy.interface';

/**
 * ผลลัพธ์ VRAM status สำหรับส่วนบริการภายนอก
 * ผลลัพธ์นี้มีวัตถุประสงค์เพื่อรักษาความเข้ากันได้ย้อนหลัง (Backward Compatibility)
 */
export interface VramStatus {
  totalVramMb: number;
  usedVramMb: number;
  freeVramMb: number;
  loadedModels: Array<{
    modelId: string;
    modelName: string;
    vramUsageMB: number;
  }>;
  hasCapacity: boolean;
}

@Injectable()
export class VramMonitorService {
  private readonly logger = new Logger(VramMonitorService.name);
  private readonly ollamaUrl: string;
  private readonly totalVramMb: number;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>(
        'AI_HOST_URL',
        'http://192.168.10.100:11434'
      )
    );
    this.totalVramMb = this.configService.get<number>(
      'GPU_TOTAL_VRAM_MB',
      16384 // Default to 16GB (RTX 5060 Ti)
    );
  }

  /**
   * ดึงสถานะ VRAM headroom จาก Ollama /api/ps
   * ถ้าล้มเหลวจะคืนค่าด้วย safe default (available = 0)
   */
  async getVramHeadroom(): Promise<VramHeadroom> {
    try {
      const response = await axios.get<{
        models?: Array<{
          name: string;
          size_vram: number;
        }>;
      }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
      const models = response.data?.models ?? [];
      let totalUsedBytes = 0;
      let mainModelUsedBytes = 0;
      for (const model of models) {
        totalUsedBytes += model.size_vram || 0;
        if (
          model.name.includes('np-dms-ai') ||
          model.name.includes('typhoon2.5-np-dms')
        ) {
          mainModelUsedBytes += model.size_vram || 0;
        }
      }
      const usedMb = Math.round(totalUsedBytes / (1024 * 1024));
      const availableMb = Math.max(0, this.totalVramMb - usedMb);
      const mainModelVramMb = Math.round(mainModelUsedBytes / (1024 * 1024));
      return {
        totalMb: this.totalVramMb,
        usedMb,
        availableMb,
        querySuccess: true,
        mainModelVramMb,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to query Ollama /api/ps: ${err instanceof Error ? err.message : String(err)}`
      );
      // เปลี่ยนจาก pessimistic (assume all VRAM used) เป็น optimistic (assume no VRAM used)
      // เพื่อป้องกัน false positive OOM Guard เมื่อ query ล้มเหลวแต่ไม่มี model load จริง
      return {
        totalMb: this.totalVramMb,
        usedMb: 0, // สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
        availableMb: this.totalVramMb,
        querySuccess: false,
        mainModelVramMb: 0,
      };
    }
  }

  /**
   * ดึงสถานะ VRAM ปัจจุบันของระบบ
   * เพื่อความเข้ากันได้ย้อนหลังกับ endpoint vram/status
   */
  async getVramStatus(minRequiredMb = 4000): Promise<VramStatus> {
    try {
      const response = await axios.get<{
        models?: Array<{
          name: string;
          size_vram: number;
        }>;
      }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
      const models = response.data?.models ?? [];
      const loadedModels = models.map((m) => ({
        modelId: m.name,
        modelName: m.name,
        vramUsageMB: Math.round((m.size_vram || 0) / (1024 * 1024)),
      }));
      const headroom = await this.getVramHeadroom();
      return {
        totalVramMb: headroom.totalMb,
        usedVramMb: headroom.usedMb,
        freeVramMb: headroom.availableMb,
        loadedModels,
        hasCapacity: headroom.availableMb >= minRequiredMb,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to get VRAM status: ${err instanceof Error ? err.message : String(err)}`
      );
      // เปลี่ยนจาก pessimistic เป็น optimistic: สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
      return {
        totalVramMb: this.totalVramMb,
        usedVramMb: 0,
        freeVramMb: this.totalVramMb,
        loadedModels: [],
        hasCapacity: true, // สมมติว่ามี capacity เมื่อ query ล้มเหลว
      };
    }
  }

  /**
   * ตรวจสอบว่า VRAM เพียงพอสำหรับความต้องการโหลดโมเดลหรือไม่
   */
  async hasVramCapacity(requiredMb: number): Promise<boolean> {
    const headroom = await this.getVramHeadroom();
    return headroom.availableMb >= requiredMb;
  }

  /**
   * ล้าง cache VRAM (ไม่มี cache แล้วในระบบใหม่ แต่เก็บไว้เพื่อรองรับการเรียกใช้เดิม)
   */
  async invalidateCache(): Promise<void> {
    await Promise.resolve();
    this.logger.log('VRAM cache invalidation requested (no-op in new policy)');
  }
}
