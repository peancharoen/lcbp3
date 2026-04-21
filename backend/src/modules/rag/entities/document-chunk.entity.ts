import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'char', length: 36, name: 'document_id' })
  documentId!: string;

  @Column({ name: 'chunk_index' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ length: 20, name: 'doc_type' })
  docType!: string;

  @Column({ type: 'varchar', length: 100, name: 'doc_number', nullable: true })
  docNumber!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  revision!: string | null;

  @Column({ length: 50, name: 'project_code' })
  projectCode!: string;

  @Column({ length: 36, name: 'project_public_id' })
  projectPublicId!: string;

  @Column({
    type: 'enum',
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
    default: 'INTERNAL',
  })
  classification!: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

  @Column({ type: 'varchar', length: 20, nullable: true })
  version!: string | null;

  @Column({ length: 100, name: 'embedding_model', default: 'nomic-embed-text' })
  embeddingModel!: string;

  @CreateDateColumn({ name: 'created_at', precision: 3 })
  createdAt!: Date;
}
