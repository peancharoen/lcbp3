// File: backend/src/common/file-storage/secure-archive.service.spec.ts
// Change Log:
// - 2026-09-XX: T056 (Feature 254 Phase 6 US4) — เพิ่ม failing ZIP security tests
//   สำหรับ SecureArchiveService (RED — module ยังไม่มี, GREEN ไว้ที่ T060)
//   ครอบคลุม: path traversal, encryption, ClamAV malware, nested depth > 3,
//   file count > 1000, expanded size > 500MB, two-phase extraction, sourceLocator metadata
//   อ้างอิง: ADR-016 (security), ADR-007 (error handling), FR-037/FR-038/FR-039, SC-008

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import {
  SecureArchiveService,
  ExtractedArchiveFile,
  SecureArchiveOptions,
} from './secure-archive.service';
import { ClamAVService, ScanResult } from '../clamav/clamav.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions — สร้าง ZIP buffer สำหรับ test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** สร้าง ZIP buffer ปกติพร้อมไฟล์ตัวอย่าง */
function makeValidZipBuffer(
  entries: Record<string, string> = {
    'doc1.pdf': 'PDF content 1',
    'doc2.pdf': 'PDF content 2',
  }
): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

/** สร้าง ZIP buffer ที่มี path traversal entry ด้วย ../
 * adm-zip ทำ normalize path ทุกครั้ง จึงต้องสร้าง ZIP ด้วย raw bytes
 * โดยใช้โครงสร้าง local file header + central directory + EOCD ตาม ZIP spec
 */
function makeRawZipBuffer(entryName: string, content: string): Buffer {
  const nameBuf = Buffer.from(entryName, 'latin1');
  const contentBuf = Buffer.from(content);
  // Local file header (30 bytes + name + content)
  const lfHeader = Buffer.alloc(30);
  lfHeader.writeUInt32LE(0x04034b50, 0); // signature
  lfHeader.writeUInt16LE(20, 4); // version needed
  lfHeader.writeUInt16LE(0, 6); // flags
  lfHeader.writeUInt16LE(0, 8); // compression (stored)
  lfHeader.writeUInt16LE(0, 10); // mod time
  lfHeader.writeUInt16LE(0, 12); // mod date
  lfHeader.writeUInt32LE(0, 14); // crc32 (0 for stored, adm-zip recalcs)
  // crc32 ต้องคำนวณจริง เพื่อให้ adm-zip อ่านได้
  const crc = crc32(contentBuf);
  lfHeader.writeUInt32LE(crc, 14);
  lfHeader.writeUInt32LE(contentBuf.length, 18); // compressed size
  lfHeader.writeUInt32LE(contentBuf.length, 22); // uncompressed size
  lfHeader.writeUInt16LE(nameBuf.length, 26); // name length
  lfHeader.writeUInt16LE(0, 28); // extra field length

  // Central directory header (46 bytes + name)
  const cdHeader = Buffer.alloc(46);
  cdHeader.writeUInt32LE(0x02014b50, 0); // signature
  cdHeader.writeUInt16LE(20, 4); // version made by
  cdHeader.writeUInt16LE(20, 6); // version needed
  cdHeader.writeUInt16LE(0, 8); // flags
  cdHeader.writeUInt16LE(0, 10); // compression
  cdHeader.writeUInt16LE(0, 12); // mod time
  cdHeader.writeUInt16LE(0, 14); // mod date
  cdHeader.writeUInt32LE(crc, 16); // crc32
  cdHeader.writeUInt32LE(contentBuf.length, 20); // compressed size
  cdHeader.writeUInt32LE(contentBuf.length, 24); // uncompressed size
  cdHeader.writeUInt16LE(nameBuf.length, 28); // name length
  cdHeader.writeUInt16LE(0, 30); // extra field length
  cdHeader.writeUInt16LE(0, 32); // comment length
  cdHeader.writeUInt16LE(0, 34); // disk number
  cdHeader.writeUInt16LE(0, 36); // internal attrs
  cdHeader.writeUInt32LE(0, 38); // external attrs
  cdHeader.writeUInt32LE(30 + nameBuf.length + contentBuf.length, 42); // offset of local header

  // EOCD (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD
  eocd.writeUInt16LE(1, 8); // entries on disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(46 + nameBuf.length, 12); // CD size
  eocd.writeUInt32LE(30 + nameBuf.length + contentBuf.length, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([
    lfHeader,
    nameBuf,
    contentBuf,
    cdHeader,
    nameBuf,
    eocd,
  ]);
}

/** CRC32 implementation (standard ZIP polynomial) */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** สร้าง ZIP buffer ที่มี path traversal entry ด้วย ../ */
function makeTraversalZipBuffer(): Buffer {
  return makeRawZipBuffer('../escape.pdf', 'escape content');
}

/** สร้าง ZIP buffer ที่มี absolute path entry */
function makeAbsolutePathZipBuffer(): Buffer {
  return makeRawZipBuffer('/etc/passwd', 'absolute path content');
}

/** สร้าง ZIP buffer ที่มี Windows absolute path entry */
function makeWindowsAbsolutePathZipBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile('C:\\Windows\\system32\\config.txt', Buffer.from('windows path'));
  return zip.toBuffer();
}

/**
 * สร้าง encrypted ZIP buffer โดยตั้ง general purpose bit flag bit 0 (encryption)
 * ในทั้ง local file header และ central directory entry
 * adm-zip ไม่รองรับการสร้าง encrypted ZIP โดยตรง จึงต้อง manipulate raw bytes
 */
function makeEncryptedZipBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile('doc1.pdf', Buffer.from('encrypted content'));
  const buf = zip.toBuffer();

  // Local file header: general purpose bit flag ที่ offset 6 (2 bytes LE)
  const lfSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const lfOffset = buf.indexOf(lfSig);
  if (lfOffset !== -1) {
    buf.writeUInt16LE(buf.readUInt16LE(lfOffset + 6) | 0x0001, lfOffset + 6);
  }

  // Central directory: general purpose bit flag ที่ offset 8 (2 bytes LE)
  const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const cdOffset = buf.indexOf(cdSig);
  if (cdOffset !== -1) {
    buf.writeUInt16LE(buf.readUInt16LE(cdOffset + 8) | 0x0001, cdOffset + 8);
  }

  return buf;
}

/**
 * สร้าง nested ZIP buffer ที่มี depth ตามที่กำหนด
 * depth=4 หมายถึง zip ซ้อนกัน 4 ชั้น (zip within zip within zip within zip)
 */
function makeNestedZipBuffer(depth: number): Buffer {
  let current: Buffer = Buffer.from('innermost content');
  for (let i = depth; i > 0; i--) {
    const zip = new AdmZip();
    zip.addFile(`level-${i}.zip`, current);
    current = zip.toBuffer();
  }
  return current;
}

/** สร้าง ZIP buffer ที่มี file count ตามที่กำหนด */
function makeZipWithFileCount(count: number): Buffer {
  const zip = new AdmZip();
  for (let i = 0; i < count; i++) {
    zip.addFile(`file-${i}.txt`, Buffer.from(`content-${i}`));
  }
  return zip.toBuffer();
}

/**
 * สร้าง decompression bomb ZIP buffer — ไฟล์จริงเล็กแต่ header อ้างว่า
 * uncompressed size ใหญ่กว่าค่าที่กำหนด (จำลอง zip bomb attack)
 * แก้ uncompressed size ใน local file header (offset 22) และ
 * central directory entry (offset 24)
 */
function makeDecompressionBombBuffer(claimedUncompressedSize: number): Buffer {
  const zip = new AdmZip();
  zip.addFile('bomb.bin', Buffer.from('tiny compressed content'));
  const buf = zip.toBuffer();

  // Local file header: uncompressed size ที่ offset 22 (4 bytes LE)
  const lfSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const lfOffset = buf.indexOf(lfSig);
  if (lfOffset !== -1) {
    buf.writeUInt32LE(claimedUncompressedSize, lfOffset + 22);
  }

  // Central directory: uncompressed size ที่ offset 24 (4 bytes LE)
  const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const cdOffset = buf.indexOf(cdSig);
  if (cdOffset !== -1) {
    buf.writeUInt32LE(claimedUncompressedSize, cdOffset + 24);
  }

  return buf;
}

/** เขียน ZIP buffer ลง temp file แล้วคืน file path */
function writeZipToTemp(tempDir: string, name: string, buffer: Buffer): string {
  const filePath = path.join(tempDir, name);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SecureArchiveService', () => {
  let service: SecureArchiveService;
  let tempDir: string;
  let mockClamAV: { scanFile: jest.Mock<Promise<ScanResult>, [string]> };

  beforeEach(async () => {
    // สร้าง temp directory จริงสำหรับ test (ใช้ real fs ไม่ mock เพื่อทดสอบ extraction จริง)
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-archive-test-'));

    // Mock ClamAV — default สแกนผ่าน (isInfected: false)
    mockClamAV = {
      scanFile: jest.fn().mockResolvedValue({
        isInfected: false,
        scanned: true,
        viruses: [],
      } as ScanResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecureArchiveService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'UPLOAD_TEMP_DIR') return tempDir;
              return null;
            }),
          },
        },
        {
          provide: ClamAVService,
          useValue: mockClamAV,
        },
      ],
    }).compile();

    service = module.get<SecureArchiveService>(SecureArchiveService);
  });

  afterEach(() => {
    // ทำความสะอาด temp directory หลัง test แต่ละตัว
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Path Traversal — FR-038, SC-008
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — path traversal (FR-038)', () => {
    it('ควร reject ZIP ที่มี entry มี ../ (directory traversal)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'traversal.zip',
        makeTraversalZipBuffer()
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควร reject ZIP ที่มี absolute path entry (/etc/passwd)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'absolute.zip',
        makeAbsolutePathZipBuffer()
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควร reject ZIP ที่มี Windows absolute path entry (C:\\)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'windows-abs.zip',
        makeWindowsAbsolutePathZipBuffer()
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Encryption — FR-038, SC-008
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — encryption (FR-038)', () => {
    it('ควร reject encrypted/password-protected ZIP', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'encrypted.zip',
        makeEncryptedZipBuffer()
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Malware / ClamAV — FR-038, SC-008, ADR-016
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — malware / ClamAV (FR-038, ADR-016)', () => {
    it('ควร reject ZIP ที่มีไฟล์ติดไวรัส (ClamAV scan ล้มเหลว)', async () => {
      // Mock ClamAV ให้ตรวจพบไวรัส
      mockClamAV.scanFile.mockResolvedValue({
        isInfected: true,
        scanned: true,
        viruses: ['Eicar-Test-Signature'],
      } as ScanResult);

      const zipPath = writeZipToTemp(
        tempDir,
        'malware.zip',
        makeValidZipBuffer({ 'infected.pdf': 'fake malware content' })
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Nested Depth — FR-038, SC-008
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — nested depth (FR-038)', () => {
    it('ควร reject ZIP ที่มี nested depth > 3 (zip ซ้อน 4 ชั้น)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'nested.zip',
        makeNestedZipBuffer(4) // depth 4 > max 3
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควรอนุญาต ZIP ที่มี nested depth = 3 (ภายใน limit)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'nested-ok.zip',
        makeNestedZipBuffer(3) // depth 3 = max allowed
      );

      // ไม่ควร throw เพราะ depth 3 ยังอยู่ใน limit (depth > 3 ถึง reject)
      const result = await service.extractSecurely(zipPath);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. File Count — FR-038, SC-008
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — file count (FR-038)', () => {
    it('ควร reject ZIP ที่มี file count > 1000', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'too-many-files.zip',
        makeZipWithFileCount(1001) // 1001 > 1000 limit
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Expanded Size — FR-038, SC-008
  // ───────────────────────────────────────────────────────────────────────────

  describe('security validation — expanded size (FR-038)', () => {
    it('ควร reject ZIP ที่มี expanded size > 500MB (decompression bomb)', async () => {
      // จำลอง decompression bomb — header อ้างว่า uncompressed 600MB > 500MB limit
      const claimedSize = 600 * 1024 * 1024; // 600 MB
      const zipPath = writeZipToTemp(
        tempDir,
        'bomb.zip',
        makeDecompressionBombBuffer(claimedSize)
      );

      await expect(service.extractSecurely(zipPath)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Two-Phase Extraction — FR-037
  // ───────────────────────────────────────────────────────────────────────────

  describe('secure extraction — two-phase (FR-037)', () => {
    it('ควรแตก ZIP ที่ถูกต้องไปยัง temporary directory (two-phase)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'valid.zip',
        makeValidZipBuffer({
          'doc1.pdf': 'PDF content 1',
          'doc2.pdf': 'PDF content 2',
        })
      );

      const result = await service.extractSecurely(zipPath);

      // ต้องคืน array ของไฟล์ที่แตกแล้ว
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      // ไฟล์ที่แตกแล้วต้องมีอยู่จริงบน disk ใน temp sandbox
      for (const file of result) {
        expect(fs.existsSync(file.filePath)).toBe(true);
      }
    });

    it('ควร ClamAV scan ไฟล์ทุกไฟล์หลังแตก (two-phase: extract → scan)', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'valid-scan.zip',
        makeValidZipBuffer({
          'doc1.pdf': 'PDF content 1',
          'doc2.pdf': 'PDF content 2',
        })
      );

      await service.extractSecurely(zipPath);

      // ClamAV ต้องถูกเรียกอย่างน้อย 1 ครั้ง (สแกนไฟล์ที่แตกแล้ว)
      expect(mockClamAV.scanFile).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. SourceLocator Metadata — FR-039
  // ───────────────────────────────────────────────────────────────────────────

  describe('secure extraction — sourceLocator metadata (FR-039)', () => {
    it('ควรคืน list ของ extracted file paths พร้อม sourceLocator metadata', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'metadata.zip',
        makeValidZipBuffer({
          'doc1.pdf': 'PDF content 1',
          'doc2.pdf': 'PDF content 2',
        })
      );

      const result: ExtractedArchiveFile[] =
        await service.extractSecurely(zipPath);

      expect(result).toHaveLength(2);

      // แต่ละไฟล์ต้องมี sourceLocator ที่ระบุ inner file path
      const locators = result.map((f) => f.sourceLocator);
      expect(locators).toContain('doc1.pdf');
      expect(locators).toContain('doc2.pdf');

      // แต่ละ entry ต้องมี filePath (เส้นทางเต็มใน temp), originalPath, size
      for (const file of result) {
        expect(file.filePath).toBeDefined();
        expect(typeof file.filePath).toBe('string');
        expect(file.filePath.length).toBeGreaterThan(0);

        expect(file.sourceLocator).toBeDefined();
        expect(typeof file.sourceLocator).toBe('string');
        expect(file.sourceLocator.length).toBeGreaterThan(0);

        expect(file.originalPath).toBeDefined();
        expect(typeof file.originalPath).toBe('string');

        expect(file.size).toBeDefined();
        expect(typeof file.size).toBe('number');
        expect(file.size).toBeGreaterThan(0);
      }
    });

    it('sourceLocator ต้องรักษาโครงสร้าง subdirectory ใน ZIP', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'subdir.zip',
        makeValidZipBuffer({
          'top.pdf': 'top content',
          'subdir/nested.pdf': 'nested content',
        })
      );

      const result: ExtractedArchiveFile[] =
        await service.extractSecurely(zipPath);

      expect(result).toHaveLength(2);
      const locators = result.map((f) => f.sourceLocator);
      expect(locators).toContain('top.pdf');
      expect(locators).toContain('subdir/nested.pdf');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Custom options — ยืนยันว่า limits ปรับได้
  // ───────────────────────────────────────────────────────────────────────────

  describe('custom options', () => {
    it('ควรใช้ maxFileCount ที่กำหนดเองแทน default 1000', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'custom-count.zip',
        makeZipWithFileCount(5)
      );

      // กำหนด maxFileCount = 3 — 5 files > 3 ต้อง reject
      const options: SecureArchiveOptions = { maxFileCount: 3 };

      await expect(service.extractSecurely(zipPath, options)).rejects.toThrow(
        BadRequestException
      );
    });

    it('ควรใช้ maxExpandedSizeBytes ที่กำหนดเองแทน default 500MB', async () => {
      const zipPath = writeZipToTemp(
        tempDir,
        'custom-size.zip',
        makeDecompressionBombBuffer(2 * 1024 * 1024) // อ้างว่า 2MB
      );

      // กำหนด maxExpandedSizeBytes = 1MB — 2MB > 1MB ต้อง reject
      const options: SecureArchiveOptions = {
        maxExpandedSizeBytes: 1 * 1024 * 1024,
      };

      await expect(service.extractSecurely(zipPath, options)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  // -------------------------------------------------------------------------
  // security validation — symlink rejection (adm-zip GHSA mitigation)
  // -------------------------------------------------------------------------
  describe('security validation — symlink rejection (adm-zip GHSA mitigation)', () => {
    it('ปฏิเสธ ZIP ที่มี symlink หลัง extraction', () => {
      // สร้าง ZIP ปกติ จากนั้นสร้าง symlink ใน extractDir เพื่อจำลอง adm-zip behavior
      const zipBuffer = makeValidZipBuffer({ 'doc.pdf': 'content' });
      const zipPath = path.join(os.tmpdir(), `test-symlink-${Date.now()}.zip`);
      fs.writeFileSync(zipPath, zipBuffer);

      try {
        // สร้าง symlink ใน temp dir เพื่อจำลอง adm-zip ที่ติดตาม symlink
        // (ใน production adm-zip อาจสร้าง symlink จาก archive entry ที่เป็น symlink)
        const extractDir = path.join(
          os.tmpdir(),
          `secure-extract-symlink-test-${Date.now()}`
        );
        fs.mkdirSync(extractDir, { recursive: true });

        // สร้าง symlink จำลอง adm-zip extraction ที่ติดตาม symlink
        const linkPath = path.join(extractDir, 'malicious-link');
        fs.symlinkSync('/etc/passwd', linkPath);

        // เรียก rejectSymlinks ผ่าน extraction — ต้องเจอ symlink และปฏิเสธ
        // (ใช้ extractSecurely จริงจะไม่สร้าง symlink จาก valid ZIP,
        //  แต่ถ้า adm-zip มี bug ที่สร้าง symlink จาก archive, การตรวจนี้จะจับได้)
        // ทดสอบโดยตรง: สร้าง ZIP ที่มี entry เป็น symlink (ถ้า adm-zip รองรับ)
        // หรือทดสอบ rejectSymlinks ที่ทำงานหลัง extraction

        // ทดสอบ: ถ้ามี symlink ใน extractDir ต้องปฏิเสธ
        expect(() =>
          (
            service as unknown as { rejectSymlinks: (dir: string) => void }
          ).rejectSymlinks(extractDir)
        ).toThrow(BadRequestException);

        // cleanup
        fs.rmSync(extractDir, { recursive: true, force: true });
      } finally {
        fs.unlinkSync(zipPath);
      }
    });

    it('อนุญาต ZIP ปกติที่ไม่มี symlink', async () => {
      const zipBuffer = makeValidZipBuffer({
        'doc1.pdf': 'content1',
        'doc2.pdf': 'content2',
      });
      const zipPath = path.join(
        os.tmpdir(),
        `test-no-symlink-${Date.now()}.zip`
      );
      fs.writeFileSync(zipPath, zipBuffer);

      try {
        const result = await service.extractSecurely(zipPath);
        expect(result.length).toBe(2);
        // ตรวจว่าไม่มี symlink ในผลลัพธ์
        for (const file of result) {
          const stat = fs.lstatSync(file.filePath);
          expect(stat.isSymbolicLink()).toBe(false);
        }
      } finally {
        fs.unlinkSync(zipPath);
      }
    });
  });
});
