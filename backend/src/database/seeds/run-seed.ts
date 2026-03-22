import { DataSource } from 'typeorm';
import { databaseConfig } from '../../config/database.config';
import { seedOrganizations } from './organization.seed';
import { seedUsers } from './user.seed';

async function runSeeds() {
  const dataSource = new DataSource(
    databaseConfig as import('typeorm').DataSourceOptions
  );
  await dataSource.initialize();

  try {
    await seedOrganizations(dataSource);
    await seedUsers(dataSource);
  } catch (_error) {
  } finally {
    await dataSource.destroy();
  }
}

void runSeeds();
