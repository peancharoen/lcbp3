// File: src/modules/document-numbering/entities/document-number-counter.entity.ts
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  // Composite Primary Key: 8 columns (v1.5.1 schema)

  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorId!: number;

  // [v1.5.1 NEW] -1 = all organizations (FK removed in schema for this special value)
  @PrimaryColumn({ name: 'recipient_organization_id', default: -1 })
  recipientOrganizationId!: number;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  typeId!: number;

  // [v1.5.1 NEW] Sub-type for TRANSMITTAL (0 = not specified)
  @PrimaryColumn({ name: 'sub_type_id', default: 0 })
  subTypeId!: number;

  // [v1.5.1 NEW] RFA type: SHD, RPT, MAT (0 = not RFA)
  @PrimaryColumn({ name: 'rfa_type_id', default: 0 })
  rfaTypeId!: number;

  // Discipline: TER, STR, GEO (0 = not specified)
  @PrimaryColumn({ name: 'discipline_id', default: 0 })
  disciplineId!: number;

  @PrimaryColumn({ name: 'current_year' })
  year!: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber!: number;

  // ✨ Optimistic Lock (TypeORM checks version before update)
  @VersionColumn()
  version!: number;
}
