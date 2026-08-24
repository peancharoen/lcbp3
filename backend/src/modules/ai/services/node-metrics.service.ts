// File: backend/src/modules/ai/services/node-metrics.service.ts
// Change Log:
// - 2026-08-24: ADR-048 T005 — สร้าง NodeMetricsService สำหรับ AI Engine Control Center
//   ดึงข้อมูล host metrics จาก node-exporter :9100/metrics ทุก 10 วินาที
//   คำนวณ CPU% จาก Delta counter, บันทึก 15-point rolling history ใน Redis

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import Redis from 'ioredis';
import type {
  GetHostMetricsResponseDto,
  HostMetricsHistoryPointDto,
} from '../dto/host-metrics.dto';

/** Prometheus text format: CPU seconds per mode */
interface CpuSampleEntry {
  cpu: string;
  mode: string;
  value: number;
}

/** Raw CPU snapshot จาก node-exporter สำหรับ Delta calculation */
interface RawCpuSnapshot {
  timestamp: number;
  entries: CpuSampleEntry[];
}

/** Redis key สำหรับ host metrics (ADR-048 data model) */
const REDIS_KEYS = {
  /** Raw CPU counters จาก node-exporter scrape ล่าสุด */
  RAW_LAST_CPU: 'ai:metrics:raw:last_cpu',
  /** Snapshot สุดท้ายที่คำนวณแล้ว */
  HOST_SUMMARY: 'ai:metrics:host_summary',
  /** Rolling 15-point history list (LPUSH/LTRIM) */
  HOST_HISTORY: 'ai:metrics:host_history',
} as const;

/** TTL สำหรับ Redis keys */
const SUMMARY_TTL_SECONDS = 30;
const RAW_CPU_TTL_SECONDS = 30;
/** จำนวน data points สูงสุดใน rolling history */
const HISTORY_MAX_POINTS = 15;

/**
 * NodeMetricsService
 * พอลข้อมูล host-level telemetry จาก node-exporter ทุก 10 วินาที
 * คำนวณ CPU% ด้วย Delta monotonic counter (ไม่ใช่ snapshot)
 * บันทึก history 15 จุดใน Redis List สำหรับ Sparkline chart
 */
@Injectable()
export class NodeMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NodeMetricsService.name);
  private readonly nodeExporterUrl: string;
  /** flag: ครั้งแรกหลัง boot ยังไม่มี Delta ให้คำนวณ */
  private isFirstPoll = true;

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.nodeExporterUrl = this.configService.get<string>(
      'NODE_EXPORTER_URL',
      'http://192.168.10.11:9100'
    );
  }

  /** เริ่มต้น: ล้าง raw CPU snapshot เก่าเมื่อ module init */
  async onModuleInit(): Promise<void> {
    await this.redis.del(REDIS_KEYS.RAW_LAST_CPU);
    this.logger.log(
      'NodeMetricsService initialized — raw CPU snapshot cleared'
    );
  }

  /** ทำความสะอาด: ไม่ต้องทำอะไรพิเศษ */
  async onModuleDestroy(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * Background poller รันทุก 10 วินาที
   * ดึงข้อมูลจาก node-exporter แล้วคำนวณ host metrics
   */
  @Interval(10_000)
  async pollMetrics(): Promise<void> {
    try {
      const raw = await this.fetchNodeExporterMetrics();
      if (!raw) {
        return;
      }

      // คำนวณ CPU% จาก Delta
      const cpuResult = await this.computeCpuPercentage(raw);
      const memoryResult = this.computeMemory(raw);
      const temperatureResult = this.computeTemperature(raw);

      const snapshot: GetHostMetricsResponseDto = {
        timestamp: new Date().toISOString(),
        cpu: cpuResult.cpu,
        memory: memoryResult,
        temperature: temperatureResult,
        isEstimated: cpuResult.isEstimated,
        history: [],
      };

      // บันทึก summary snapshot ลง Redis
      await this.redis.setex(
        REDIS_KEYS.HOST_SUMMARY,
        SUMMARY_TTL_SECONDS,
        JSON.stringify(snapshot)
      );

      // เพิ่ม history point (LPUSH = newest first, LTRIM ไม่เกิน 15)
      const historyPoint: HostMetricsHistoryPointDto = {
        timestamp: snapshot.timestamp,
        cpuPercentage: snapshot.cpu.overallPercentage,
        memoryPercentage: snapshot.memory.usedPercentage,
        temperatureCelsius: snapshot.temperature.cpuCelsius,
      };
      await this.redis.lpush(
        REDIS_KEYS.HOST_HISTORY,
        JSON.stringify(historyPoint)
      );
      await this.redis.ltrim(
        REDIS_KEYS.HOST_HISTORY,
        0,
        HISTORY_MAX_POINTS - 1
      );
    } catch (err: unknown) {
      this.logger.warn(
        `NodeMetrics poll failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * ดึงข้อมูล host metrics ล่าสุดจาก Redis
   * Response time < 5ms จาก Redis (ไม่ scrape node-exporter โดยตรง)
   */
  async getHostMetrics(): Promise<GetHostMetricsResponseDto | null> {
    const summaryJson = await this.redis.get(REDIS_KEYS.HOST_SUMMARY);
    if (!summaryJson) {
      return null;
    }
    const summary = JSON.parse(summaryJson) as GetHostMetricsResponseDto;

    // ดึง history (LRANGE 0 14 = oldest → newest จาก Redis List)
    const historyRaw = await this.redis.lrange(
      REDIS_KEYS.HOST_HISTORY,
      0,
      HISTORY_MAX_POINTS - 1
    );
    // history ใน Redis เรียงแบบ newest-first (LPUSH) → reverse เพื่อแสดง oldest-first
    const history = historyRaw
      .map((item) => JSON.parse(item) as HostMetricsHistoryPointDto)
      .reverse();

    return { ...summary, history };
  }

  /** ดึง Prometheus text format จาก node-exporter */
  private async fetchNodeExporterMetrics(): Promise<string | null> {
    try {
      const response = await axios.get<string>(
        `${this.nodeExporterUrl}/metrics`,
        {
          timeout: 5000,
          responseType: 'text',
        }
      );
      return response.data;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to reach node-exporter at ${this.nodeExporterUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null;
    }
  }

  /** Parse Prometheus text format สำหรับ metric name ที่กำหนด */
  private parseMetricLines(
    raw: string,
    metricName: string
  ): Array<{ labels: Record<string, string>; value: number }> {
    const result: Array<{ labels: Record<string, string>; value: number }> = [];
    const lines = raw.split('\n');
    for (const line of lines) {
      if (line.startsWith('#') || !line.startsWith(metricName)) {
        continue;
      }
      // Parse: metric_name{label="value",...} number หรือ metric_name number
      const match = line.match(
        /^(\w+)(?:\{([^}]*)\})?\s+([\d.e+-]+)(?:\s.*)?$/
      );
      if (!match) {
        continue;
      }
      const labelStr = match[2] ?? '';
      const value = parseFloat(match[3]);
      if (isNaN(value)) {
        continue;
      }
      const labels: Record<string, string> = {};
      for (const part of labelStr.split(',')) {
        const [key, val] = part.split('=');
        if (key && val) {
          labels[key.trim()] = val.replace(/"/g, '').trim();
        }
      }
      result.push({ labels, value });
    }
    return result;
  }

  /**
   * คำนวณ CPU% จาก Delta monotonic counter ตาม ADR-048:
   * CPU% = 100 * (1 - Δidle / Δtotal)
   * ครั้งแรกหลัง boot จะใช้ node_load1 เป็น fallback (isEstimated=true)
   */
  private async computeCpuPercentage(raw: string): Promise<{
    cpu: GetHostMetricsResponseDto['cpu'];
    isEstimated: boolean;
  }> {
    const cpuLines = this.parseMetricLines(raw, 'node_cpu_seconds_total');

    // สร้าง snapshot ปัจจุบัน
    const current: RawCpuSnapshot = {
      timestamp: Date.now(),
      entries: cpuLines.map((l) => ({
        cpu: l.labels['cpu'] ?? '0',
        mode: l.labels['mode'] ?? 'unknown',
        value: l.value,
      })),
    };

    // ดึง snapshot ก่อนหน้าจาก Redis
    const prevJson = await this.redis.get(REDIS_KEYS.RAW_LAST_CPU);

    // บันทึก snapshot ปัจจุบันสำหรับรอบถัดไป
    await this.redis.setex(
      REDIS_KEYS.RAW_LAST_CPU,
      RAW_CPU_TTL_SECONDS,
      JSON.stringify(current)
    );

    // ถ้าไม่มี previous snapshot → ใช้ load1 fallback
    if (!prevJson || this.isFirstPoll) {
      this.isFirstPoll = false;
      const load1 = this.parseMetricLines(raw, 'node_load1');
      const loadValue = load1[0]?.value ?? 0;
      // จำนวน core จาก CPU entries unique (เพื่อ normalize load1)
      const coreSet = new Set(current.entries.map((e) => e.cpu));
      const coreCount = Math.max(coreSet.size, 1);
      // load1 estimate: min(100, load1 / cores * 100)
      const estimatedPct = Math.min(100, (loadValue / coreCount) * 100);
      return {
        cpu: {
          overallPercentage: Math.round(estimatedPct * 10) / 10,
          coreCount,
          perCorePercentage: Array.from({ length: coreCount }).fill(
            estimatedPct
          ) as number[],
        },
        isEstimated: true,
      };
    }

    this.isFirstPoll = false;
    const prev = JSON.parse(prevJson) as RawCpuSnapshot;

    // คำนวณ Delta ต่อ core
    const coreSet = new Set(current.entries.map((e) => e.cpu));
    const coreCount = Math.max(coreSet.size, 1);
    const perCorePcts: number[] = [];

    for (const core of coreSet) {
      const currentEntries = current.entries.filter((e) => e.cpu === core);
      const prevEntries = prev.entries.filter((e) => e.cpu === core);

      let deltaTotal = 0;
      let deltaIdle = 0;

      for (const cur of currentEntries) {
        const p = prevEntries.find((pe) => pe.mode === cur.mode);
        const delta = cur.value - (p?.value ?? cur.value);
        deltaTotal += Math.max(0, delta);
        if (cur.mode === 'idle') {
          deltaIdle += Math.max(0, delta);
        }
      }

      const pct =
        deltaTotal > 0
          ? Math.max(0, Math.min(100, (1 - deltaIdle / deltaTotal) * 100))
          : 0;
      perCorePcts.push(Math.round(pct * 10) / 10);
    }

    const overallPct =
      perCorePcts.length > 0
        ? perCorePcts.reduce((a, b) => a + b, 0) / perCorePcts.length
        : 0;

    return {
      cpu: {
        overallPercentage: Math.round(overallPct * 10) / 10,
        coreCount,
        perCorePercentage: perCorePcts,
      },
      isEstimated: false,
    };
  }

  /** คำนวณ Memory metrics จาก node_memory_* */
  private computeMemory(raw: string): GetHostMetricsResponseDto['memory'] {
    const memTotal = this.parseMetricLines(raw, 'node_memory_MemTotal_bytes');
    const memAvail = this.parseMetricLines(
      raw,
      'node_memory_MemAvailable_bytes'
    );

    const totalBytes = memTotal[0]?.value ?? 0;
    const availableBytes = memAvail[0]?.value ?? 0;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usedPercentage =
      totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100 * 10) / 10 : 0;

    return { totalBytes, usedBytes, availableBytes, usedPercentage };
  }

  /**
   * คำนวณ CPU temperature จาก node_hwmon_temp_celsius
   * Heuristic: เลือก sensor ที่มีค่า label 'sensor' ที่น่าเชื่อถือที่สุด
   * Priority: coretemp > k10temp > cpu_thermal > sensor ใดก็ตามที่ไม่ใช่ acpitz
   */
  private computeTemperature(
    raw: string
  ): GetHostMetricsResponseDto['temperature'] {
    const tempLines = this.parseMetricLines(raw, 'node_hwmon_temp_celsius');
    if (tempLines.length === 0) {
      return { cpuCelsius: null, sensorName: null };
    }

    // Filter: รับเฉพาะอุณหภูมิ 10–120°C (ช่วง valid สำหรับ CPU)
    const validLines = tempLines.filter((l) => l.value >= 10 && l.value <= 120);
    if (validLines.length === 0) {
      return { cpuCelsius: null, sensorName: null };
    }

    // เลือก sensor ที่ดีที่สุด (heuristic priority)
    const PRIORITY_SENSORS = ['coretemp', 'k10temp', 'cpu_thermal'];
    let selected = validLines[0];
    for (const sensor of PRIORITY_SENSORS) {
      const found = validLines.find((l) =>
        (l.labels['chip'] ?? l.labels['sensor'] ?? '')
          .toLowerCase()
          .includes(sensor)
      );
      if (found) {
        selected = found;
        break;
      }
    }

    const sensorName =
      selected.labels['chip'] ?? selected.labels['sensor'] ?? 'unknown';

    return {
      cpuCelsius: Math.round(selected.value * 10) / 10,
      sensorName,
    };
  }
}
