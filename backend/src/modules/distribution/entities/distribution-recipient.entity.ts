// File: src/modules/distribution/entities/distribution-recipient.entity.ts
// Change Log
// - 2026-05-14: Store polymorphic recipient public IDs instead of internal numeric IDs.
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
    name: 'recipient_type',
    type: 'enum',
    enum: RecipientType,
  })
  recipientType!: RecipientType;

  @Column({ name: 'recipient_public_id', type: 'uuid' })
  recipientPublicId!: string;

  @Column({
    name: 'delivery_method',
    type: 'enum',
    enum: DeliveryMethod,
    default: DeliveryMethod.BOTH,
  })
  deliveryMethod!: DeliveryMethod;

  @Column({ nullable: true })
  sequence?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(
    () => DistributionMatrix,
    (m: DistributionMatrix) => m.recipients,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'matrix_id' })
  matrix!: DistributionMatrix;
}
