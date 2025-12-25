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
import { AsBuiltDrawing } from './asbuilt-drawing.entity';
import { ShopDrawingRevision } from './shop-drawing-revision.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { User } from '../../user/entities/user.entity';

@Entity('asbuilt_drawing_revisions')
@Unique(['asBuiltDrawingId', 'isCurrent'])
export class AsBuiltDrawingRevision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'asbuilt_drawing_id' })
  asBuiltDrawingId!: number;

  @Column({ name: 'revision_number' })
  revisionNumber!: number;

  @Column({ name: 'title', length: 255 })
  title!: string;

  @Column({ name: 'revision_label', length: 10, nullable: true })
  revisionLabel?: string;

  @Column({ name: 'revision_date', type: 'date', nullable: true })
  revisionDate?: Date;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'legacy_drawing_number', length: 100, nullable: true })
  legacyDrawingNumber?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

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
  @ManyToOne(() => AsBuiltDrawing, (drawing) => drawing.revisions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asbuilt_drawing_id' })
  asBuiltDrawing!: AsBuiltDrawing;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater?: User;

  // Relation to Shop Drawing Revisions (M:N)
  @ManyToMany(() => ShopDrawingRevision)
  @JoinTable({
    name: 'asbuilt_revision_shop_revisions_refs',
    joinColumn: {
      name: 'asbuilt_drawing_revision_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'shop_drawing_revision_id',
      referencedColumnName: 'id',
    },
  })
  shopDrawingRevisions!: ShopDrawingRevision[];

  // Attachments (M:N)
  @ManyToMany(() => Attachment)
  @JoinTable({
    name: 'asbuilt_drawing_revision_attachments',
    joinColumn: {
      name: 'asbuilt_drawing_revision_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: { name: 'attachment_id', referencedColumnName: 'id' },
  })
  attachments!: Attachment[];
}
