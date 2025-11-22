import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ShopDrawing } from './shop-drawing.entity';
import { ContractDrawing } from './contract-drawing.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';

@Entity('shop_drawing_revisions')
export class ShopDrawingRevision {
  @PrimaryGeneratedColumn()
  id!: number; // เติม !

  @Column({ name: 'shop_drawing_id' })
  shopDrawingId!: number; // เติม !

  @Column({ name: 'revision_number' })
  revisionNumber!: number; // เติม !

  @Column({ name: 'revision_label', length: 10, nullable: true })
  revisionLabel?: string; // nullable ใช้ ?

  @Column({ name: 'revision_date', type: 'date', nullable: true })
  revisionDate?: Date; // nullable ใช้ ?

  @Column({ type: 'text', nullable: true })
  description?: string; // nullable ใช้ ?

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  // Relations
  @ManyToOne(() => ShopDrawing, (shopDrawing) => shopDrawing.revisions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shop_drawing_id' })
  shopDrawing!: ShopDrawing; // เติม !

  // References to Contract Drawings (M:N)
  @ManyToMany(() => ContractDrawing)
  @JoinTable({
    name: 'shop_drawing_revision_contract_refs',
    joinColumn: {
      name: 'shop_drawing_revision_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'contract_drawing_id',
      referencedColumnName: 'id',
    },
  })
  contractDrawings!: ContractDrawing[]; // เติม !

  // Attachments (M:N)
  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'shop_drawing_revision_attachments',
    joinColumn: {
      name: 'shop_drawing_revision_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: { name: 'attachment_id', referencedColumnName: 'id' },
  })
  attachments!: Attachment[]; // เติม ! (ตัวที่ error)
}
