import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RfaRevision } from './rfa-revision.entity';
import { AsBuiltDrawingRevision } from '../../drawing/entities/asbuilt-drawing-revision.entity';
import { ShopDrawingRevision } from '../../drawing/entities/shop-drawing-revision.entity';

@Entity('rfa_items')
export class RfaItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rfa_revision_id' })
  rfaRevisionId!: number;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: ['SHOP', 'AS_BUILT'],
  })
  itemType!: 'SHOP' | 'AS_BUILT';

  @Column({ name: 'shop_drawing_revision_id', nullable: true })
  shopDrawingRevisionId?: number;

  @Column({ name: 'asbuilt_drawing_revision_id', nullable: true })
  asBuiltDrawingRevisionId?: number;

  // Relations
  @ManyToOne(() => RfaRevision, (rfaRev) => rfaRev.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rfa_revision_id' })
  rfaRevision!: RfaRevision;

  @ManyToOne(() => ShopDrawingRevision)
  @JoinColumn({ name: 'shop_drawing_revision_id' })
  shopDrawingRevision?: ShopDrawingRevision;

  @ManyToOne(() => AsBuiltDrawingRevision)
  @JoinColumn({ name: 'asbuilt_drawing_revision_id' })
  asBuiltDrawingRevision?: AsBuiltDrawingRevision;
}
