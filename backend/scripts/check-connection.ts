import { DataSource } from 'typeorm';
import { databaseConfig } from '../src/config/database.config';
import * as dotenv from 'dotenv';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';

dotenv.config();

async function checkConnection() {
  console.log('Checking database connection...');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`User: ${process.env.DB_USERNAME}`);
  console.log(`Database: ${process.env.DB_DATABASE}`);

  const dataSource = new DataSource(databaseConfig as MysqlConnectionOptions);

  try {
    await dataSource.initialize();
    console.log('✅ Connection initialized successfully!');

    const result = await dataSource.query('SHOW COLUMNS FROM rfa_types');
    console.log('rfa_types columns:', result);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

checkConnection();
