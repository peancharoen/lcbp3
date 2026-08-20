// File: backend/src/common/clamav/clamav.service.ts
// Change Log:
// - 2026-08-20: Initial creation — ClamAV virus scanning service (ADR-016 SEV-002)
//
// ใช้ Node net module เชื่อมต่อ ClamAV daemon ผ่าน TCP socket (default port 3310)
// ไม่ต้องการ npm package เพิ่มเติม — ใช้ INSTREAM protocol ตาม ClamAV spec
// หาก ClamAV ไม่ available (CLAMAV_ENABLED=false หรือเชื่อมต่อไม่ได้) จะข้ามการสแกน
// และ log warning เพื่อไม่ให้ block การทำงานใน environment ที่ยังไม่มี ClamAV

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

export interface ScanResult {
  isInfected: boolean;
  viruses?: string[];
  scanned: boolean;
}

/**
 * ADR-016: ClamAV virus scanning service
 * เชื่อมต่อ ClamAV daemon ผ่าน TCP socket (port 3310) โดยใช้ INSTREAM protocol
 */
@Injectable()
export class ClamAVService {
  private readonly logger = new Logger(ClamAVService.name);
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly port: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly _dummy?: unknown
  ) {
    this.enabled =
      this.configService.get<string>('CLAMAV_ENABLED', 'false') === 'true';
    this.host = this.configService.get<string>('CLAMAV_HOST', 'clamav');
    this.port = this.configService.get<number>('CLAMAV_PORT', 3310);
  }

  /**
   * สแกนไฟล์ด้วย ClamAV — ใช้ INSTREAM protocol ส่งไฟล์ผ่าน TCP socket
   * @param filePath path ของไฟล์ที่ต้องการสแกน
   * @returns ScanResult แสดงผลการสแกน
   */
  async scanFile(filePath: string): Promise<ScanResult> {
    // ถ้า ClamAV ไม่ได้เปิดใช้งาน ให้ข้ามและ log warning
    if (!this.enabled) {
      this.logger.warn(
        `ClamAV disabled (CLAMAV_ENABLED=false) — skipping scan for ${path.basename(filePath)}`
      );
      return { isInfected: false, scanned: false };
    }

    // ตรวจสอบว่าไฟล์มีอยู่จริง
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`ClamAV scan skipped — file not found: ${filePath}`);
      return { isInfected: false, scanned: false };
    }

    return this.scanViaInstream(filePath);
  }

  /**
   * สแกนไฟล์ผ่าน INSTREAM protocol
   * Protocol: ส่ง "zINSTREAM\0" ตามด้วย chunks (4-byte length + data) และ 0-length terminator
   * ClamAV ตอบกลับด้วย "stream: OK" หรือ "stream: INFECTED <virus>"
   */
  private async scanViaInstream(filePath: string): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve) => {
      const socket = new net.Socket();
      let response = '';
      const chunks: Buffer[] = [];
      let fileSize = 0;

      socket.setTimeout(30000); // 30s timeout สำหรับไฟล์ใหญ่

      socket.on('connect', () => {
        // ส่ง INSTREAM command
        socket.write('zINSTREAM\0');

        // ส่งไฟล์เป็น chunks (max 64KB per chunk)
        const readStream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024,
        });

        readStream.on('data', (chunk: Buffer) => {
          fileSize += chunk.length;
          // 4-byte big-endian length + data
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length, 0);
          socket.write(Buffer.concat([header, chunk]));
        });

        readStream.on('end', () => {
          // ส่ง 0-length terminator
          const terminator = Buffer.alloc(4);
          terminator.writeUInt32BE(0, 0);
          socket.write(terminator);
        });

        readStream.on('error', (err: Error) => {
          this.logger.error(
            `ClamAV scan failed — read error for ${path.basename(filePath)}: ${err.message}`
          );
          socket.destroy();
          resolve({ isInfected: false, scanned: false });
        });
      });

      socket.on('data', (data: Buffer) => {
        chunks.push(data);
      });

      socket.on('close', () => {
        response = Buffer.concat(chunks).toString('utf-8').trim();
        const result = this.parseResponse(response);
        if (result.isInfected) {
          this.logger.warn(
            `ClamAV detected virus in ${path.basename(filePath)}: ${result.viruses?.join(', ')}`
          );
        } else if (result.scanned) {
          this.logger.log(
            `ClamAV scan passed for ${path.basename(filePath)} (${fileSize} bytes)`
          );
        }
        resolve(result);
      });

      socket.on('timeout', () => {
        this.logger.warn(
          `ClamAV scan timed out for ${path.basename(filePath)} — skipping`
        );
        socket.destroy();
        resolve({ isInfected: false, scanned: false });
      });

      socket.on('error', (err: Error) => {
        this.logger.warn(
          `ClamAV connection failed (${this.host}:${this.port}): ${err.message} — skipping scan for ${path.basename(filePath)}`
        );
        socket.destroy();
        resolve({ isInfected: false, scanned: false });
      });

      socket.connect(this.port, this.host);
    });
  }

  /**
   * Parse ClamAV response — "stream: OK" หรือ "stream: INFECTED <virus>"
   */
  private parseResponse(response: string): ScanResult {
    if (!response) {
      return { isInfected: false, scanned: false };
    }

    // ตัด null terminator และ whitespace
    const cleanResponse = response.replace(/\0/g, '').trim();

    if (cleanResponse.includes('OK')) {
      return { isInfected: false, scanned: true };
    }

    if (cleanResponse.includes('INFECTED')) {
      // แยกชื่อ virus จาก response: "stream: INFECTED: Virus.Name"
      const match = cleanResponse.match(/INFECTED:\s*(.+)/);
      const viruses = match
        ? match[1]
            .split(/[,;]/)
            .map((v) => v.trim())
            .filter(Boolean)
        : ['UNKNOWN'];
      return { isInfected: true, viruses, scanned: true };
    }

    // Response อื่นๆ (เช่น ERROR) — ถือว่าไม่ infected แต่ไม่ scanned สำเร็จ
    this.logger.warn(`ClamAV unexpected response: ${cleanResponse}`);
    return { isInfected: false, scanned: false };
  }

  /**
   * ตรวจสอบว่า ClamAV service พร้อมใช้งานหรือไม่ (สำหรับ health check)
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;

    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(this.port, this.host);
    });
  }
}
