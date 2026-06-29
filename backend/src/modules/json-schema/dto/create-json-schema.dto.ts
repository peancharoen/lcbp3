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
  jsonPath!: string;

  @IsString()
  @IsNotEmpty()
  columnName!: string;

  @IsString()
  @IsNotEmpty()
  dataType!: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'DATE' | 'DECIMAL' | 'DATETIME';

  @IsString()
  @IsOptional()
  indexType?: 'INDEX' | 'UNIQUE' | 'FULLTEXT';

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
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
  schemaDefinition!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  uiSchema?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VirtualColumnConfigDto)
  virtualColumns?: VirtualColumnConfigDto[];

  @IsObject()
  @IsOptional()
  migrationScript?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
