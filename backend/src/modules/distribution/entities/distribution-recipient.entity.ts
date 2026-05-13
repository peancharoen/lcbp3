// File: src/modules/distribution/entities/distribution-recipient.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UuidBaseEntity } from '../../../common/entities/uuid-base.entity';
import { DistributionMatrix } from './distribution-matrix.entity';
import { RecipientType, DeliveryMethod } from '../../common/enums/review.enums';

@Entity('distribution_recipients')
export class DistributionRecipient extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'matrix_id' })
  @Exclude()
  matrixId!: number;

  @Column({
    type: 'enum',
    enum: RecipientType,
  })
  recipientType!: RecipientType;

  @Column({ name: 'recipient_id', nullable: true })
  @Exclude()
  recipientId?: number; // userId / organizationId / teamId (FK based on type)

  @Column({ name: 'role_code', length: 50, nullable: true })
  roleCode?: string; // 'ALL_QS', 'ALL_SITE_ENG' (when type = ROLE)

  @Column({
    type: 'enum',
    enum: DeliveryMethod,
    default: DeliveryMethod.BOTH,
  })
  deliveryMethod!: DeliveryMethod;

  @Column({ name: 'is_cc', type: 'tinyint', default: 0 })
  isCc!: boolean; // true = CC recipient, false = primary

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(
    () => DistributionMatrix,
    (m: DistributionMatrix) => m.recipients,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'matrix_id' })
  matrix!: DistributionMatrix;
}
