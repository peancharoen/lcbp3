import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  // Composite Primary Key (Project + Org + Type + Year)
  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorId!: number;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  typeId!: number;

  @PrimaryColumn({ name: 'current_year' })
  year!: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber!: number;

  // ✨ หัวใจสำคัญของ Optimistic Lock
  @VersionColumn()
  version!: number;
}
