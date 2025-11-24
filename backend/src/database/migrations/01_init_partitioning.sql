-- ============================================================
-- Database Partitioning Script for LCBP3-DMS (Fixed #1075)
-- Target Tables: audit_logs, notifications
-- Strategy: Range Partitioning by YEAR(created_at)
-- ============================================================
-- ------------------------------------------------------------
-- 1. Audit Logs Partitioning
-- ------------------------------------------------------------
-- Step 1: เอา AUTO_INCREMENT ออกก่อน (เพื่อไม่ให้ติด Error 1075 ตอนลบ PK)
ALTER TABLE audit_logs
MODIFY audit_id BIGINT NOT NULL;
-- Step 2: ลบ Primary Key เดิม
ALTER TABLE audit_logs DROP PRIMARY KEY;
-- Step 3: สร้าง Primary Key ใหม่ (รวม created_at เพื่อทำ Partition)
ALTER TABLE audit_logs
ADD PRIMARY KEY (audit_id, created_at);
-- Step 4: ใส่ AUTO_INCREMENT กลับเข้าไป
ALTER TABLE audit_logs
MODIFY audit_id BIGINT NOT NULL AUTO_INCREMENT;
-- Step 5: สร้าง Partition
ALTER TABLE audit_logs PARTITION BY RANGE (YEAR(created_at)) (
        PARTITION p_old
        VALUES LESS THAN (2024),
            PARTITION p2024
        VALUES LESS THAN (2025),
            PARTITION p2025
        VALUES LESS THAN (2026),
            PARTITION p2026
        VALUES LESS THAN (2027),
            PARTITION p2027
        VALUES LESS THAN (2028),
            PARTITION p2028
        VALUES LESS THAN (2029),
            PARTITION p2029
        VALUES LESS THAN (2030),
            PARTITION p2030
        VALUES LESS THAN (2031),
            PARTITION p_future
        VALUES LESS THAN MAXVALUE
    );
-- ------------------------------------------------------------
-- 2. Notifications Partitioning
-- ------------------------------------------------------------
-- Step 1: เอา AUTO_INCREMENT ออกก่อน
ALTER TABLE notifications
MODIFY id INT NOT NULL;
-- Step 2: ลบ Primary Key เดิม
ALTER TABLE notifications DROP PRIMARY KEY;
-- Step 3: สร้าง Primary Key ใหม่
ALTER TABLE notifications
ADD PRIMARY KEY (id, created_at);
-- Step 4: ใส่ AUTO_INCREMENT กลับเข้าไป
ALTER TABLE notifications
MODIFY id INT NOT NULL AUTO_INCREMENT;
-- Step 5: สร้าง Partition
ALTER TABLE notifications PARTITION BY RANGE (YEAR(created_at)) (
        PARTITION p_old
        VALUES LESS THAN (2024),
            PARTITION p2024
        VALUES LESS THAN (2025),
            PARTITION p2025
        VALUES LESS THAN (2026),
            PARTITION p2026
        VALUES LESS THAN (2027),
            PARTITION p2027
        VALUES LESS THAN (2028),
            PARTITION p2028
        VALUES LESS THAN (2029),
            PARTITION p2029
        VALUES LESS THAN (2030),
            PARTITION p2030
        VALUES LESS THAN (2031),
            PARTITION p_future
        VALUES LESS THAN MAXVALUE
    );