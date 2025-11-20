import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('json_schemas')
export class JsonSchema {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'schema_code', unique: true, length: 100 })
  schemaCode!: string; // เช่น 'RFA_DWG_V1'

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'schema_definition', type: 'json' })
  schemaDefinition!: any; // เก็บ JSON Schema มาตรฐาน (Draft 7/2019-09)

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
