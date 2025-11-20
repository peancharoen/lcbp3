import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity.js';
// เรายังไม่มี CorrespondenceType Entity เดี๋ยวสร้าง Dummy ไว้ก่อน หรือข้าม Relation ไปก่อนได้
// แต่ตามหลักควรมี CorrespondenceType (Master Data)

@Entity('document_number_formats')
@Unique(['projectId', 'correspondenceTypeId']) // 1 Project + 1 Type มีได้แค่ 1 Format
export class DocumentNumberFormat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ name: 'correspondence_type_id' })
  correspondenceTypeId!: number;

  @Column({ name: 'format_template', length: 255 })
  formatTemplate!: string; // เช่น "{ORG_CODE}-{TYPE_CODE}-{YEAR}-{SEQ:4}"

  // Relation
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;
}
