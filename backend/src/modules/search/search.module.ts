import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { UserModule } from '../user/user.module'; // ✅ 1. Import UserModule
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { Rfa } from '../rfa/entities/rfa.entity';

@Module({
  imports: [
    ConfigModule,
    // ✅ 2. เพิ่ม UserModule เข้าไปใน imports
    UserModule,
    // เพิ่มเพื่อรองรับ reindexAll() backfill (bugfix 2026-09-08) — import entity เท่านั้น
    // ไม่ import CorrespondenceModule/RfaModule เพื่อเลี่ยง circular dependency
    // (ทั้งสอง module import SearchModule อยู่แล้ว)
    TypeOrmModule.forFeature([Correspondence, Rfa]),

    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node: `http://${configService.get<string>('ELASTICSEARCH_HOST', 'localhost')}:${configService.get<string>('ELASTICSEARCH_PORT', '9200')}`,
        auth: {
          username: configService.get<string>('ELASTICSEARCH_USERNAME') || '',
          password: configService.get<string>('ELASTICSEARCH_PASSWORD') || '',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
