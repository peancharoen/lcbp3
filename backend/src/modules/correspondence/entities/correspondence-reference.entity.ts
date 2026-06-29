import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Correspondence } from './correspondence.entity';

@Entity('correspondence_references')
export class CorrespondenceReference {
  @PrimaryColumn({ name: 'src_correspondence_id' })
  sourceId!: number;

  @PrimaryColumn({ name: 'tgt_correspondence_id' })
  targetId!: number;

  @ManyToOne(() => Correspondence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'src_correspondence_id' })
  source?: Correspondence;

  @ManyToOne(() => Correspondence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tgt_correspondence_id' })
  target?: Correspondence;
}
