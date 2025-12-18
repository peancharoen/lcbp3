// File: src/modules/document-numbering/entities/document-number-counter.entity.ts
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorId!: number;

  @PrimaryColumn({ name: 'recipient_organization_id' })
  recipientOrganizationId!: number;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  correspondenceTypeId!: number;

  @PrimaryColumn({ name: 'sub_type_id' })
  subTypeId!: number;

  @PrimaryColumn({ name: 'rfa_type_id' })
  rfaTypeId!: number;

  @PrimaryColumn({ name: 'discipline_id' })
  disciplineId!: number;

  @PrimaryColumn({ name: 'reset_scope', length: 20 })
  resetScope!: string;

  @Column({ name: 'last_number', default: 0 })
  lastNumber!: number;

  @VersionColumn({ name: 'version' })
  version!: number;

  @Column({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'updated_at' })
  updatedAt!: Date;
}
