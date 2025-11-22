import { DataSource } from 'typeorm';
import * as fs from 'fs';

// Read .env to get DB config
const envFile = fs.readFileSync('.env', 'utf8');
const getEnv = (key: string) => {
    const line = envFile.split('\n').find(l => l.startsWith(key + '='));
    return line ? line.split('=')[1].trim() : '';
};

const dataSource = new DataSource({
    type: 'mariadb',
    host: getEnv('DB_HOST') || 'localhost',
    port: parseInt(getEnv('DB_PORT') || '3306'),
    username: getEnv('DB_USERNAME') || 'admin',
    password: getEnv('DB_PASSWORD') || 'Center2025',
    database: getEnv('DB_DATABASE') || 'lcbp3_dev',
    entities: [],
    synchronize: false,
});

async function main() {
    await dataSource.initialize();
    console.log('Connected to DB');

    try {
        const assignments = await dataSource.query('SELECT * FROM user_assignments');
        console.log('All Assignments:', assignments);

        // Check if User 3 has any assignment
        const user3Assign = assignments.find((a: any) => a.user_id === 3);
        if (!user3Assign) {
            console.log('User 3 has NO assignments.');
            // Try to insert assignment for User 3 (Editor)
            console.log('Inserting assignment for User 3 (Role 4, Org 41)...');
            await dataSource.query(`
                INSERT INTO user_assignments (user_id, role_id, organization_id, assigned_by_user_id)
                VALUES (3, 4, 41, 1)
            `);
            console.log('Inserted assignment for User 3.');
        } else {
            console.log('User 3 Assignment:', user3Assign);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await dataSource.destroy();
    }
}

main();
