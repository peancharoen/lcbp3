// File: src/modules/response-code/entities/response-code-rule.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ResponseCode } from './response-code.entity';

@Entity('response_code_rules')
export class ResponseCodeRule extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'project_id', nullable: true })
  @Exclude()
  projectId?: number; // NULL = global default

  @Column({ name: 'document_type_id' })
  @Exclude()
  documentTypeId!: number;

  @Column({ name: 'response_code_id' })
  @Exclude()
  responseCodeId!: number;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 1 })
  isEnabled!: boolean;

  @Column({ name: 'requires_comments', type: 'tinyint', default: 0 })
  requiresComments!: boolean;

  @Column({ name: 'triggers_notification', type: 'tinyint', default: 0 })
  triggersNotification!: boolean;

  @Column({ name: 'parent_rule_id', nullable: true })
  @Exclude()
  parentRuleId?: number; // Inheritance tracking

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => ResponseCode, (code: ResponseCode) => code.rules)
  @JoinColumn({ name: 'response_code_id' })
  responseCode!: ResponseCode;
}
