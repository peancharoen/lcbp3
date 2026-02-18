import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../modules/user/entities/user.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'stored_filename', length: 255 })
  storedFilename!: string;

  @Column({ name: 'file_path', length: 500 })
  filePath!: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size' })
  fileSize!: number;

  @Column({ name: 'is_temporary', default: true })
  isTemporary!: boolean;

  @Column({ name: 'temp_id', length: 100, nullable: true })
  tempId?: string;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ length: 64, nullable: true })
  checksum?: string;

  @Column({ name: 'reference_date', type: 'date', nullable: true })
  referenceDate?: Date;

  @Column({ name: 'uploaded_by_user_id' })
  uploadedByUserId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relation กับ User (คนอัปโหลด)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy?: User;
}
