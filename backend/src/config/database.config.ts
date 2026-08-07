import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'admin',
  password: process.env.DB_PASSWORD || 'Center2025',
  database: process.env.DB_DATABASE || 'lcbp3_dev',
  charset: 'utf8mb4',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [], // ❌ Empty — no TypeORM migrations (ADR-044)
  migrationsTableName: 'migrations', // Kept for backward compat (table empty)
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  autoLoadEntities: true,
};
