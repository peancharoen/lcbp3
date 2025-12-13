import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { RfaRevision } from './rfa-revision.entity';
import { ShopDrawingRevision } from '../../drawing/entities/shop-drawing-revision.entity';

@Entity('rfa_items')
export class RfaItem {
  @PrimaryColumn({ name: 'rfa_revision_id' })
  rfaRevisionId!: number;

  @PrimaryColumn({ name: 'shop_drawing_revision_id' })
  shopDrawingRevisionId!: number;

  // Relations
  @ManyToOne(() => RfaRevision, (rfaRev) => rfaRev.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rfa_revision_id' })
  rfaRevision!: RfaRevision;

  @ManyToOne(() => ShopDrawingRevision)
  @JoinColumn({ name: 'shop_drawing_revision_id' })
  shopDrawingRevision!: ShopDrawingRevision;
}
