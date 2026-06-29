// File: backend/scratch/query-prompts.ts
// Change Log
// - 2026-05-29: Created fully ESLint-compliant database diagnostic utility (ADR-029)
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

const logger = new Logger('QueryPromptsDiagnostic');

interface PromptRow {
  id: number;
  public_id: string;
  prompt_type: string;
  version_number: number;
  is_active: number;
  snippet: string;
}

/**
 * ดึงข้อมูลการเชื่อมต่อฐานข้อมูลจากไฟล์ .env.local
 */
function parseEnvConfig(): Record<string, string> {
  const config: Record<string, string> = {};
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const parts = trimmed.split('=');
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          config[key] = val;
        }
      });
    }
  } catch (err: unknown) {
    logger.warn(
      `ไม่สามารถอ่านไฟล์ .env.local ได้: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return config;
}

async function main(): Promise<void> {
  const env = parseEnvConfig();
  const dbHost = env.DB_HOST || '127.0.0.1';
  const dbPort = env.DB_PORT ? Number(env.DB_PORT) : 3306;
  const dbUser = env.DB_USERNAME || 'admin';
  const dbPass = env.DB_PASSWORD || 'Center2025';
  const dbName = env.DB_DATABASE || 'lcbp3_dev';

  logger.log(
    `กำลังเชื่อมต่อฐานข้อมูลที่ ${dbHost}:${dbPort} (Database: ${dbName})...`
  );

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: dbName,
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, public_id, prompt_type, version_number, is_active, LEFT(template, 30) as snippet FROM ai_prompts'
    );
    logger.log('--- ข้อมูลในตาราง ai_prompts ---');
    const prompts = rows as PromptRow[];
    prompts.forEach((row) => {
      logger.log(
        `[v${row.version_number}] ID: ${row.id} | PublicID: ${row.public_id} | Type: ${row.prompt_type} | Active: ${row.is_active} | Snippet: ${row.snippet}`
      );
    });
  } catch (err: unknown) {
    logger.error(
      `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await connection.end();
  }
}

// รันฟังก์ชันหลักโดยดักจับข้อผิดพลาดทั้งหมดและป้องกัน floating promise
main().catch((err: unknown) => {
  logger.error(
    `ข้อผิดพลาดร้ายแรงขณะรันสคริปต์: ${err instanceof Error ? err.message : String(err)}`
  );
});
