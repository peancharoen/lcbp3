// File: backend/src/common/file-storage/secure-archive.service.ts
// Change Log:
// - 2026-09-14: T060 (Feature 254 Phase 6 US4) — สร้าง SecureArchiveService สำหรับ
//   secure ZIP extraction ตาม ADR-016 (security), FR-037/FR-038/FR-039, SC-008
//   ครอบคลุม: path traversal, encryption, ClamAV malware, nested depth > 3,
//   file count > 1000, expanded size > 500MB, two-phase extraction, sourceLocator metadata
// - 2026-09-10: Security fix — เพิ่ม symlink rejection หลัง extraction เพื่อป้องกัน
//   adm-zip GHSA symlink-following vulnerability (ไม่มี patched version)

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v7 as uuidv7 } from 'uuid';
import AdmZip from 'adm-zip';
import { ClamAVService } from '../clamav/clamav.service';

/** ไฟล์ที่แตกจาก archive และผ่านการตรวจสอบความปลอดภัยแล้ว */
export interface ExtractedArchiveFile {
  /** เส้นทางเต็มของไฟล์ที่แตกแล้วใน temp sandbox */
  filePath: string;
  /** ตำแหน่งอ้างอิงภายใน archive (inner file path) สำหรับ citation */
  sourceLocator: string;
  /** ชื่อไฟล์เดิมใน archive */
  originalPath: string;
  /** ขนาดไฟล์ (bytes) */
  size: number;
}

/** ตัวเลือกสำหรับการแตก archive แบบปรับค่า limit ได้ */
export interface SecureArchiveOptions {
  /** จำนวนไฟล์สูงสุดที่อนุญาต (default 1000) */
  maxFileCount?: number;
  /** ขนาดรวมสูงสุดเมื่อแตกแล้ว (bytes, default 500MB) */
  maxExpandedSizeBytes?: number;
}

/**
 * บริการแตก ZIP archive อย่างปลอดภัยตาม ADR-016 (security)
 * - ตรวจ path traversal, encryption, nested depth, file count, expanded size
 * - แตกไฟล์ไปยัง temp sandbox ก่อน (two-phase) แล้วสแกน ClamAV
 * - คืน sourceLocator สำหรับ citation ที่ชี้ไปยัง inner file path
 */
@Injectable()
export class SecureArchiveService {
  private readonly logger = new Logger(SecureArchiveService.name);
  private readonly tempDir: string;

  private static readonly DEFAULT_MAX_FILE_COUNT = 1000;
  private static readonly DEFAULT_MAX_EXPANDED_SIZE = 500 * 1024 * 1024;
  private static readonly MAX_NESTED_DEPTH = 3;

  constructor(
    private readonly configService: ConfigService,
    private readonly clamAVService: ClamAVService
  ) {
    this.tempDir =
      this.configService.get<string>('UPLOAD_TEMP_DIR') ?? os.tmpdir();
  }

  /**
   * แตก ZIP archive อย่างปลอดภัย
   * ลำดับการตรวจสอบ: path traversal → encryption → file count → expanded size →
   * nested depth → extract to temp → ClamAV scan
   * @param zipPath เส้นทางของไฟล์ ZIP บน disk
   * @param options ตัวเลือกสำหรับปรับค่า limit
   * @returns รายการไฟล์ที่แตกแล้วพร้อม sourceLocator metadata
   * @throws BadRequestException เมื่อตรวจพบไฟล์ที่ไม่ปลอดภัย
   */
  public async extractSecurely(
    zipPath: string,
    options?: SecureArchiveOptions
  ): Promise<ExtractedArchiveFile[]> {
    const maxFileCount =
      options?.maxFileCount ?? SecureArchiveService.DEFAULT_MAX_FILE_COUNT;
    const maxExpandedSize =
      options?.maxExpandedSizeBytes ??
      SecureArchiveService.DEFAULT_MAX_EXPANDED_SIZE;

    const zipBuffer = fs.readFileSync(zipPath);
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // 1. ตรวจ path traversal — FR-038, SC-008
    for (const entry of entries) {
      if (this.isPathTraversal(entry.entryName)) {
        throw new BadRequestException(
          'ไฟล์ ZIP ไม่ปลอดภัย: ตรวจพบ entry ที่มี path ไม่ถูกต้อง กรุณาตรวจสอบไฟล์และอัปโหลดใหม่'
        );
      }
    }

    // 2. ตรวจ encryption — FR-038, SC-008
    for (const entry of entries) {
      if (entry.header.encrypted) {
        throw new BadRequestException(
          'ไฟล์ ZIP ไม่ปลอดภัย: ไม่รองรับไฟล์ที่เข้ารหัส กรุณาอัปโหลดไฟล์ที่ไม่เข้ารหัส'
        );
      }
    }

    // กรองเฉพาะ file entries (ไม่นับ directory)
    const fileEntries = entries.filter((e) => !e.isDirectory);

    // 3. ตรวจ file count — FR-038, SC-008
    if (fileEntries.length > maxFileCount) {
      throw new BadRequestException(
        `ไฟล์ ZIP ไม่ปลอดภัย: จำนวนไฟล์ (${fileEntries.length}) เกินกว่า limit ที่กำหนด (${maxFileCount})`
      );
    }

    // 4. ตรวจ expanded size — FR-038, SC-008 (decompression bomb)
    let totalExpandedSize = 0;
    for (const entry of fileEntries) {
      totalExpandedSize += entry.header.size;
    }
    if (totalExpandedSize > maxExpandedSize) {
      throw new BadRequestException(
        'ไฟล์ ZIP ไม่ปลอดภัย: ขนาดรวมเมื่อแตกแล้วเกินกว่า limit ที่กำหนด กรุณาตรวจสอบไฟล์'
      );
    }

    // 5. ตรวจ nested depth — FR-038, SC-008
    this.checkNestedDepth(zipBuffer, 0);

    // 6. Two-phase extraction — FR-037: แตกไปยัง temp sandbox
    const extractDir = path.join(this.tempDir, `secure-extract-${uuidv7()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    try {
      zip.extractAllTo(extractDir, true);

      // 6.1 ตรวจ symlink หลัง extraction — adm-zip ติดตาม symlink ใน archive
      // (GHSA vulnerability, ไม่มี patched version) — ป้องกัน arbitrary file overwrite
      this.rejectSymlinks(extractDir);

      // สร้างรายการไฟล์ที่แตกแล้ว
      const result: ExtractedArchiveFile[] = [];
      for (const entry of fileEntries) {
        const filePath = path.join(extractDir, entry.entryName);
        if (!fs.existsSync(filePath)) {
          continue;
        }
        const stat = fs.statSync(filePath);
        result.push({
          filePath,
          sourceLocator: entry.entryName,
          originalPath: entry.entryName,
          size: stat.size,
        });
      }

      // 7. ClamAV scan ไฟล์ทุกไฟล์หลังแตก (two-phase: extract → scan) — ADR-016
      for (const file of result) {
        const scanResult = await this.clamAVService.scanFile(file.filePath);
        if (scanResult.isInfected) {
          this.logger.warn(
            `ClamAV detected malware in extracted file: ${file.sourceLocator}`
          );
          throw new BadRequestException(
            'ไฟล์ ZIP ไม่ปลอดภัย: ตรวจพบไวรัสในไฟล์ที่แตก กรุณาสแกนไวรัสและอัปโหลดใหม่'
          );
        }
      }

      this.logger.log(
        `Secure extraction complete — ${result.length} files extracted and scanned`
      );
      return result;
    } catch (err) {
      // ทำความสะอาด temp directory เมื่อเกิดข้อผิดพลาด
      try {
        fs.rmSync(extractDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * ตรวจสอบและปฏิเสธ symlink ที่เกิดจาก extraction
   * - adm-zip 0.6.0 มี vulnerability ที่ติดตาม symlink ใน archive (ไม่มี patch)
   * - ตรวจทุกไฟล์/directory ใน extractDir แบบ recursive
   * - ป้องกัน arbitrary file overwrite ผ่าน symlink
   * @param dir directory ที่แตกไฟล์ไปแล้ว
   * @throws BadRequestException เมื่อตรวจพบ symlink
   */
  private rejectSymlinks(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new BadRequestException(
          'ไฟล์ ZIP ไม่ปลอดภัย: ตรวจพบ symlink ใน archive ซึ่งไม่ได้รับอนุญาต'
        );
      }
      if (entry.isDirectory()) {
        this.rejectSymlinks(fullPath);
      }
    }
  }

  /**
   * ตรวจสอบว่า entry name มี path traversal หรือไม่
   * - ตรวจ ../ (directory traversal)
   * - ตรวจ absolute path (/etc/passwd)
   * - ตรวจ Windows absolute path (C:\)
   */
  private isPathTraversal(entryName: string): boolean {
    const normalized = entryName.replace(/\\/g, '/');
    // directory traversal
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return true;
    }
    // Unix absolute path
    if (normalized.startsWith('/')) {
      return true;
    }
    // Windows absolute path (C:\, D:/, etc.)
    if (/^[a-zA-Z]:[\\/]/.test(normalized)) {
      return true;
    }
    return false;
  }

  /**
   * ตรวจสอบ nested depth ของ ZIP-within-ZIP แบบ recursive
   * @param zipBuffer buffer ของ ZIP ที่จะตรวจ
   * @param currentDepth depth ปัจจุบัน (0 = outermost)
   * @throws BadRequestException เมื่อ depth เกิน MAX_NESTED_DEPTH (3)
   */
  private checkNestedDepth(zipBuffer: Buffer, currentDepth: number): void {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }
      if (entry.entryName.toLowerCase().endsWith('.zip')) {
        const newDepth = currentDepth + 1;
        if (newDepth > SecureArchiveService.MAX_NESTED_DEPTH) {
          throw new BadRequestException(
            'ไฟล์ ZIP ไม่ปลอดภัย: ตรวจพบ ZIP ซ้อนกันเกินกว่า limit ที่กำหนด (3 ชั้น)'
          );
        }
        const nestedContent = entry.getData();
        // ตรวจสอบว่า content เป็น ZIP จริงก่อน recurse (entry อาจเป็น .zip
        // แต่ content ไม่ใช่ ZIP เช่นไฟล์ข้อความที่มีนามสกุล .zip)
        if (this.isZipBuffer(nestedContent)) {
          this.checkNestedDepth(nestedContent, newDepth);
        }
      }
    }
  }

  /**
   * ตรวจสอบว่า buffer เป็น ZIP archive หรือไม่ (ตรวจ magic bytes)
   * ZIP signature: PK\x03\x04 (local file header) หรือ PK\x05\x06 (empty archive)
   */
  private isZipBuffer(buf: Buffer): boolean {
    if (buf.length < 4) {
      return false;
    }
    // PK\x03\x04 = local file header, PK\x05\x06 = empty archive end
    const isLocalHeader =
      buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    const isEmptyArchive =
      buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x05 && buf[3] === 0x06;
    return isLocalHeader || isEmptyArchive;
  }
}
