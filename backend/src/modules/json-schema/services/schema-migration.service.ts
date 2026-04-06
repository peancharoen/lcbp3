// File: src/modules/json-schema/services/schema-migration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessException,
  NotFoundException,
} from '../../../common/exceptions';
import { DataSource } from 'typeorm';
import { JsonSchemaService } from '../json-schema.service';

export interface MigrationStep {
  type:
    | 'FIELD_RENAME'
    | 'FIELD_TRANSFORM'
    | 'FIELD_ADD'
    | 'FIELD_REMOVE'
    | 'STRUCTURE_CHANGE';
  config: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migratedFields: string[];
  error?: string;
}

@Injectable()
export class SchemaMigrationService {
  private readonly logger = new Logger(SchemaMigrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jsonSchemaService: JsonSchemaService
  ) {}

  /**
   * Migrate data for a specific entity to a target schema version
   */
  async migrateData(
    entityType: string, // e.g., 'rfa_revisions', 'correspondence_revisions'
    entityId: number,
    targetSchemaCode: string,
    targetVersion?: number
  ): Promise<MigrationResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Target Schema
      let targetSchema;
      if (targetVersion) {
        targetSchema = await this.jsonSchemaService.findOneByCodeAndVersion(
          targetSchemaCode,
          targetVersion
        );
      } else {
        targetSchema =
          await this.jsonSchemaService.findLatestByCode(targetSchemaCode);
      }

      // 2. Fetch Entity Data & Current Version
      // Note: This assumes the entity table has 'details' (json) and 'schema_version' (int) columns
      // If schema_version is not present, we assume version 1
      const entities = await queryRunner.manager.query<
        { details: Record<string, unknown>; schema_version: number }[]
      >(`SELECT details, schema_version FROM ${entityType} WHERE id = ?`, [
        entityId,
      ]);

      if (!entities || entities.length === 0) {
        throw new NotFoundException(entityType, String(entityId));
      }

      const entity = entities[0];
      const currentData = entity.details || {};
      const currentVersion = entity.schema_version || 1;

      if (currentVersion >= targetSchema.version) {
        return {
          success: true,
          fromVersion: currentVersion,
          toVersion: currentVersion,
          migratedFields: [], // No migration needed
        };
      }

      // 3. Find Migration Path (Iterative Upgrade)
      let migratedData = JSON.parse(JSON.stringify(currentData)) as Record<
        string,
        unknown
      >;
      const migratedFields: string[] = [];

      // Loop from current version up to target version
      for (let v = currentVersion + 1; v <= targetSchema.version; v++) {
        const schemaVer = await this.jsonSchemaService.findOneByCodeAndVersion(
          targetSchemaCode,
          v
        );

        if (schemaVer && schemaVer.migrationScript) {
          this.logger.log(
            `Applying migration script for ${targetSchemaCode} v${v}...`
          );

          const script = schemaVer.migrationScript;

          // Apply steps defined in migrationScript
          if (Array.isArray(script.steps)) {
            for (const step of script.steps as MigrationStep[]) {
              migratedData = this.applyMigrationStep(step, migratedData);
              const config = step.config as Record<string, string>;
              if (config.field || config.new_field) {
                migratedFields.push(config.new_field || config.field);
              }
            }
          }
        }
      }

      // 4. Validate Migrated Data against Target Schema
      const validation = await this.jsonSchemaService.validateData(
        targetSchema.schemaCode,
        migratedData
      );

      if (!validation.isValid) {
        throw new BusinessException(
          'SCHEMA_MIGRATION_VALIDATION_FAILED',
          `Migration failed: Data does not match target schema v${targetSchema.version}`,
          'การ Migration ล้มเหลว: ข้อมูลไม่ตรงกับ Schema เป้าหมาย'
        );
      }

      // 5. Save Migrated Data
      // Update details AND schema_version
      await queryRunner.manager.query(
        `UPDATE ${entityType} SET details = ?, schema_version = ? WHERE id = ?`,
        [
          JSON.stringify(validation.sanitizedData),
          targetSchema.version,
          entityId,
        ]
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetSchema.version,
        migratedFields: [...new Set(migratedFields)],
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Apply a single migration step
   */
  private applyMigrationStep(
    step: MigrationStep,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const newData = { ...data };

    const field = step.config.field as string;
    const oldField = step.config.old_field as string;
    const newField = step.config.new_field as string;

    switch (step.type) {
      case 'FIELD_RENAME':
        if (newData[oldField] !== undefined) {
          newData[newField] = newData[oldField];
          delete newData[oldField];
        }
        break;

      case 'FIELD_ADD':
        if (newData[field] === undefined) {
          newData[field] = step.config.default_value;
        }
        break;

      case 'FIELD_REMOVE':
        delete newData[field];
        break;

      case 'FIELD_TRANSFORM':
        if (newData[field] !== undefined) {
          // Simple transform logic (e.g., map values)
          if (step.config.transform === 'MAP_VALUES' && step.config.mapping) {
            const val = newData[field];
            const oldVal =
              typeof val === 'string' || typeof val === 'number'
                ? String(val)
                : JSON.stringify(val);
            const mapping = step.config.mapping as Record<string, unknown>;
            newData[field] = mapping[oldVal] || newData[field];
          }
          // Type casting
          else if (step.config.transform === 'TO_NUMBER') {
            newData[field] = Number(newData[field]);
          } else if (step.config.transform === 'TO_STRING') {
            const val = newData[field];
            newData[field] =
              typeof val === 'string' || typeof val === 'number'
                ? String(val)
                : JSON.stringify(val);
          }
        }
        break;

      default:
        this.logger.warn(`Unknown migration step type: ${step.type}`);
    }

    return newData;
  }
}
