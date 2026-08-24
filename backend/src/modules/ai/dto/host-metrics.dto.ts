// File: backend/src/modules/ai/dto/host-metrics.dto.ts
// Change Log:
// - 2026-08-24: ADR-048 T002 — สร้าง DTO สำหรับ Host Metrics API response
//   รองรับ CPU%, RAM, CPU Temperature และ Sparkline history list

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** ข้อมูล CPU usage ของ host */
export class HostMetricsCpuDto {
  @ApiProperty({ description: 'Overall CPU usage % (0–100)', example: 42.5 })
  @IsNumber()
  overallPercentage!: number;

  @ApiProperty({ description: 'จำนวน CPU core ทั้งหมด', example: 8 })
  @IsNumber()
  coreCount!: number;

  @ApiProperty({
    description: 'CPU usage % แยกรายคอร์',
    example: [30, 50, 40, 20],
  })
  perCorePercentage!: number[];
}

/** ข้อมูล RAM usage ของ host */
export class HostMetricsMemoryDto {
  @ApiProperty({ description: 'Total RAM ในหน่วย bytes', example: 16777216000 })
  @IsNumber()
  totalBytes!: number;

  @ApiProperty({
    description: 'RAM ที่ใช้งานอยู่ในหน่วย bytes',
    example: 8388608000,
  })
  @IsNumber()
  usedBytes!: number;

  @ApiProperty({
    description: 'RAM ที่ยังว่างในหน่วย bytes',
    example: 8388608000,
  })
  @IsNumber()
  availableBytes!: number;

  @ApiProperty({ description: 'RAM usage % (0–100)', example: 50.0 })
  @IsNumber()
  usedPercentage!: number;
}

/** ข้อมูล CPU temperature */
export class HostMetricsTemperatureDto {
  @ApiProperty({
    description: 'อุณหภูมิ CPU (°C) หรือ null ถ้าไม่สามารถอ่านได้',
    nullable: true,
    example: 58.0,
  })
  @IsOptional()
  @IsNumber()
  cpuCelsius!: number | null;

  @ApiProperty({
    description: 'ชื่อ sensor ที่ใช้ หรือ null',
    nullable: true,
    example: 'coretemp',
  })
  @IsOptional()
  @IsString()
  sensorName!: string | null;
}

/** จุดข้อมูล 1 รายการในประวัติ Sparkline (rolling 15-point history) */
export class HostMetricsHistoryPointDto {
  @ApiProperty({
    description: 'ISO timestamp',
    example: '2026-08-24T05:30:00.000Z',
  })
  @IsString()
  timestamp!: string;

  @ApiProperty({ description: 'CPU usage % ณ เวลานั้น', example: 38.5 })
  @IsNumber()
  cpuPercentage!: number;

  @ApiProperty({ description: 'RAM usage % ณ เวลานั้น', example: 48.0 })
  @IsNumber()
  memoryPercentage!: number;

  @ApiProperty({
    description: 'CPU temperature °C ณ เวลานั้น หรือ null',
    nullable: true,
    example: 57.0,
  })
  @IsOptional()
  @IsNumber()
  temperatureCelsius!: number | null;
}

/**
 * DTO สำหรับ response ของ GET /ai/admin/host/metrics
 * มี snapshot ปัจจุบัน + rolling 15-point history สำหรับ Sparkline
 */
export class GetHostMetricsResponseDto {
  @ApiProperty({ description: 'ISO timestamp ของ snapshot ล่าสุด' })
  @IsString()
  timestamp!: string;

  @ApiProperty({ type: HostMetricsCpuDto })
  @ValidateNested()
  @Type(() => HostMetricsCpuDto)
  cpu!: HostMetricsCpuDto;

  @ApiProperty({ type: HostMetricsMemoryDto })
  @ValidateNested()
  @Type(() => HostMetricsMemoryDto)
  memory!: HostMetricsMemoryDto;

  @ApiProperty({ type: HostMetricsTemperatureDto })
  @ValidateNested()
  @Type(() => HostMetricsTemperatureDto)
  temperature!: HostMetricsTemperatureDto;

  @ApiProperty({
    description:
      'true ถ้า CPU% คำนวณจาก node_load1 (cold-start fallback ในช่วง 10s แรกหลัง backend reboot)',
    example: false,
  })
  @IsBoolean()
  isEstimated!: boolean;

  @ApiProperty({
    description:
      'Rolling 15-point history สำหรับ Sparkline chart (เรียงจากเก่าไปใหม่)',
    type: [HostMetricsHistoryPointDto],
  })
  @ValidateNested({ each: true })
  @Type(() => HostMetricsHistoryPointDto)
  history!: HostMetricsHistoryPointDto[];
}
