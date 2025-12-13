import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Correspondence } from './correspondence.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('correspondence_recipients')
export class CorrespondenceRecipient {
  @PrimaryColumn({ name: 'correspondence_id' })
  correspondenceId!: number;

  @PrimaryColumn({ name: 'recipient_organization_id' })
  recipientOrganizationId!: number;

  @PrimaryColumn({ name: 'recipient_type', type: 'enum', enum: ['TO', 'CC'] })
  recipientType!: 'TO' | 'CC';

  // Relations
  @ManyToOne(() => Correspondence, (corr) => corr.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'correspondence_id' })
  correspondence!: Correspondence;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'recipient_organization_id' })
  recipientOrganization!: Organization;
}
