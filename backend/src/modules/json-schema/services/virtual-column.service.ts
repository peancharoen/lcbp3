// File: src/modules/json-schema/services/virtual-column.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { VirtualColumnConfig } from '../entities/json-schema.entity';

@Injectable()
export class VirtualColumnService {
  private readonly logger = new Logger(VirtualColumnService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * สร้าง/อัปเดต Virtual Columns และ Index บน Database จริง
   */
  async setupVirtualColumns(tableName: string, configs: VirtualColumnConfig[]) {
    if (!configs || configs.length === 0) return;

    // ใช้ QueryRunner เพื่อให้จัดการ Transaction หรือ Connection ได้ละเอียด
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      this.logger.log(
        `Start setting up virtual columns for table '${tableName}'...`,
      );

      // 1. ตรวจสอบว่าตารางมีอยู่จริงไหม
      const tableExists = await queryRunner.hasTable(tableName);
      if (!tableExists) {
        this.logger.warn(
          `Table '${tableName}' not found. Skipping virtual columns.`,
        );
        return;
      }

      for (const config of configs) {
        await this.ensureVirtualColumn(queryRunner, tableName, config);

        if (config.index_type) {
          await this.ensureIndex(queryRunner, tableName, config);
        }
      }

      this.logger.log(
        `Finished setting up virtual columns for '${tableName}'.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to setup virtual columns: ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * สร้าง Column ถ้ายังไม่มี
   */
  private async ensureVirtualColumn(
    queryRunner: QueryRunner,
    tableName: string,
    config: VirtualColumnConfig,
  ) {
    const hasColumn = await queryRunner.hasColumn(
      tableName,
      config.column_name,
    );

    if (!hasColumn) {
      const sql = this.generateAddColumnSql(tableName, config);
      this.logger.log(`Executing: ${sql}`);
      await queryRunner.query(sql);
    } else {
      // TODO: (Advance) ถ้ามี Column แล้ว แต่ Definition เปลี่ยน อาจต้อง ALTER MODIFY
      this.logger.debug(
        `Column '${config.column_name}' already exists in '${tableName}'.`,
      );
    }
  }

  /**
   * สร้าง Index ถ้ายังไม่มี
   */
  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    config: VirtualColumnConfig,
  ) {
    const indexName = `idx_${tableName}_${config.column_name}`;

    // ตรวจสอบว่า Index มีอยู่จริงไหม (Query จาก information_schema เพื่อความชัวร์)
    const checkIndexSql = `
      SELECT COUNT(1) as count
      FROM information_schema.STATISTICS
      WHERE table_schema = DATABASE()
      AND table_name = ?
      AND index_name = ?
    `;
    const result = await queryRunner.query(checkIndexSql, [
      tableName,
      indexName,
    ]);

    if (result[0].count == 0) {
      const sql = `CREATE ${config.index_type === 'UNIQUE' ? 'UNIQUE' : ''} INDEX ${indexName} ON ${tableName} (${config.column_name})`;
      this.logger.log(`Creating Index: ${sql}`);
      await queryRunner.query(sql);
    }
  }

  /**
   * Generate SQL สำหรับ MariaDB 10.11 Virtual Column
   * Syntax: ADD COLUMN name type GENERATED ALWAYS AS (expr) VIRTUAL
   */
  private generateAddColumnSql(
    tableName: string,
    config: VirtualColumnConfig,
  ): string {
    const dbType = this.mapDataTypeToSql(config.data_type);
    // JSON_UNQUOTE(JSON_EXTRACT(details, '$.path'))
    // ใช้ 'details' เป็นชื่อ column JSON หลัก (ต้องตรงกับ Database Schema ที่ออกแบบไว้)
    const expression = `JSON_UNQUOTE(JSON_EXTRACT(details, '${config.json_path}'))`;

    // Handle Type Casting inside expression if needed,
    // but usually MariaDB handles string return from JSON_EXTRACT.
    // For INT/DATE, virtual column type definition enforces it.

    return `ALTER TABLE ${tableName} ADD COLUMN ${config.column_name} ${dbType} GENERATED ALWAYS AS (${expression}) VIRTUAL`;
  }

  private mapDataTypeToSql(type: string): string {
    switch (type) {
      case 'INT':
        return 'INT';
      case 'VARCHAR':
        return 'VARCHAR(255)';
      case 'BOOLEAN':
        return 'TINYINT(1)';
      case 'DATE':
        return 'DATE';
      case 'DATETIME':
        return 'DATETIME';
      case 'DECIMAL':
        return 'DECIMAL(10,2)';
      default:
        return 'VARCHAR(255)';
    }
  }
}

