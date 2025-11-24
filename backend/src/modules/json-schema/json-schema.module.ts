import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JsonSchemaService } from './json-schema.service';
import { JsonSchemaController } from './json-schema.controller';
import { JsonSchema } from './entities/json-schema.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([JsonSchema]), UserModule],
  controllers: [JsonSchemaController],
  providers: [JsonSchemaService],
  exports: [JsonSchemaService],
})
export class JsonSchemaModule {}
