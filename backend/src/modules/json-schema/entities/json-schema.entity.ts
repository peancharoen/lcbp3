// File: src/modules/json-schema/entities/json-schema.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface VirtualColumnConfig {
  json_path: string;
  column_name: string;
  data_type: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'DATE' | 'DECIMAL' | 'DATETIME';
  index_type?: 'INDEX' | 'UNIQUE' | 'FULLTEXT';
  is_required: boolean;
}

@Entity('json_schemas')
@Index(['schemaCode', 'version'], { unique: true })
export class JsonSchema {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'schema_code', length: 100 })
  schemaCode!: string;

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'table_name', length: 100, nullable: false }) // ✅ เพิ่ม: ระบุตารางเป้าหมาย
  tableName!: string;

  @Column({ name: 'schema_definition', type: 'json' })
  schemaDefinition!: any;

  @Column({ name: 'ui_schema', type: 'json', nullable: true })
  uiSchema?: any;

  @Column({ name: 'virtual_columns', type: 'json', nullable: true })
  virtualColumns?: VirtualColumnConfig[];

  @Column({ name: 'migration_script', type: 'json', nullable: true })
  migrationScript?: any;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
