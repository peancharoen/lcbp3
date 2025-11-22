import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { RfaRevision } from './rfa-revision.entity';
import { ShopDrawingRevision } from '../../drawing/entities/shop-drawing-revision.entity';

@Entity('rfa_items')
export class RfaItem {
  @PrimaryColumn({ name: 'rfarev_correspondence_id' })
  rfaRevisionId!: number;

  @PrimaryColumn({ name: 'shop_drawing_revision_id' })
  shopDrawingRevisionId!: number;

  // Relations
  @ManyToOne(() => RfaRevision, (rfaRev) => rfaRev.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rfarev_correspondence_id' }) // Link to correspondence_id of the revision (as per SQL schema) OR id
  // Note: ตาม SQL Schema "rfarev_correspondence_id" FK ไปที่ correspondence_revisions(correspondence_id)
  // แต่เพื่อให้ TypeORM ใช้ง่าย ปกติเราจะ Link ไปที่ PK ของ RfaRevision
  // **แต่** ตาม SQL: FOREIGN KEY (rfarev_correspondence_id) REFERENCES correspondences(id)
  // ดังนั้นต้องระวังจุดนี้ ใน Service เราจะใช้ correspondenceId เป็น Key
  rfaRevision!: RfaRevision;

  @ManyToOne(() => ShopDrawingRevision)
  @JoinColumn({ name: 'shop_drawing_revision_id' })
  shopDrawingRevision!: ShopDrawingRevision;
}
