import { Entity, PrimaryGeneratedColumn, Column, AfterLoad } from 'typeorm';

@Entity('rfa_types')
export class RfaType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contract_id' })
  contractId!: number;

  @Column({ name: 'type_code', length: 20 })
  typeCode!: string;

  @Column({ name: 'type_name_th', length: 100 })
  typeNameTh!: string;

  @Column({ name: 'type_name_en', length: 100 })
  typeNameEn!: string;

  @Column({ type: 'text', nullable: true })
  remark?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  // Virtual property for backward compatibility
  typeName!: string;

  @AfterLoad()
  populateVirtualFields() {
    this.typeName = this.typeNameEn;
    // Map remark to description if needed, or just let description be undefined
    // this['description'] = this.remark;
  }
}
