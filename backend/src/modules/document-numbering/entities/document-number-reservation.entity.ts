import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReservationStatus {
  RESERVED = 'RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
}

@Entity('document_number_reservations')
@Index('idx_token', ['token'])
@Index('idx_status_expires', ['status', 'expiresAt'])
export class DocumentNumberReservation {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 36, unique: true })
  token!: string;

  @Index()
  @Column({
    name: 'document_number',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  documentNumber!: string;

  @Index()
  @Column({
    name: 'document_number_status',
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.RESERVED,
  })
  status!: ReservationStatus;

  @Index()
  @Column({ name: 'document_id', type: 'int', nullable: true })
  documentId!: number | null;

  @Column({ name: 'project_id', type: 'int' })
  projectId!: number;

  @Column({ name: 'correspondence_type_id', type: 'int' })
  correspondenceTypeId!: number;

  @Column({ name: 'originator_organization_id', type: 'int' })
  originatorOrganizationId!: number;

  @Column({ name: 'recipient_organization_id', type: 'int', default: 0 })
  recipientOrganizationId!: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Index()
  @CreateDateColumn({ name: 'reserved_at', type: 'datetime', precision: 6 })
  reservedAt!: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({
    name: 'confirmed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  confirmedAt!: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  cancelledAt!: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: any | null;
}
