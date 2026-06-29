// File: src/modules/json-schema/json-schema.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JsonSchema } from './entities/json-schema.entity';
import { JsonSchemaController } from './json-schema.controller';
import { JsonSchemaService } from './json-schema.service';

import { JsonSecurityService } from './services/json-security.service';
import { SchemaMigrationService } from './services/schema-migration.service';
import { UiSchemaService } from './services/ui-schema.service';
import { VirtualColumnService } from './services/virtual-column.service';
// Fix TS2307: Correct path to CryptoService
import { CryptoService } from '../../common/services/crypto.service';

// Import Module อื่นๆ ที่จำเป็นสำหรับ Guard (ถ้า Guards อยู่ใน Common อาจจะไม่ต้อง import ที่นี่โดยตรง)
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([JsonSchema]), ConfigModule, UserModule],
  controllers: [JsonSchemaController],
  providers: [
    JsonSchemaService,
    VirtualColumnService,
    UiSchemaService,
    SchemaMigrationService,
    JsonSecurityService,
    CryptoService,
  ],
  exports: [JsonSchemaService, SchemaMigrationService, JsonSecurityService],
})
export class JsonSchemaModule {}
