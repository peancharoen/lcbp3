// File: src/modules/json-schema/dto/create-json-schema.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VirtualColumnConfigDto {
  @IsString()
  @IsNotEmpty()
  json_path!: string;

  @IsString()
  @IsNotEmpty()
  column_name!: string;

  @IsString()
  @IsNotEmpty()
  data_type!: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'DATE' | 'DECIMAL' | 'DATETIME';

  @IsString()
  @IsOptional()
  index_type?: 'INDEX' | 'UNIQUE' | 'FULLTEXT';

  @IsBoolean()
  @IsOptional()
  is_required?: boolean;
}

export class CreateJsonSchemaDto {
  @IsString()
  @IsNotEmpty()
  schemaCode!: string;

  @IsString() // ✅ เพิ่ม Validation
  @IsNotEmpty()
  tableName!: string;

  @IsInt()
  @IsOptional()
  version?: number;

  @IsObject()
  @IsNotEmpty()
  schemaDefinition!: Record<string, any>;

  @IsObject()
  @IsOptional()
  uiSchema?: Record<string, any>;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VirtualColumnConfigDto)
  virtualColumns?: VirtualColumnConfigDto[];

  @IsObject()
  @IsOptional()
  migrationScript?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
