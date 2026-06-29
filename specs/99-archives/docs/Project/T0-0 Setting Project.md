# **BACKEND DEVELOPMENT**

## **Backend Development Plan (Phase 0)** และ **Requirements** เราจะสร้างโปรเจกต์ชื่อ `lcbp3-backend` โดยใช้ **NestJS** และจัดโครงสร้างแบบ **Domain-Driven Design** ตั้งแต่เริ่มต้นเพื่อให้รองรับการขยายตัวตามแผนงานครับ

นี่คือขั้นตอนและคำสั่งในการสร้างโปรเจกต์ครับ:

### 1. ติดตั้ง Nest CLI และสร้างโปรเจกต์

รันคำสั่งต่อไปนี้ใน Terminal ครับ (แนะนำให้ใช้ `pnpm` ตามแนวทาง FullStackJS Guidelines):

```bash
# 1. ติดตั้ง Nest CLI ทั่วโลก (ถ้ายังไม่ได้ติดตั้ง)
npm install -g @nestjs/cli

# 2. สร้างโปรเจกต์ใหม่ชื่อ lcbp3-backend
nest new backend

# 💡 ระบบจะถามหา Package Manager:
# ให้เลือก "pnpm" (เพื่อให้ตรงกับ Frontend และแผนงาน)
```

### 2. ปรับโครงสร้างโฟลเดอร์ (Domain-Driven Structure)

หลังจากสร้างโปรเจกต์เสร็จแล้ว เราจะปรับโครงสร้าง `src` ให้ตรงกับ **Backend Plan หัวข้อ 3.10** ครับ

รันคำสั่งเหล่านี้ใน Terminal (ภายในโฟลเดอร์ `lcbp3-backend`):

```bash
# เข้าสู่โฟลเดอร์โปรเจกต์
cd backend

# สร้างโครงสร้างโฟลเดอร์หลัก
mkdir -p src/common/auth
mkdir -p src/common/config
mkdir -p src/common/decorators
mkdir -p src/common/entities
mkdir -p src/common/exceptions
mkdir -p src/common/file-storage
mkdir -p src/common/guards
mkdir -p src/common/interceptors
mkdir -p src/common/resilience
mkdir -p src/common/security
mkdir -p src/common/idempotency
mkdir -p src/common/maintenance

# สร้างโฟลเดอร์สำหรับ Modules ตาม Domain
mkdir -p src/modules/user
mkdir -p src/modules/project
mkdir -p src/modules/master
mkdir -p src/modules/correspondence
mkdir -p src/modules/rfa
mkdir -p src/modules/drawing
mkdir -p src/modules/circulation
mkdir -p src/modules/transmittal
mkdir -p src/modules/search
mkdir -p src/modules/monitoring
mkdir -p src/modules/workflow-engine
mkdir -p src/modules/document-numbering
mkdir -p src/modules/notification
mkdir -p src/modules/file-storage

# สร้างโฟลเดอร์ Database
mkdir -p src/database/migrations
mkdir -p src/database/seeds
```

### 3. ตรวจสอบและตั้งค่า TypeScript (Strict Mode)

อ้างอิงจาก **FullStackJS Guidelines ข้อ 2.1**, เราต้องเปิดใช้งาน Strict Mode เพื่อความปลอดภัยของ Type ครับ

เปิดไฟล์ `tsconfig.json` และตรวจสอบค่า config ดังนี้:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    /* Strict Type-Checking Options */
    "strict": true, // บังคับใช้ Strict Mode
    "noImplicitAny": true, // ห้ามใช้ Any โดยไม่จำเป็น
    "strictNullChecks": true, // ตรวจสอบค่า Null อย่างเคร่งครัด
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 4. การตั้งค่า Environment (Docker Support)

ตาม **Requirements ข้อ 2.1 และ 2.2**, เราจะไม่ใช้ `.env` ในการ deploy จริงบน QNAP แต่จะใช้ Environment Variables ผ่าน `docker-compose`

อย่างไรก็ตาม สำหรับ **Development** ให้สร้างไฟล์ `.env` ไว้สำหรับการรัน Local (และอย่าลืมใส่ใน `.gitignore`)

สร้างไฟล์ `.env` ที่ root project:

```env
# Database Configuration (สำหรับการ Dev บนเครื่อง Local)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password123
DB_DATABASE=lcbp3_dms

# Application
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=eebc122aa65adde8c76c6a0847d9649b2b67a06db1504693e6c912e51499b76e
```

### ขั้นตอนต่อไป (Next Steps)

ตอนนี้โครงสร้างพื้นฐานพร้อมแล้วครับ ขั้นตอนต่อไปตาม **Phase 0** คือ:

1. **Secure Configuration Setup:** ติดตั้ง `@nestjs/config` และ `joi` เพื่อ validate ตัวแปร environment
2. **Database Connection:** ติดตั้ง `typeorm`, `@nestjs/typeorm` และ `mysql2` (สำหรับ MariaDB)

ต้องการให้ผมพาทำส่วน **Configuration Setup (T0.1)** ต่อเลยไหมครับ?

## การติดตั้ง **pnpm**

### 1. ติดตั้งผ่าน npm (วิธีแนะนำ)

เปิด Terminal (หรือ Command Prompt / PowerShell) แล้วรันคำสั่ง:

```bash
npm install -g pnpm
```

> **คำอธิบาย:** `-g` หมายถึง global install คือติดตั้งลงในเครื่องเพื่อให้เรียกใช้คำสั่ง `pnpm` ได้จากทุกโฟลเดอร์ครับ

### 2. ตรวจสอบการติดตั้ง

เมื่อติดตั้งเสร็จแล้ว ให้เช็คเวอร์ชันเพื่อความชัวร์ครับ:

```bash
pnpm --version
```

(ควรจะขึ้นเป็นตัวเลขเวอร์ชัน เช่น `9.x.x`)

---

### ทางเลือก: ติดตั้งผ่าน Corepack (สำหรับ Node.js เวอร์ชันใหม่)

หากคุณใช้ Node.js เวอร์ชัน 16.13 ขึ้นไป สามารถเปิดใช้งานฟีเจอร์ **Corepack** ที่แถมมากับ Node.js ได้เลย โดยไม่ต้องลงผ่าน npm ครับ:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

---

### เมื่อติดตั้งเสร็จแล้ว

คุณสามารถใช้ `pnpm` แทน `npm` ได้เลยครับ เช่น:

- **ติดตั้ง Nest CLI (ถ้ายังไม่ได้ลง):** `pnpm add -g @nestjs/cli`
- **สร้างโปรเจกต์ NestJS:** `nest new lcbp3-backend` (แล้วเลือก pnpm ตอนระบบถาม)
- **รันโปรเจกต์:** `pnpm start:dev`
- **ติดตั้ง Library เพิ่ม:** `pnpm add [package-name]` (เช่น `pnpm add typeorm`)

ติดตั้งเสร็จแล้ว แจ้งผมได้เลยนะครับ จะได้ไปต่อที่ขั้นตอน **Config Database** กันครับ

## การตั้งค่า MariaDB บน `localhost` เพื่อใช้กับ NestJS ตามแผนงาน **Backend Plan T0.3** และ **FullStackJS Guidelines 3.2** เราต้องทำ 2 ส่วนคือ **เตรียม Database Server (Docker)** และ **เชื่อมต่อ NestJS (TypeORM)** ครับ

### 1. ติดตั้ง Libraries ที่จำเป็น

ก่อนอื่นต้องติดตั้ง Module สำหรับ TypeORM, MariaDB Driver และ Config Module (เพื่ออ่านค่าจาก .env) ครับ

รันคำสั่งนี้ใน Terminal:

```bash
pnpm add @nestjs/typeorm typeorm mysql2 @nestjs/config
```

> **หมายเหตุ:** เราใช้ `mysql2` driver เพราะ MariaDB เข้ากันได้กับ MySQL Protocol และ `mysql2` มีประสิทธิภาพสูงครับ

### 2. สร้าง MariaDB Server ด้วย Docker Compose

เพื่อให้มั่นใจว่า Environment ตรงกับ Production (ตามข้อกำหนด \*\* Requirements 2.1\*\* ที่ใช้ Container) เราจะรัน MariaDB ผ่าน Docker ครับ

สร้างไฟล์ `docker-compose.yml` ที่ root ของโปรเจกต์ (ถ้ายังไม่มี):

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:10.11
    container_name: lcbp3-db-local
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password123
      MYSQL_DATABASE: lcbp3_dms
      MYSQL_USER: admin
      MYSQL_PASSWORD: password123
    ports:
      - '3306:3306'
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - lcbp3-net

  # Optional: phpMyAdmin สำหรับจัดการ DB ง่ายๆ
  pma:
    image: phpmyadmin/phpmyadmin
    container_name: lcbp3-pma-local
    environment:
      PMA_HOST: mariadb
    ports:
      - '8080:80'
    depends_on:
      - mariadb
    networks:
      - lcbp3-net

volumes:
  db_data:

networks:
  lcbp3-net:
    driver: bridge
```

จากนั้นรันคำสั่งเพื่อเริ่ม Database:

```bash
docker-compose up -d
```

### 3. ตั้งค่าการเชื่อมต่อใน `app.module.ts`

เราจะแก้ไขไฟล์ `src/app.module.ts` ให้เชื่อมต่อกับ Database โดยอ่านค่าจาก `.env` ผ่าน `ConfigService` เพื่อความปลอดภัยและยืดหยุ่นครับ

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. Load Config Module
    ConfigModule.forRoot({
      isGlobal: true, // ให้เรียกใช้ได้ทุกที่โดยไม่ต้อง import ใหม่
      envFilePath: '.env', // อ่านค่าจากไฟล์ .env
    }),

    // 2. Setup TypeORM Connection (Async เพื่อรออ่าน Config ก่อน)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb', // หรือ 'mysql' ก็ได้เพราะใช้ driver เดียวกัน
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        // Auto Load Entities: โหลด Entity ทั้งหมดที่อยู่ในโปรเจกต์อัตโนมัติ
        autoLoadEntities: true,
        // Synchronize: true เฉพาะ Dev environment (ห้ามใช้ใน Prod)
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        // Logging: เปิดดู Query SQL ตอน Dev
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 4. ตรวจสอบไฟล์ `.env`

ตรวจสอบไฟล์ `.env` ที่เราสร้างไว้ก่อนหน้านี้ว่าข้อมูลตรงกับ `docker-compose.yml` ไหมครับ

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
# หรือใช้ user: admin / password: password123 ตามที่ตั้งใน docker-compose ก็ได้
# แต่ถ้า connect จาก host (เครื่องเรา) ใช้ root ก็สะดวกดีครับ
DB_PASSWORD=password123
DB_DATABASE=lcbp3_dms

# App Environment
NODE_ENV=development
PORT=3000
```

### 5. ทดสอบรันโปรเจกต์

ลองรัน NestJS ดูครับว่าเชื่อมต่อได้ไหม:

```bash
pnpm start:dev
```

ถ้า Terminal ขึ้นข้อความสีเขียวๆ ว่า `[NestApplication] Nest application successfully started` และไม่มี Error เกี่ยวกับ TypeORM แสดงว่าเชื่อมต่อ MariaDB บน Localhost สำเร็จแล้วครับ\! 🎉

---

**ขั้นตอนถัดไป:**
เราควรสร้าง **Base Entity** (T1.1) และ **Users Entity** (T1.3) เพื่อเริ่มทำระบบ Login ไหมครับ?

## การสร้าง `JWT_SECRET` (JSON Web Token Secret) ที่มีความปลอดภัยสูงเป็นสิ่งสำคัญมากสำหรับระบบ Authentication เพราะหาก Secret นี้หลุดหรือเดาง่าย ผู้ไม่หวังดีอาจปลอมแปลง Token เพื่อเข้าสู่ระบบในฐานะใครก็ได้ (เช่น Superadmin)

ในแผนพัฒนา **Backend Plan Phase 0 (T0.1)** และ **FullStackJS Guidelines** ระบุว่าต้องจัดการ Secrets อย่างปลอดภัย นี่คือวิธีสร้าง `JWT_SECRET` ที่มีความซับซ้อนและปลอดภัย (High Entropy) ครับ:

### วิธีที่ 1: ใช้ OpenSSL (แนะนำสำหรับ Production)

วิธีนี้เป็นมาตรฐานและปลอดภัยที่สุด หากคุณใช้ Linux, macOS หรือ Git Bash บน Windows ให้เปิด Terminal แล้วพิมพ์คำสั่ง:

```bash
openssl rand -base64 64
```

_ผลลัพธ์จะได้ String ยาวๆ ที่อ่านไม่รู้เรื่อง เช่น:_
`h78/sT5...xYz==`

### วิธีที่ 2: ใช้ Node.js Crypto (ง่ายสำหรับ Developer)

เนื่องจากเราพัฒนาด้วย Node.js/NestJS คุณสามารถใช้คำสั่ง Node เพื่อสร้าง Key ได้เลย ไม่ต้องติดตั้งอะไรเพิ่มครับ

รันคำสั่งนี้ใน Terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

_ผลลัพธ์จะได้ Hex String ยาว 64 ตัวอักษร_

### วิธีที่ 3: ใช้ Password Manager Generator

หากใช้ 1Password, LastPass หรือ Bitwarden สามารถใช้ฟีเจอร์ "Generate Password" โดยตั้งค่าความยาว 64 ตัวอักษร (รวมตัวเลขและสัญลักษณ์) ก็ใช้ได้เช่นกันครับ

---

### ⚙️ การนำไปใช้งานในโปรเจกต์

เมื่อได้ Secret Key มาแล้ว ให้นำไปใส่ในไฟล์ `.env` ของคุณ (และ **ห้าม** Commit ไฟล์นี้ขึ้น Git เด็ดขาด ตามข้อกำหนด):

**ไฟล์: `.env`**

```env
# Security
# แทนที่ค่าเดิมด้วยค่าที่ Gen ได้ใหม่
JWT_SECRET=d4a1b2... (ค่าที่คุณเพิ่งสร้าง)
JWT_EXPIRATION=8h
```

**ข้อควรระวัง:**

1. **ความยาว:** ควรยาวอย่างน้อย 32 bytes (256 bits) เพื่อป้องกัน Brute-force
2. **Environment:** ควรแยก Secret ระหว่างเครื่อง `Development` และ `Production` ไม่ควรใช้ Key เดียวกัน

คุณต้องการให้ผมช่วยตั้งค่า `ConfigModule` ใน NestJS เพื่ออ่านค่า `JWT_SECRET` นี้อย่างปลอดภัยพร้อม Validate ว่าห้ามเป็นค่าว่างไหมครับ?

## **T0.1 Secure Configuration Setup** ตามแผน Backend Plan กันต่อครับ

เป้าหมายของ Task นี้คือการทำให้ระบบอ่านค่า Environment Variables ได้อย่างถูกต้อง และ **"ต้องไม่ Start"** ถ้าค่า Config สำคัญๆ (เช่น Database Password, JWT Secret) หายไป หรือไม่ถูกต้อง เพื่อความปลอดภัยครับ

### 1. ติดตั้ง Library ที่จำเป็น

เราจะใช้ `@nestjs/config` สำหรับจัดการ Config และ `joi` สำหรับตรวจสอบความถูกต้อง (Validation) ครับ

รันคำสั่งนี้ใน Terminal:

```bash
pnpm add @nestjs/config joi
```

### 2. สร้าง Validation Schema

เราจะแยก Logic การตรวจสอบออกมาเป็นไฟล์เฉพาะ เพื่อให้โค้ดเป็นระเบียบครับ

สร้างไฟล์ใหม่: `src/common/config/env.validation.ts`

```typescript
// File: src/common/config/env.validation.ts
import Joi from 'joi';

// สร้าง Schema สำหรับตรวจสอบค่า Environment Variables
export const envValidationSchema = Joi.object({
  // 1. Application Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
  PORT: Joi.number().default(3000),

  // 2. Database Configuration (MariaDB)
  // ห้ามเป็นค่าว่าง (required)
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // 3. Security (JWT)
  // ต้องมีค่า และควรยาวพอ (ตรวจสอบความยาวได้ถ้าระบุ min)
  JWT_SECRET: Joi.string().required().min(32).message('JWT_SECRET must be at least 32 characters long for security.'),
  JWT_EXPIRATION: Joi.string().default('8h'),
});
```

### 3. อัปเดต `AppModule` ให้ใช้ Validation

กลับไปแก้ไขไฟล์ `src/app.module.ts` เพื่อนำ Schema ที่เราสร้างมาใช้งานครับ

```typescript
// File: src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js'; // สังเกต .js สำหรับ ESM

@Module({
  imports: [
    // 1. Setup Config Module พร้อม Validation
    ConfigModule.forRoot({
      isGlobal: true, // เรียกใช้ได้ทั่วทั้ง App ไม่ต้อง import ซ้ำ
      envFilePath: '.env', // อ่านไฟล์ .env (สำหรับ Dev)
      validationSchema: envValidationSchema, // ใช้ Schema ที่เราสร้างเพื่อตรวจสอบ
      validationOptions: {
        // ถ้ามีค่าไหนไม่ผ่าน Validation ให้ Error และหยุดทำงานทันที
        abortEarly: true,
      },
    }),

    // 2. Setup TypeORM (MariaDB)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        // synchronize: true เฉพาะตอน Dev เท่านั้น ห้ามใช้บน Prod
        synchronize: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 4. สร้างไฟล์ Template สำหรับ Docker Override (ตามแผน T0.1)

ตามแผนงาน เราต้องเตรียมไฟล์ `docker-compose.override.yml.example` เพื่อให้นักพัฒนาคนอื่นรู้ว่าต้อง Inject Secrets อย่างไร โดยไม่เปิดเผยความลับใน `docker-compose.yml` หลัก

สร้างไฟล์: `docker-compose.override.yml.example` ที่ root project:

```yaml
version: '3.8'

services:
  # Override ค่า Config ของ Service Backend (เมื่อเราสร้าง Container Backend ในอนาคต)
  backend:
    environment:
      # ใส่ Secrets จริงในไฟล์ override นี้ (และห้าม commit ไฟล์นี้)
      - DB_PASSWORD=secret_password_here
      - JWT_SECRET=very_long_and_secure_secret_here
      - NODE_ENV=development

  # Override สำหรับ Database (Local Dev)
  mariadb:
    environment:
      - MYSQL_ROOT_PASSWORD=secret_password_here
      - MYSQL_PASSWORD=secret_password_here
```

### 5. ทดสอบความปลอดภัย (Validation Check)

ลองทดสอบว่าระบบ Validation ทำงานถูกต้องหรือไม่ โดยการ **ลบ** หรือ **เปลี่ยนชื่อ** ตัวแปรสำคัญในไฟล์ `.env` (เช่น ลบ `JWT_SECRET`) แล้วลองรัน:

```bash
pnpm start:dev
```

**ผลลัพธ์ที่ควรได้:**
App **ต้อง Crash** และแสดง Error Message ชัดเจน เช่น:
`Config validation error: "JWT_SECRET" is required`

ถ้าขึ้นแบบนี้แสดงว่าระบบ **Secure Configuration** ของเราทำงานถูกต้องตามแผน T0.1 แล้วครับ! 🎉

---

## **T0.2 Redis & Queue Infrastructure**

เป้าหมายของ Task นี้คือเตรียม **Redis** สำหรับทำ 2 เรื่องสำคัญ:

1. **Distributed Locking (Redlock):** ป้องกัน Race Condition เวลาออกเลขที่เอกสาร
2. **Message Queue (BullMQ):** สำหรับจัดการงานเบื้องหลัง (Background Jobs) เช่น การรวมอีเมลแจ้งเตือน (Digest Notification)

มาเริ่มกันเลยครับ

---

### 1. เพิ่ม Redis ใน Docker Compose

แก้ไขไฟล์ `docker-compose.yml` เพื่อเพิ่ม Service Redis ครับ โดยเราจะตั้ง Password เพื่อความปลอดภัย

**ไฟล์: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  # ... (mariadb & pma เดิม) ...

  # เพิ่ม Redis Service
  redis:
    image: redis:7-alpine
    container_name: lcbp3-redis-local
    restart: always
    # ใช้ Command นี้เพื่อตั้ง Password
    command: redis-server --requirepass "redis_password_secure"
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    networks:
      - lcbp3-net

volumes:
  db_data:
  redis_data: # เพิ่ม Volume

networks:
  lcbp3-net:
    driver: bridge
```

จากนั้นรันคำสั่งเพื่อ Start Redis:

```bash
docker-compose up -d
```

### 2. อัปเดต Environment Config

เพิ่มค่า Config ของ Redis ลงในไฟล์ `.env` และไฟล์ Validation ครับ

**ไฟล์: `.env`**

```env
# ... (ค่าเดิม) ...

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_secure
```

**ไฟล์: `src/common/config/env.validation.ts`**

```typescript
// ... (import Joi) ...

export const envValidationSchema = Joi.object({
  // ... (App & Database Config เดิม) ...

  // 4. Redis Configuration (เพิ่มส่วนนี้)
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().required(),
});
```

### 3. ติดตั้ง Library สำหรับ BullMQ

เราจะใช้ `@nestjs/bullmq` ซึ่งเป็น Wrapper ของ `bullmq` (Redis Queue ที่ทันสมัยกว่า Bull ธรรมดา)

รันคำสั่ง:

```bash
pnpm add @nestjs/bullmq bullmq
```

### 4. ตั้งค่า BullModule ใน AppModule

แก้ไข `src/app.module.ts` เพื่อเชื่อมต่อ Redis เข้ากับระบบ Queue ครับ

**ไฟล์: `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq'; // Import BullModule
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js';

@Module({
  imports: [
    // 1. Config (เดิม)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),

    // 2. TypeORM (เดิม)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // 3. BullMQ (Redis) Setup [NEW]
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 5. ทดสอบการเชื่อมต่อ Redis

ลอง Start App ดูอีกครั้งครับ:

```bash
pnpm start:dev
```

ถ้าไม่มี Error ขึ้น และ App Start ได้ปกติ แสดงว่า **T0.2 เสร็จสมบูรณ์** ครับ\! ตอนนี้เรามีทั้ง Database และ Redis พร้อมสำหรับการพัฒนา Business Logic แล้ว

---

### 6. **แก้ไข Error**

ปัญหานี้เกิดจากยังไม่ได้ **Import** `BullModule` เข้ามาในไฟล์ `src/app.module.ts` ครับ (TypeScript เลยไม่รู้จักว่า `BullModule` คืออะไร)

ให้เพิ่มบรรทัดนี้ที่ส่วนบนสุดของไฟล์ `src/app.module.ts` ครับ:

```typescript
import { BullModule } from '@nestjs/bullmq';
```

หรือลองตรวจสอบไฟล์ `src/app.module.ts` ให้ครบถ้วนตามนี้ครับ:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq'; // <--- ต้องมีบรรทัดนี้ครับ
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './common/config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
    // Queue Configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```
