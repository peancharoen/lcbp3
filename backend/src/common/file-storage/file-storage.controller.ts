// File: src/common/file-storage/file-storage.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete, // ✅ Import Delete
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
  StreamableFile,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

// Interface เพื่อระบุ Type ของ Request ที่ผ่าน JwtAuthGuard มาแล้ว
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
          // ตรวจสอบประเภทไฟล์ (Regex) - รวม image, pdf, docs, zip
          new FileTypeValidator({
            fileType:
              /(pdf|msword|openxmlformats|zip|octet-stream|image|jpeg|png)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    // ส่ง userId จาก Token ไปด้วย
    return this.fileStorageService.upload(file, req.user.userId);
  }

  /**
   * Endpoint สำหรับดาวน์โหลดไฟล์
   * GET /files/:id/download
   */
  @Get(':id/download')
  async downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, attachment } = await this.fileStorageService.download(id);

    // Encode ชื่อไฟล์เพื่อรองรับภาษาไทยและตัวอักษรพิเศษใน Header
    const encodedFilename = encodeURIComponent(attachment.originalFilename);

    res.set({
      'Content-Type': attachment.mimeType,
      // บังคับให้ browser ดาวน์โหลดไฟล์ แทนการ preview
      'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': attachment.fileSize,
    });

    return new StreamableFile(stream);
  }

  /**
   * ✅ NEW: Delete Endpoint
   * DELETE /files/:id
   */
  @Delete(':id')
  async deleteFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    // ส่ง userId ไปด้วยเพื่อตรวจสอบความเป็นเจ้าของ
    await this.fileStorageService.delete(id, req.user.userId);
    return { message: 'File deleted successfully', id };
  }
}
