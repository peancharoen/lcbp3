import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';

// ✅ 1. สร้าง Interface เพื่อระบุ Type ของ Request
interface RequestWithUser {
  user: {
    userId: number;
    username: string;
  };
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // รับ field ชื่อ 'file'
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          // ตรวจสอบประเภทไฟล์ (Regex)
          new FileTypeValidator({
            fileType: /(pdf|msword|openxmlformats|zip|octet-stream)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: RequestWithUser, // ✅ 2. ระบุ Type ตรงนี้แทน any
  ) {
    // ส่ง userId จาก Token ไปด้วย
    return this.fileStorageService.upload(file, req.user.userId);
  }
}
