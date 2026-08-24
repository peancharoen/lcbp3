// File: backend/src/modules/ai/services/node-metrics.service.spec.ts
// Change Log:
// - 2026-08-24: ADR-048 T020 — สร้าง unit tests สำหรับ NodeMetricsService

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NodeMetricsService } from './node-metrics.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NodeMetricsService', () => {
  let service: NodeMetricsService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const config: Record<string, unknown> = {
        NODE_EXPORTER_URL: 'http://192.168.10.11:9100',
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  const store = new Map<string, { value: string; ttl?: number }>();

  const mockRedis = {
    get: jest.fn((key: string) =>
      Promise.resolve(store.get(key)?.value ?? null)
    ),
    setex: jest.fn((key: string, ttl: number, value: string) => {
      store.set(key, { value, ttl });
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    lpush: jest.fn((key: string, value: string) => {
      const current = store.get(key)?.value ?? '[]';
      const arr = JSON.parse(current) as string[];
      arr.unshift(value);
      store.set(key, { value: JSON.stringify(arr) });
      return Promise.resolve(arr.length);
    }),
    ltrim: jest.fn((key: string, start: number, end: number) => {
      const current = store.get(key)?.value ?? '[]';
      const arr = JSON.parse(current) as string[];
      const trimmed = arr.slice(start, end + 1);
      store.set(key, { value: JSON.stringify(trimmed) });
      return Promise.resolve('OK');
    }),
    lrange: jest.fn((key: string, start: number, end: number) => {
      const current = store.get(key)?.value ?? '[]';
      const arr = JSON.parse(current) as string[];
      return Promise.resolve(arr.slice(start, end + 1));
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    store.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeMetricsService,
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();
    service = module.get<NodeMetricsService>(NodeMetricsService);
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('ควรลบ raw CPU snapshot เก่าเมื่อ init', async () => {
      await service.onModuleInit();
      expect(mockRedis.del).toHaveBeenCalledWith('ai:metrics:raw:last_cpu');
    });
  });

  describe('pollMetrics', () => {
    it('ควรบันทึก host summary และ history ลง Redis เมื่อ node-exporter ตอบกลับ', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: sampleMetricsFirstPoll(),
      });

      await service.pollMetrics();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://192.168.10.11:9100/metrics',
        { timeout: 5000, responseType: 'text' }
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'ai:metrics:host_summary',
        30,
        expect.stringContaining('isEstimated')
      );
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'ai:metrics:host_history',
        expect.any(String)
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        'ai:metrics:host_history',
        0,
        14
      );
    });

    it('ควรใช้ estimated CPU จาก node_load1 ในครั้งแรก (cold start)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: sampleMetricsFirstPoll(),
      });

      await service.pollMetrics();

      const summary = await service.getHostMetrics();
      expect(summary).not.toBeNull();
      expect(summary?.isEstimated).toBe(true);
      expect(summary?.cpu.overallPercentage).toBeGreaterThanOrEqual(0);
      expect(summary?.cpu.coreCount).toBe(2);
    });

    it('ควรคำนวณ CPU% จาก Delta เมื่อมี snapshot ก่อนหน้า', async () => {
      // ครั้งที่ 1 — สร้าง baseline
      mockedAxios.get.mockResolvedValueOnce({ data: sampleMetricsFirstPoll() });
      await service.pollMetrics();

      // ครั้งที่ 2 — เพิ่ม counter idle
      mockedAxios.get.mockResolvedValueOnce({
        data: sampleMetricsSecondPoll(),
      });
      await service.pollMetrics();

      const summary = await service.getHostMetrics();
      expect(summary?.isEstimated).toBe(false);
      expect(summary?.cpu.perCorePercentage).toHaveLength(2);
    });

    it('ควรเก็บค่า memory ถูกต้อง', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: sampleMetricsFirstPoll() });
      await service.pollMetrics();

      const summary = await service.getHostMetrics();
      expect(summary?.memory.totalBytes).toBe(64_000_000_000);
      expect(summary?.memory.availableBytes).toBe(32_000_000_000);
      expect(summary?.memory.usedBytes).toBe(32_000_000_000);
      expect(summary?.memory.usedPercentage).toBe(50);
    });

    it('ควรเก็บค่า temperature ถูกต้อง', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: sampleMetricsFirstPoll() });
      await service.pollMetrics();

      const summary = await service.getHostMetrics();
      expect(summary?.temperature.cpuCelsius).toBe(55.5);
    });

    it('ควรจัดการกรณี node-exporter ไม่ตอบกลับโดยไม่ throw', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.pollMetrics()).resolves.toBeUndefined();
    });
  });

  describe('getHostMetrics', () => {
    it('ควรคืน null เมื่อไม่มี summary ใน Redis', async () => {
      const result = await service.getHostMetrics();
      expect(result).toBeNull();
    });

    it('ควรคืน history ตามลำดับ oldest → newest', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: sampleMetricsFirstPoll() });
      await service.pollMetrics();
      const summary = await service.getHostMetrics();
      expect(summary?.history).toHaveLength(1);
      expect(summary?.history[0].cpuPercentage).toBe(
        summary?.cpu.overallPercentage
      );
    });
  });
});

/** ข้อมูลจำลองครั้งแรกจาก node-exporter (2 cores, load1=1.0) */
function sampleMetricsFirstPoll(): string {
  return [
    '# HELP node_cpu_seconds_total ...',
    'node_cpu_seconds_total{cpu="0",mode="idle"} 100',
    'node_cpu_seconds_total{cpu="0",mode="user"} 20',
    'node_cpu_seconds_total{cpu="1",mode="idle"} 100',
    'node_cpu_seconds_total{cpu="1",mode="user"} 20',
    'node_load1 1',
    'node_memory_MemTotal_bytes 64000000000',
    'node_memory_MemAvailable_bytes 32000000000',
    'node_hwmon_temp_celsius{chip="coretemp",sensor=""} 55.5',
  ].join('\n');
}

/** ข้อมูลจำลองครั้งที 2 (idle เพิ่มขึ้น) */
function sampleMetricsSecondPoll(): string {
  return [
    'node_cpu_seconds_total{cpu="0",mode="idle"} 110',
    'node_cpu_seconds_total{cpu="0",mode="user"} 25',
    'node_cpu_seconds_total{cpu="1",mode="idle"} 110',
    'node_cpu_seconds_total{cpu="1",mode="user"} 25',
    'node_load1 0.5',
    'node_memory_MemTotal_bytes 64000000000',
    'node_memory_MemAvailable_bytes 32000000000',
    'node_hwmon_temp_celsius{chip="coretemp",sensor=""} 55.5',
  ].join('\n');
}
