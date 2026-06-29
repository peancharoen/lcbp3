import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { validate as uuidValidate } from 'uuid';

/**
 * Shared service to resolve hybrid identifiers (INT | UUID string) to internal INT IDs.
 * Eliminates duplicated resolveId helpers across 8+ services.
 *
 * @see ADR-019 Hybrid Identifier Strategy
 */
@Injectable()
export class UuidResolverService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Checks if a string value is a numeric string (not UUID).
   * Returns the parsed number or null if not numeric.
   */
  private tryParseInt(value: string): number | null {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Low-level UUID lookup: find entity by uuid column, return pkColumn value.
   */
  private async lookupByUuid(
    entityName: string,
    tableName: string,
    pkColumn: string,
    uuid: string
  ): Promise<number> {
    if (!uuidValidate(uuid)) {
      throw new NotFoundException(
        `Invalid identifier for ${entityName}: ${uuid}`
      );
    }

    const rows: Record<string, number>[] = await this.dataSource.manager.query(
      `SELECT \`${pkColumn}\` FROM \`${tableName}\` WHERE \`uuid\` = ? LIMIT 1`,
      [uuid]
    );

    if (!rows.length) {
      throw new NotFoundException(`${entityName} with UUID ${uuid} not found`);
    }

    return rows[0][pkColumn];
  }

  /**
   * Generic resolver: accepts INT or UUID string, returns internal INT ID.
   * - If value is a number, returns it directly.
   * - If value is a numeric string, parses and returns it.
   * - If value is a UUID string, looks up the entity by uuid column.
   */
  async resolve(
    entityName: string,
    tableName: string,
    pkColumn: string,
    value: number | string
  ): Promise<number> {
    if (typeof value === 'number') return value;

    const num = this.tryParseInt(value);
    if (num !== null) return num;

    return this.lookupByUuid(entityName, tableName, pkColumn, value);
  }

  /**
   * Resolve projectId (INT or UUID string) to internal INT ID.
   */
  async resolveProjectId(projectId: number | string): Promise<number> {
    return this.resolve('Project', 'projects', 'id', projectId);
  }

  /**
   * Resolve organizationId (INT or UUID string) to internal INT ID.
   */
  async resolveOrganizationId(orgId: number | string): Promise<number> {
    return this.resolve('Organization', 'organizations', 'id', orgId);
  }

  /**
   * Resolve correspondenceId (INT or UUID string) to internal INT ID.
   */
  async resolveCorrespondenceId(corrId: number | string): Promise<number> {
    return this.resolve('Correspondence', 'correspondences', 'id', corrId);
  }

  /**
   * Resolve userId (INT or UUID string) to internal user_id.
   */
  async resolveUserId(userId: number | string): Promise<number> {
    return this.resolve('User', 'users', 'user_id', userId);
  }

  /**
   * Resolve contractId (INT or UUID string) to internal INT ID.
   */
  async resolveContractId(contractId: number | string): Promise<number> {
    return this.resolve('Contract', 'contracts', 'id', contractId);
  }

  /**
   * Resolve shopDrawingRevisionId (INT or UUID string) to internal INT ID.
   */
  async resolveShopDrawingRevisionId(
    shopDrawingRevisionId: number | string
  ): Promise<number> {
    return this.resolve(
      'Shop Drawing Revision',
      'shop_drawing_revisions',
      'id',
      shopDrawingRevisionId
    );
  }

  /**
   * Resolve asBuiltDrawingRevisionId (INT or UUID string) to internal INT ID.
   */
  async resolveAsBuiltDrawingRevisionId(
    asBuiltDrawingRevisionId: number | string
  ): Promise<number> {
    return this.resolve(
      'As-Built Drawing Revision',
      'asbuilt_drawing_revisions',
      'id',
      asBuiltDrawingRevisionId
    );
  }
}
