import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonSchemaService } from './json-schema.service.js';
import { JsonSchemaController } from './json-schema.controller.js';
import { JsonSchema } from './entities/json-schema.entity.js';
import { UserModule } from '../user/user.module.js'; // <--- 1. Import UserModule

@Module({
  imports: [
    TypeOrmModule.forFeature([JsonSchema]),
    UserModule, // <--- 2. ใส่ UserModule ใน imports
  ],
  controllers: [JsonSchemaController],
  providers: [JsonSchemaService],
  exports: [JsonSchemaService], // Export ให้ Module อื่นเรียกใช้ .validate()
})
export class JsonSchemaModule {}
