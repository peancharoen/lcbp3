// File: src/common/services/crypto.service.ts
// บันทึกการแก้ไข: Encryption/Decryption Utility (T1.1)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16;

  constructor(private configService: ConfigService) {
    // Key ต้องมีขนาด 32 bytes (256 bits)
    const secret =
      this.configService.get<string>('APP_SECRET_KEY') ||
      'default-secret-key-32-chars-long!';
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  encrypt(
    text: string | number | boolean | null | undefined
  ): string | null | undefined {
    if (text === null || text === undefined) return text;

    try {
      const stringValue = String(text);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(stringValue, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error: unknown) {
      this.logger.error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  decrypt(text: string): string {
    if (!text || typeof text !== 'string' || !text.includes(':')) return text;

    try {
      const [ivHex, encryptedHex] = text.split(':');
      if (!ivHex || !encryptedHex) return text;

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error: unknown) {
      this.logger.warn(
        `Decryption failed for value. Returning original text. Error: ${error instanceof Error ? error.message : String(error)}`
      );
      // กรณี Decrypt ไม่ได้ ให้คืนค่าเดิมเพื่อป้องกัน App Crash
      return text;
    }
  }
}
