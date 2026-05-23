// File: src/modules/ai/entities/migration-progress.entity.ts
// Change Log:
// - 2026-05-23: สร้าง entity สำหรับ migration_progress table (Checkpoint management ADR-023A)

import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum MigrationProgressStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/** ตารางติดตามความคืบหน้า Batch Migration — ใช้สำหรับ Resume กรณี n8n หยุดกลางทาง */
@Entity('migration_progress')
export class MigrationProgress {
  @PrimaryColumn({ name: 'batch_id', type: 'varchar', length: 50 })
  batchId!: string;

  @Column({ name: 'last_processed_index', type: 'int', default: 0 })
  lastProcessedIndex!: number;

  @Column({
    name: 'STATUS',
    type: 'enum',
    enum: MigrationProgressStatus,
    default: MigrationProgressStatus.RUNNING,
  })
  status!: MigrationProgressStatus;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
