import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity.js';
import { Organization } from './organization.entity.js';

@Entity('contract_organizations')
export class ContractOrganization {
  @PrimaryColumn({ name: 'contract_id' })
  contractId!: number;

  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'role_in_contract', nullable: true, length: 100 })
  roleInContract?: string;

  // Relation ไปยัง Contract
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  // Relation ไปยัง Organization
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;
}
