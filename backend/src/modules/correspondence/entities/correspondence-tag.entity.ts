import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Correspondence } from './correspondence.entity';
import { Tag } from '../../master/entities/tag.entity';

@Entity('correspondence_tags')
export class CorrespondenceTag {
  @PrimaryColumn({ name: 'correspondence_id' })
  correspondenceId!: number;

  @PrimaryColumn({ name: 'tag_id' })
  tagId!: number;

  @ManyToOne(() => Correspondence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'correspondence_id' })
  correspondence?: Correspondence;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'tag_id' })
  tag?: Tag;
}
