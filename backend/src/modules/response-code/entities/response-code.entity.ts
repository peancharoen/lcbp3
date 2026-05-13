// File: src/modules/response-code/entities/response-code.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { ResponseCodeCategory } from '../../common/enums/review.enums';
import { ResponseCodeRule } from './response-code-rule.entity';

@Entity('response_codes')
export class ResponseCode extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ length: 10 })
  code!: string; // '1A', '1B', '1C', ..., '2', '3', '4'

  @Column({ name: 'sub_status', length: 10, nullable: true })
  subStatus?: string;

  @Column({
    type: 'enum',
    enum: ResponseCodeCategory,
  })
  category!: ResponseCodeCategory;

  @Column({ name: 'description_th', type: 'text' })
  descriptionTh!: string;

  @Column({ name: 'description_en', type: 'text' })
  descriptionEn!: string;

  @Column({ type: 'json', nullable: true })
  implications?: {
    affectsSchedule?: boolean;
    affectsCost?: boolean;
    requiresContractReview?: boolean;
    requiresEiaAmendment?: boolean;
  };

  @Column({ name: 'notify_roles', type: 'simple-array', nullable: true })
  notifyRoles?: string[]; // ['CONTRACT_MANAGER', 'QS_MANAGER']

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'tinyint', default: 0 })
  isSystem!: boolean; // System default — ลบไม่ได้

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @OneToMany(
    () => ResponseCodeRule,
    (rule: ResponseCodeRule) => rule.responseCode
  )
  rules?: ResponseCodeRule[];
}
