import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { TransmittalService } from './transmittal.service';
import { TransmittalController } from './transmittal.controller';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { UserModule } from '../user/user.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Transmittal, TransmittalItem, Correspondence]),
    DocumentNumberingModule,
    UserModule,
  ],
  controllers: [TransmittalController],
  providers: [TransmittalService],
  exports: [TransmittalService],
})
export class TransmittalModule {}
