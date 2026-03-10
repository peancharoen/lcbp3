const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: '192.168.10.8',
    port: 3306,
    user: 'migration_bot',
    password: 'Center2025',
    database: 'lcbp3'
  });

  try {
    const [orgs] = await connection.execute('SELECT id, organization_name, organization_code FROM organizations');
    console.log('Organizations:', orgs.slice(0, 5));

    const [projects] = await connection.execute('SELECT id, project_code, project_name FROM projects');
    console.log('Projects:', projects.slice(0, 5));

    const [corrTypes] = await connection.execute('SELECT id, type_code, type_name FROM correspondence_types');
    console.log('Correspondence Types:', corrTypes.slice(0, 5));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

test();
