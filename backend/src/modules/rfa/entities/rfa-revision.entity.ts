// File: src/modules/rfa/entities/rfa-revision.entity.ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  OneToOne,
} from 'typeorm';
import { CorrespondenceRevision } from '../../correspondence/entities/correspondence-revision.entity';
import { RfaApproveCode } from './rfa-approve-code.entity';
import { RfaItem } from './rfa-item.entity';
import { RfaStatusCode } from './rfa-status-code.entity';
import { RfaWorkflow } from './rfa-workflow.entity';

@Entity('rfa_revisions')
export class RfaRevision {
  @PrimaryColumn()
  id!: number;

  @OneToOne(() => CorrespondenceRevision, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  correspondenceRevision!: CorrespondenceRevision;

  @Column({ name: 'rfa_status_code_id' })
  rfaStatusCodeId!: number;

  @Column({ name: 'rfa_approve_code_id', nullable: true })
  rfaApproveCodeId?: number;

  @Column({ name: 'approved_date', type: 'date', nullable: true })
  approvedDate?: Date;

  // --- JSON & Schema Section ---

  @Column({ type: 'json', nullable: true })
  details?: object; // Dynamic JSON — typed as `object` per TypeORM JSON column convention (no-any, ADR-019)

  // ✅ [New] จำเป็นสำหรับ Data Migration (T2.5.5)
  @Column({ name: 'schema_version', default: 1 })
  schemaVersion!: number;

  // ✅ Virtual Column
  @Column({
    name: 'v_ref_drawing_count',
    type: 'int',
    generatedType: 'VIRTUAL',
    asExpression: "JSON_UNQUOTE(JSON_EXTRACT(details, '$.drawingCount'))",
    nullable: true,
  })
  vRefDrawingCount?: number;

  // --- Relations ---

  @ManyToOne(() => RfaStatusCode)
  @JoinColumn({ name: 'rfa_status_code_id' })
  statusCode!: RfaStatusCode;

  @ManyToOne(() => RfaApproveCode)
  @JoinColumn({ name: 'rfa_approve_code_id' })
  approveCode?: RfaApproveCode;

  @OneToMany(() => RfaItem, (item) => item.rfaRevision, { cascade: true })
  items!: RfaItem[];

  @OneToMany(() => RfaWorkflow, (workflow) => workflow.rfaRevision, {
    cascade: true,
  })
  workflows!: RfaWorkflow[];
}
