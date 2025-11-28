// File: src/modules/json-schema/services/schema-migration.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JsonSchemaService } from '../json-schema.service';

export interface MigrationStep {
  type:
    | 'FIELD_RENAME'
    | 'FIELD_TRANSFORM'
    | 'FIELD_ADD'
    | 'FIELD_REMOVE'
    | 'STRUCTURE_CHANGE';
  config: any;
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
    private readonly jsonSchemaService: JsonSchemaService,
  ) {}

  /**
   * Migrate data for a specific entity to a target schema version
   */
  async migrateData(
    entityType: string, // e.g., 'rfa_revisions', 'correspondence_revisions'
    entityId: number,
    targetSchemaCode: string,
    targetVersion?: number,
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
          targetVersion,
        );
      } else {
        targetSchema =
          await this.jsonSchemaService.findLatestByCode(targetSchemaCode);
      }

      // 2. Fetch Entity Data & Current Version
      // Note: This assumes the entity table has 'details' (json) and 'schema_version' (int) columns
      // If schema_version is not present, we assume version 1
      const entity = await queryRunner.manager.query(
        `SELECT details, schema_version FROM ${entityType} WHERE id = ?`,
        [entityId],
      );

      if (!entity || entity.length === 0) {
        throw new BadRequestException(
          `Entity ${entityType} with ID ${entityId} not found.`,
        );
      }

      const currentData = entity[0].details || {};
      const currentVersion = entity[0].schema_version || 1;

      if (currentVersion >= targetSchema.version) {
        return {
          success: true,
          fromVersion: currentVersion,
          toVersion: currentVersion,
          migratedFields: [], // No migration needed
        };
      }

      // 3. Find Migration Path (Iterative Upgrade)
      let migratedData = JSON.parse(JSON.stringify(currentData));
      const migratedFields: string[] = [];

      // Loop from current version up to target version
      for (let v = currentVersion + 1; v <= targetSchema.version; v++) {
        const schemaVer = await this.jsonSchemaService.findOneByCodeAndVersion(
          targetSchemaCode,
          v,
        );

        if (schemaVer && schemaVer.migrationScript) {
          this.logger.log(
            `Applying migration script for ${targetSchemaCode} v${v}...`,
          );

          const script = schemaVer.migrationScript;

          // Apply steps defined in migrationScript
          if (Array.isArray(script.steps)) {
            for (const step of script.steps) {
              migratedData = await this.applyMigrationStep(step, migratedData);
              if (step.config.field || step.config.new_field) {
                migratedFields.push(step.config.new_field || step.config.field);
              }
            }
          }
        }
      }

      // 4. Validate Migrated Data against Target Schema
      const validation = await this.jsonSchemaService.validateData(
        targetSchema.schemaCode,
        migratedData,
      );

      if (!validation.isValid) {
        throw new BadRequestException(
          `Migration failed: Resulting data does not match target schema v${targetSchema.version}. Errors: ${JSON.stringify(validation.errors)}`,
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
        ],
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetSchema.version,
        migratedFields: [...new Set(migratedFields)],
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Migration failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Apply a single migration step
   */
  private async applyMigrationStep(
    step: MigrationStep,
    data: any,
  ): Promise<any> {
    const newData = { ...data };

    switch (step.type) {
      case 'FIELD_RENAME':
        if (newData[step.config.old_field] !== undefined) {
          newData[step.config.new_field] = newData[step.config.old_field];
          delete newData[step.config.old_field];
        }
        break;

      case 'FIELD_ADD':
        if (newData[step.config.field] === undefined) {
          newData[step.config.field] = step.config.default_value;
        }
        break;

      case 'FIELD_REMOVE':
        delete newData[step.config.field];
        break;

      case 'FIELD_TRANSFORM':
        if (newData[step.config.field] !== undefined) {
          // Simple transform logic (e.g., map values)
          if (step.config.transform === 'MAP_VALUES' && step.config.mapping) {
            const oldVal = newData[step.config.field];
            newData[step.config.field] = step.config.mapping[oldVal] || oldVal;
          }
          // Type casting
          else if (step.config.transform === 'TO_NUMBER') {
            newData[step.config.field] = Number(newData[step.config.field]);
          } else if (step.config.transform === 'TO_STRING') {
            newData[step.config.field] = String(newData[step.config.field]);
          }
        }
        break;

      default:
        this.logger.warn(`Unknown migration step type: ${step.type}`);
    }

    return newData;
  }
}

