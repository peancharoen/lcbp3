// File: src/common/entities/audit-log.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn, // ✅ [Fix] เพิ่ม Import นี้
} from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn({ name: 'audit_id', type: 'bigint' })
  auditId!: string;

  @Column({ name: 'request_id', nullable: true })
  requestId?: string;

  // ✅ ต้องมีบรรทัดนี้ (TypeORM ต้องการเพื่อ Map Column)
  @Column({ name: 'user_id', nullable: true })
  userId?: number | null; // ✅ เพิ่ม | null เพื่อรองรับค่า null

  @Column({ length: 100 })
  action!: string;

  @Column({
    type: 'enum',
    enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
    default: 'INFO',
  })
  severity!: string;

  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType?: string;

  @Column({ name: 'entity_id', length: 50, nullable: true })
  entityId?: string;

  @Column({ name: 'details_json', type: 'json', nullable: true })
  detailsJson?: any;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', length: 255, nullable: true })
  userAgent?: string;

  // ✅ [Fix] ทั้งสอง Decorator ต้องระบุ name: 'created_at'
  @CreateDateColumn({ name: 'created_at' })
  @PrimaryColumn({ name: 'created_at' }) // Composite PK คู่กับ auditId
  createdAt!: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
