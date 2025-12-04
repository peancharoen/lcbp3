import { MigrationInterface, QueryRunner } from 'typeorm';

export class V1_5_1_Schema_Update1701676800000 implements MigrationInterface {
  name = 'V1_5_1_Schema_Update1701676800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Disciplines Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`disciplines\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
        \`contract_id\` INT NOT NULL COMMENT 'ผูกกับสัญญา',
        \`discipline_code\` VARCHAR(10) NOT NULL COMMENT 'รหัสสาขา (เช่น GEN, STR)',
        \`code_name_th\` VARCHAR(255) COMMENT 'ชื่อไทย',
        \`code_name_en\` VARCHAR(255) COMMENT 'ชื่ออังกฤษ',
        \`is_active\` TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`contract_id\`) REFERENCES \`contracts\` (\`id\`) ON DELETE CASCADE,
        UNIQUE KEY \`uk_discipline_contract\` (\`contract_id\`, \`discipline_code\`)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลสาขางาน (Disciplines) ตาม Req 6B';
    `);

    // 2. Create Correspondence Sub Types Table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`correspondence_sub_types\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
        \`contract_id\` INT NOT NULL COMMENT 'ผูกกับสัญญา',
        \`correspondence_type_id\` INT NOT NULL COMMENT 'ผูกกับประเภทเอกสารหลัก (เช่น RFA)',
        \`sub_type_code\` VARCHAR(20) NOT NULL COMMENT 'รหัสย่อย (เช่น MAT, SHP)',
        \`sub_type_name\` VARCHAR(255) COMMENT 'ชื่อประเภทหนังสือย่อย',
        \`sub_type_number\` VARCHAR(10) COMMENT 'เลขรหัสสำหรับ Running Number (เช่น 11, 22)',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`contract_id\`) REFERENCES \`contracts\` (\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`correspondence_type_id\`) REFERENCES \`correspondence_types\` (\`id\`) ON DELETE CASCADE
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บประเภทหนังสือย่อย (Sub Types) ตาม Req 6B';
    `);

    // 3. Add discipline_id to correspondences
    const hasDisciplineCol = await queryRunner.hasColumn(
      'correspondences',
      'discipline_id'
    );
    if (!hasDisciplineCol) {
      await queryRunner.query(`
        ALTER TABLE \`correspondences\`
        ADD COLUMN \`discipline_id\` INT NULL COMMENT 'สาขางาน (ถ้ามี)' AFTER \`correspondence_type_id\`,
        ADD CONSTRAINT \`fk_corr_discipline\` FOREIGN KEY (\`discipline_id\`) REFERENCES \`disciplines\` (\`id\`) ON DELETE SET NULL;
      `);
    }

    // 4. Add discipline_id to rfas
    const hasRfaDisciplineCol = await queryRunner.hasColumn(
      'rfas',
      'discipline_id'
    );
    if (!hasRfaDisciplineCol) {
      await queryRunner.query(`
        ALTER TABLE \`rfas\`
        ADD COLUMN \`discipline_id\` INT NULL COMMENT 'สาขางาน (ถ้ามี)' AFTER \`rfa_type_id\`,
        ADD CONSTRAINT \`fk_rfa_discipline\` FOREIGN KEY (\`discipline_id\`) REFERENCES \`disciplines\` (\`id\`) ON DELETE SET NULL;
      `);
    }

    // 5. Create Document Numbering Audit & Errors
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`document_number_audit\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`project_id\` INT NOT NULL,
        \`correspondence_type_id\` INT NOT NULL,
        \`running_number\` INT NOT NULL,
        \`full_document_number\` VARCHAR(100) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`created_by\` INT NULL
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`document_number_errors\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`error_code\` VARCHAR(50),
        \`error_message\` TEXT,
        \`context_data\` JSON,
        \`occurred_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    // 6. Create RFA Items (Linking RFA to Shop Drawings)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`rfa_items\` (
        \`rfarev_correspondence_id\` INT COMMENT 'ID ของ RFA Revision',
        \`shop_drawing_revision_id\` INT COMMENT 'ID ของ Shop Drawing Revision',
        PRIMARY KEY (\`rfarev_correspondence_id\`, \`shop_drawing_revision_id\`)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    // 7. Create Transmittal Tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`transmittals\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
        \`correspondence_id\` INT UNIQUE COMMENT 'ID ของเอกสาร',
        \`transmittal_no\` VARCHAR(100) NOT NULL COMMENT 'เลขที่ใบนำส่ง',
        \`subject\` VARCHAR(500) NOT NULL COMMENT 'เรื่อง',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`correspondence_id\`) REFERENCES \`correspondences\` (\`id\`)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`transmittal_items\` (
        \`transmittal_id\` INT NOT NULL,
        \`item_type\` VARCHAR(50) NOT NULL COMMENT 'ประเภทรายการ (DRAWING, RFA, etc.)',
        \`item_id\` INT NOT NULL COMMENT 'ID ของรายการ',
        \`description\` TEXT,
        PRIMARY KEY (\`transmittal_id\`, \`item_type\`, \`item_id\`),
        FOREIGN KEY (\`transmittal_id\`) REFERENCES \`transmittals\` (\`id\`) ON DELETE CASCADE
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    // 8. Create Circulation Tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`circulation_status_codes\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`code\` VARCHAR(20) NOT NULL UNIQUE,
        \`description\` VARCHAR(50) NOT NULL,
        \`sort_order\` INT DEFAULT 0,
        \`is_active\` TINYINT(1) DEFAULT 1
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`circulations\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`correspondence_id\` INT UNIQUE,
        \`organization_id\` INT NOT NULL,
        \`circulation_no\` VARCHAR(100) NOT NULL,
        \`circulation_subject\` VARCHAR(500) NOT NULL,
        \`circulation_status_code\` VARCHAR(20) NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`submitted_at\` TIMESTAMP NULL,
        \`closed_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`correspondence_id\`) REFERENCES \`correspondences\` (\`id\`),
        FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`),
        FOREIGN KEY (\`circulation_status_code\`) REFERENCES \`circulation_status_codes\` (\`code\`)
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`circulation_attachments\` (
        \`circulation_id\` INT NOT NULL,
        \`attachment_id\` INT NOT NULL,
        PRIMARY KEY (\`circulation_id\`, \`attachment_id\`),
        FOREIGN KEY (\`circulation_id\`) REFERENCES \`circulations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS circulation_attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS circulations`);
    await queryRunner.query(`DROP TABLE IF EXISTS circulation_status_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS transmittal_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS transmittals`);
    await queryRunner.query(`DROP TABLE IF EXISTS rfa_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS document_number_errors`);
    await queryRunner.query(`DROP TABLE IF EXISTS document_number_audit`);

    // Remove columns
    const hasRfaDisciplineCol = await queryRunner.hasColumn(
      'rfas',
      'discipline_id'
    );
    if (hasRfaDisciplineCol) {
      await queryRunner.query(
        `ALTER TABLE rfas DROP FOREIGN KEY fk_rfa_discipline`
      );
      await queryRunner.query(`ALTER TABLE rfas DROP COLUMN discipline_id`);
    }

    const hasDisciplineCol = await queryRunner.hasColumn(
      'correspondences',
      'discipline_id'
    );
    if (hasDisciplineCol) {
      await queryRunner.query(
        `ALTER TABLE correspondences DROP FOREIGN KEY fk_corr_discipline`
      );
      await queryRunner.query(
        `ALTER TABLE correspondences DROP COLUMN discipline_id`
      );
    }

    await queryRunner.query(`DROP TABLE IF EXISTS correspondence_sub_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS disciplines`);
  }
}
