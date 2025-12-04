import { DataSource } from 'typeorm';
import { databaseConfig } from '../../config/database.config';
import { seedOrganizations } from './organization.seed';
import { seedUsers } from './user.seed';

async function runSeeds() {
  const dataSource = new DataSource(databaseConfig as any);
  await dataSource.initialize();

  try {
    console.log('🌱 Seeding database...');

    await seedOrganizations(dataSource);
    await seedUsers(dataSource);

    console.log('✅ Seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
