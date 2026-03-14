import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum MigrationReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('migration_review_queue')
export class MigrationReviewQueue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'document_number', length: 100, unique: true })
  documentNumber!: string;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ name: 'original_title', type: 'text', nullable: true })
  originalTitle?: string;

  @Column({ name: 'ai_suggested_category', length: 50, nullable: true })
  aiSuggestedCategory?: string;

  @Column({
    name: 'ai_confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  aiConfidence?: number;

  @Column({ name: 'ai_issues', type: 'json', nullable: true })
  aiIssues?: any;

  @Column({ name: 'review_reason', length: 255, nullable: true })
  reviewReason?: string;

  @Column({
    type: 'enum',
    enum: MigrationReviewStatus,
    default: MigrationReviewStatus.PENDING,
  })
  status!: MigrationReviewStatus;

  @Column({ name: 'reviewed_by', length: 100, nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId?: number;

  @Column({ name: 'sender_organization_id', type: 'int', nullable: true })
  senderOrganizationId?: number;

  @Column({ name: 'receiver_organization_id', type: 'int', nullable: true })
  receiverOrganizationId?: number;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate?: Date;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate?: Date;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary?: string;

  @Column({ name: 'extracted_tags', type: 'json', nullable: true })
  extractedTags?: any;

  @Column({ name: 'temp_attachment_id', type: 'int', nullable: true })
  tempAttachmentId?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
