import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  Unique,
} from 'typeorm';
import { ShopDrawing } from './shop-drawing.entity';
import { ContractDrawing } from './contract-drawing.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { User } from '../../user/entities/user.entity';

@Entity('shop_drawing_revisions')
@Unique(['shopDrawingId', 'isCurrent'])
export class ShopDrawingRevision {
  @PrimaryGeneratedColumn()
  id!: number; // เติม !

  @Column({ name: 'shop_drawing_id' })
  shopDrawingId!: number; // เติม !

  @Column({ name: 'revision_number' })
  revisionNumber!: number; // เติม !

  @Column({ name: 'title', length: 255 })
  title!: string; // เติม !

  @Column({ name: 'legacy_drawing_number', length: 100, nullable: true })
  legacyDrawingNumber?: string;

  @Column({ name: 'revision_label', length: 10, nullable: true })
  revisionLabel?: string; // nullable ใช้ ?

  @Column({ name: 'revision_date', type: 'date', nullable: true })
  revisionDate?: Date; // nullable ใช้ ?

  @Column({ type: 'text', nullable: true })
  description?: string; // nullable ใช้ ?

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date; // เติม !

  @Column({
    name: 'is_current',
    type: 'boolean',
    nullable: true,
    default: null,
  })
  isCurrent?: boolean | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  // Relations
  @ManyToOne(() => ShopDrawing, (shopDrawing) => shopDrawing.revisions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shop_drawing_id' })
  shopDrawing!: ShopDrawing; // เติม !

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater?: User;

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
