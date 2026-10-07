// File: backend/src/modules/contract/entities/contract-organization.entity.ts
// Change Log:
// - 2026-10-06: เปลี่ยน role_in_contract (free-text) → role_id (FK → organization_roles)
//   ตามการตัด organizations.role_id ออก — role ขององค์กรมีความหมายเฉพาะใน context contract
import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationRole } from '../../organization/entities/organization-role.entity';

@Entity('contract_organizations')
export class ContractOrganization {
  @PrimaryColumn({ name: 'contract_id' })
  contractId!: number;

  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: number;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  // Relation ไปยัง Contract
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  // Relation ไปยัง Organization
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  // Relation ไปยัง OrganizationRole
  @ManyToOne(() => OrganizationRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  organizationRole?: OrganizationRole;
}
