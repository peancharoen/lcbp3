// File: src/modules/document-numbering/entities/document-number-counter.entity.ts
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  // Composite Primary Key: Project + Org + Type + Discipline + Year

  @PrimaryColumn({ name: 'project_id' })
  projectId!: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorId!: number;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  typeId!: number;

  // [New v1.4.4] เพิ่ม Discipline ใน Key เพื่อแยก Counter ตามสาขา
  // ใช้ default 0 กรณีไม่มี discipline เพื่อความง่ายในการจัดการ Composite Key
  @PrimaryColumn({ name: 'discipline_id', default: 0 })
  disciplineId!: number;

  @PrimaryColumn({ name: 'current_year' })
  year!: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber!: number;

  // ✨ หัวใจสำคัญของ Optimistic Lock (TypeORM จะเช็ค version นี้ก่อน update)
  @VersionColumn()
  version!: number;
}
