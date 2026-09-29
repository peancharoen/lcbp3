// File: backend/src/scripts/seed-telegram-settings.ts
// Change Log:
// - 2026-09-29: สร้าง seed script สำหรับ TELEGRAM_* rows ใน system_settings (T003a)

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { CryptoService } from '../common/services/crypto.service';

/**
 * Ops script (T003a): upsert TELEGRAM_* keys ลง system_settings บน live DB
 * ใช้ CryptoService ตัวจริงของ app — encryption format ตรงกับที่
 * TelegramBotService.getSetting() decrypt เสมอ (ไม่มี algorithm drift)
 *
 * วิธีใช้ — รันใน env ของ backend (เช่นใน backend container บน 192.168.10.11):
 *
 *   TELEGRAM_BOT_TOKEN='<จาก @BotFather>' \
 *   TELEGRAM_WEBHOOK_SECRET='<openssl rand -hex 32>' \
 *   TELEGRAM_BOT_USERNAME='<ชื่อ bot ไม่มี @>' \
 *   TELEGRAM_ENABLED='true' \
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-telegram-settings.ts
 *
 * ห้าม hardcode secret ลงไฟล์นี้เด็ดขาด — รับผ่าน env เท่านั้น
 * Idempotent: INSERT ... ON DUPLICATE KEY UPDATE — รันซ้ำได้ปลอดภัย
 */

const logger = new Logger('SeedTelegramSettings');

interface SettingRow {
  setting_key: string;
  is_encrypted: number;
  len: number;
}

/** อ่าน env ที่บังคับ — fail fast, ไม่ log ค่าจริง */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function bootstrap(): Promise<void> {
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const webhookSecret = requireEnv('TELEGRAM_WEBHOOK_SECRET');
  if (webhookSecret.length < 32) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
  }
  const botUsername = requireEnv('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
  const enabled = process.env.TELEGRAM_ENABLED?.trim() || 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const cryptoService = app.get(CryptoService);
    const dataSource = app.get(DataSource);

    // [setting_key, value (encrypted แล้วถ้าจำเป็น), data_type, is_encrypted]
    const rows: Array<[string, string, string, number]> = [
      ['TELEGRAM_ENABLED', enabled, 'boolean', 0],
      ['TELEGRAM_BOT_USERNAME', botUsername, 'string', 0],
      [
        'TELEGRAM_BOT_TOKEN',
        String(cryptoService.encrypt(botToken)),
        'string',
        1,
      ],
      [
        'TELEGRAM_WEBHOOK_SECRET',
        String(cryptoService.encrypt(webhookSecret)),
        'string',
        1,
      ],
    ];

    for (const [key, value, dataType, isEncrypted] of rows) {
      await dataSource.query(
        `INSERT INTO system_settings
           (setting_key, setting_value, data_type, category, is_encrypted, is_public, description)
         VALUES (?, ?, ?, 'notification', ?, 0, 'Telegram notification channel (F258)')
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           data_type = VALUES(data_type),
           category = VALUES(category),
           is_encrypted = VALUES(is_encrypted)`,
        [key, value, dataType, isEncrypted]
      );
      // log เฉพาะ key + flag — ห้าม log setting_value ของ encrypted rows
      logger.log(
        `upserted ${key} (encrypted=${isEncrypted}, len=${value.length})`
      );
    }

    // verify — อ่านกลับเฉพาะ key/flag/length, ไม่แสดงค่าจริง
    const verify = await dataSource.query<SettingRow[]>(
      `SELECT setting_key, is_encrypted, LENGTH(setting_value) AS len
         FROM system_settings WHERE setting_key LIKE 'TELEGRAM_%'
         ORDER BY setting_key`
    );
    logger.log('system_settings state:');
    for (const row of verify) {
      logger.log(
        `  ${row.setting_key}  encrypted=${row.is_encrypted}  len=${row.len}`
      );
    }
    logger.log('Done — Redis cache TTL 30s แล้วค่ามีผล');
    logger.log(
      'ขั้นต่อไป: setWebhook ตาม specs/200-fullstacks/258-telegram-notifications/quickstart.md'
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  logger.error(
    `seed-telegram-settings failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
