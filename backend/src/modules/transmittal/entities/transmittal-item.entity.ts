import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Transmittal } from './transmittal.entity';

@Entity('transmittal_items')
export class TransmittalItem {
  @PrimaryColumn({ name: 'transmittal_id' })
  transmittalId!: number;

  @PrimaryColumn({ name: 'item_type', length: 50 })
  itemType!: string; // DRAWING, RFA, etc.

  @PrimaryColumn({ name: 'item_id' })
  itemId!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Relations
  @ManyToOne(() => Transmittal, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transmittal_id' })
  transmittal!: Transmittal;
}
