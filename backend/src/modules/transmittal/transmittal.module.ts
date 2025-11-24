import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { TransmittalService } from './transmittal.service';
import { TransmittalController } from './transmittal.controller';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { UserModule } from '../user/user.module';
import { SearchModule } from '../search/search.module'; // ✅ ต้อง Import เพราะ Service ใช้ (ที่เป็นสาเหตุ Error)
@Module({
  imports: [
    TypeOrmModule.forFeature([Transmittal, TransmittalItem, Correspondence]),
    DocumentNumberingModule,
    UserModule,
    SearchModule,
  ],
  controllers: [TransmittalController],
  providers: [TransmittalService],
  exports: [TransmittalService],
})
export class TransmittalModule {}
