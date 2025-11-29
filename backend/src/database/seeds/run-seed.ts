import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { seedWorkflowDefinitions } from '../seeds/workflow-definitions.seed'; // Import ฟังก์ชัน Seed ที่คุณมี
// Import Entities ที่เกี่ยวข้อง
import { WorkflowDefinition } from '../../modules/workflow-engine/entities/workflow-definition.entity';
import { WorkflowHistory } from '../../modules/workflow-engine/entities/workflow-history.entity';
import { WorkflowInstance } from '../../modules/workflow-engine/entities/workflow-instance.entity';

// โหลด Environment Variables (.env)
config();

const runSeed = async () => {
  // ตั้งค่าการเชื่อมต่อฐานข้อมูล (ควรตรงกับ docker-compose หรือ .env ของคุณ)
  const dataSource = new DataSource({
    type: 'mariadb',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'Center#2025',
    database: process.env.DB_DATABASE || 'lcbp3_dev',
    // สำคัญ: ต้องใส่ Entities ที่เกี่ยวข้องทั้งหมดเพื่อให้ TypeORM รู้จัก
    entities: [
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
      // ใส่ Entity อื่นๆ ถ้าจำเป็น หรือใช้ path pattern: __dirname + '/../../modules/**/*.entity{.ts,.js}'
    ],
    synchronize: false, // ห้ามใช้ true บน Production
  });

  try {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected.');

    console.log('🌱 Running Seeds...');
    await seedWorkflowDefinitions(dataSource);
    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('🔌 Database connection closed.');
    }
  }
};

runSeed();

/*
npx ts-node -r tsconfig-paths/register src/database/run-seed.ts

**หรือเพิ่มใน `package.json` (แนะนำ):**
คุณสามารถเพิ่ม script ใน `package.json` เพื่อให้เรียกใช้ได้ง่ายขึ้นในอนาคต:

"scripts": {
    "seed": "ts-node -r tsconfig-paths/register src/database/seeds/run-seed.ts"
}

http://googleusercontent.com/immersive_entry_chip/1

### 💡 ข้อควรระวัง
1.  **Environment Variables:** ตรวจสอบให้แน่ใจว่าค่า Config (Host, User, Password) ในไฟล์ `run-seed.ts` หรือ `.env` นั้นถูกต้องและตรงกับ Docker Container ที่กำลังรันอยู่
2.  **Entities:** หากฟังก์ชัน Seed มีการเรียกใช้ Entity อื่นนอกเหนือจาก `WorkflowDefinition` ต้องนำมาใส่ใน `entities: [...]` ของ `DataSource` ให้ครบ ไม่อย่างนั้นจะเจอ Error `RepositoryNotFoundError`

*/
