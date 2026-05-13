---
title: No TypeORM Migrations (ADR-009)
impact: HIGH
impactDescription: Use direct SQL schema files instead of TypeORM migrations per project ADR
tags: database, schema, typeorm, migrations, adr-009
---

## No TypeORM Migrations (ADR-009)

**This project follows ADR-009: Direct SQL Schema Management**

Unlike standard NestJS/TypeORM practices, this project does **NOT** use TypeORM migrations. Instead, we manage database schema through direct SQL files.

### Why No Migrations?

- **ADR-009 Decision**: Explicit schema control over auto-generated migrations
- **MariaDB-specific features**: Native UUID type, virtual columns, custom indexing
- **Team workflow**: Schema changes reviewed as SQL, not TypeORM migration classes
- **Audit trail**: Single source of truth in `specs/03-Data-and-Storage/`

### Schema File Locations

```
specs/03-Data-and-Storage/
├── lcbp3-v1.8.0-schema-01-drop.sql      # Drop statements (dev only)
├── lcbp3-v1.8.0-schema-02-tables.sql   # CREATE TABLE statements
├── lcbp3-v1.8.0-schema-03-views-indexes.sql  # Views, indexes, constraints
└── deltas/                              # Incremental changes
    ├── 01-add-reference-date.sql
    ├── 02-add-rbac-bulk-permission.sql
    └── 03-fix-numbering-enums.sql
```

### Correct: Using SQL Schema Files

```typescript
// TypeORM configuration - NO migrationsRun
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'mariadb',
    host: config.get('DB_HOST'),
    port: config.get('DB_PORT'),
    username: config.get('DB_USERNAME'),
    password: config.get('DB_PASSWORD'),
    database: config.get('DB_NAME'),
    entities: ['dist/**/*.entity.js'],
    synchronize: false, // NEVER true, even in development
    migrationsRun: false, // Disabled per ADR-009
    // Migrations are managed via SQL files, not TypeORM
  }),
});
```

### Schema Change Process (ADR-009)

1. **Modify SQL file directly**:

   ```sql
   -- specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
   ALTER TABLE correspondences
   ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
   ```

2. **Create delta for existing databases**:

   ```sql
   -- specs/03-Data-and-Storage/deltas/04-add-priority-column.sql
   ALTER TABLE correspondences
   ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
   ```

3. **Apply to database manually or via deployment script**:
   ```bash
   mysql -u root -p lcbp3 < specs/03-Data-and-Storage/deltas/04-add-priority-column.sql
   ```

### Entity Definition (No Migration Needed)

```typescript
@Entity('correspondences')
export class Correspondence {
  @PrimaryGeneratedColumn()
  id: number; // Internal INT PK

  @Column({ type: 'uuid' })
  uuid: string; // Public UUID

  @Column({ name: 'priority', default: 'normal' })
  priority: string;

  // No migration class needed - schema managed via SQL
}
```

### Anti-Pattern: TypeORM Migrations (Do NOT Use)

```typescript
// ❌ WRONG - Do not create migration files
// migrations/1705312800000-AddUserAge.ts
export class AddUserAge1705312800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "age" integer`);
  }
}

// ❌ WRONG - Do not enable migrationsRun
TypeOrmModule.forRoot({
  migrationsRun: true, // Disabled per ADR-009
  migrations: ['dist/migrations/*.js'],
});
```

### When You Need Schema Changes

1. Check `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`
2. Add your DDL to the appropriate SQL file
3. Create delta file in `deltas/` directory
4. Apply SQL to your database
5. Update corresponding Entity class

### Reference

- [ADR-009 Database Strategy](../../../../specs/06-Decision-Records/ADR-009-db-strategy.md)
- [Schema SQL Files](../../../../specs/03-Data-and-Storage/)
- [Data Dictionary](../../../../specs/03-Data-and-Storage/03-01-data-dictionary.md)

> **Warning**: Attempting to use TypeORM migrations in this project violates ADR-009 and will be rejected in code review.
