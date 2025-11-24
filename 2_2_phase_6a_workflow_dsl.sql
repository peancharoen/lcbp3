-- File: database/migrations/phase_6a_workflow_dsl.sql
-- ตารางสำหรับเก็บนิยามของ Workflow (Workflow Definition)
CREATE TABLE workflow_definitions (
    id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID ของ Workflow Definition',
    workflow_code VARCHAR(50) NOT NULL COMMENT 'รหัส Workflow เช่น RFA, CORR, CIRCULATION',
    version INT NOT NULL DEFAULT 1 COMMENT 'หมายเลข Version',
    dsl JSON NOT NULL COMMENT 'นิยาม Workflow ต้นฉบับ (YAML/JSON Format)',
    compiled JSON NOT NULL COMMENT 'โครงสร้าง Execution Tree ที่ Compile แล้ว',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    -- ป้องกันการมี Workflow Code และ Version ซ้ำกัน
    UNIQUE KEY uq_workflow_version (workflow_code, version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตารางเก็บนิยามกฎการเดินเอกสาร (Workflow DSL)';
-- สร้าง Index สำหรับการค้นหา Workflow ที่ Active ล่าสุดได้เร็วขึ้น
CREATE INDEX idx_workflow_active ON workflow_definitions(workflow_code, is_active, version);