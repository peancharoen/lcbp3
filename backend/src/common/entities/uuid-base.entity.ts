import { Column, BeforeInsert } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Abstract base entity providing a UUID public identifier column.
 * Uses MariaDB native UUID type (stored as BINARY(16) internally,
 * auto-converts to string format — no transformer needed).
 *
 * App generates UUIDv7 via @BeforeInsert(); DB DEFAULT UUID() is fallback.
 *
 * @see ADR-019 Hybrid Identifier Strategy
 */
export abstract class UuidBaseEntity {
  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  uuid!: string;

  @BeforeInsert()
  generateUuid(): void {
    if (!this.uuid) {
      this.uuid = uuidv7();
    }
  }
}
