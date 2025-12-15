import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Project } from '../../project/entities/project.entity';
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
  formatTemplate!: string;

  @Column({ name: 'discipline_id', default: 0 })
  disciplineId!: number;

  @Column({ name: 'example_number', length: 100, nullable: true })
  exampleNumber?: string;

  @Column({ name: 'padding_length', default: 4 })
  paddingLength!: number;

  @Column({ name: 'reset_annually', default: true })
  resetAnnually!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  // Relation
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project?: Project;
}
