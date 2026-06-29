import { Column, BeforeInsert } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Abstract base entity providing a UUID public identifier.
 *
 * Naming Convention (ADR-019 v1.8.1):
 * - TypeScript Property: `publicId` — semantic name indicating this is the public-facing identifier
 * - Database Column: `uuid` — MariaDB native UUID type (stored as BINARY(16))
 *
 * This avoids confusion between the property name and the DB data type,
 * while clearly indicating this is the ID exposed via API (not internal INT PK).
 */
export abstract class UuidBaseEntity {
  @Column({
    type: 'uuid',
    name: 'uuid', // DB column name (MariaDB native UUID type)
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  publicId!: string; // TypeScript property name — semantic, avoids type confusion

  @BeforeInsert()
  generatePublicId(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
    }
  }
}
