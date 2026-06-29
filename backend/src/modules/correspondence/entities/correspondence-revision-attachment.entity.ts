// File: src/modules/correspondence/entities/correspondence-revision-attachment.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { CorrespondenceRevision } from './correspondence-revision.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';

/**
 * CorrespondenceRevisionAttachment
 *
 * ตารางเชื่อม correspondence_revisions กับ attachments (M:N)
 * [FIX v1.8.1] FK ชี้ไป correspondence_revisions.id ไม่ใช่ correspondences.id
 * เหตุผล: ไฟล์แนบผูกกับ revision เพื่อรองรับไฟล์ที่ต่างกันในแต่ละ revision
 */
@Entity('correspondence_revision_attachments')
export class CorrespondenceRevisionAttachment {
  // คีย์หลักของ revision ที่ผูกไฟล์นี้
  @PrimaryColumn({ name: 'correspondence_revision_id' })
  correspondenceRevisionId!: number;

  // คีย์หลักของ attachment
  @PrimaryColumn({ name: 'attachment_id' })
  attachmentId!: number;

  // ไฟล์หลักของ revision นี้ (เช่น PDF หลัก)
  @Column({ name: 'is_main_document', default: false })
  isMainDocument!: boolean;

  // Relation: หลาย CorrespondenceRevisionAttachment → หนึ่ง CorrespondenceRevision
  @ManyToOne(
    () => CorrespondenceRevision,
    (revision) => revision.attachmentLinks,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'correspondence_revision_id' })
  revision?: CorrespondenceRevision;

  // Relation: หลาย CorrespondenceRevisionAttachment → หนึ่ง Attachment
  @ManyToOne(() => Attachment, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'attachment_id' })
  attachment?: Attachment;
}
