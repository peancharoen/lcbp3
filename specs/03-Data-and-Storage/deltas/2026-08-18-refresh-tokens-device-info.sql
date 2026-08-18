-- File: specs/03-Data-and-Storage/deltas/2026-08-18-refresh-tokens-device-info.sql
-- Change Log:
-- - 2026-08-18: Initial delta for refresh_tokens device info tracking
-- Description:
--   1. เพิ่ม columns สำหรับเก็บ device info ของ session: device_name, ip_address, user_agent, last_active_at
--   2. ใช้สำหรับ admin/monitoring/sessions แสดงข้อมูล device และ IP จริงแทน "Unknown Device"/"Unknown IP"
-- อ้างอิง: ADR-009 (schema delta ไม่ใช้ TypeORM migration), ADR-044 (formalize delta process)
--
-- หมายเหตุ:
--   - ทุก column เป็น nullable เพื่อรองรับ existing rows ที่ไม่มี device info
--   - ip_address VARCHAR(45) รองรับทั้ง IPv4 และ IPv6
--   - user_agent VARCHAR(512) เก็บ raw user-agent string สำหรับ security forensics
--   - last_active_at ใช้ track การใช้งานล่าสุด (update ตอน refresh token rotation)
--   - ตาม ADR-044: รัน manual โดย DBA หลัง review — ไม่ auto-run ใน CI/CD

-- 1. เพิ่ม columns สำหรับ device info
ALTER TABLE refresh_tokens
  ADD COLUMN device_name VARCHAR(255) NULL COMMENT 'ชื่อ device ที่ parse จาก user-agent (เช่น Windows · Chrome)' AFTER is_revoked,
  ADD COLUMN ip_address VARCHAR(45) NULL COMMENT 'IP address จริงของ client (จาก CF-Connecting-IP หรือ X-Forwarded-For)' AFTER device_name,
  ADD COLUMN user_agent VARCHAR(512) NULL COMMENT 'Raw User-Agent string สำหรับ security forensics' AFTER ip_address,
  ADD COLUMN last_active_at DATETIME NULL COMMENT 'เวลาใช้งานล่าสุด (update ตอน refresh token rotation)' AFTER user_agent;
