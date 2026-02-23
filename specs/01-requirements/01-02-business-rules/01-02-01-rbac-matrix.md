# 4. Access Control & RBAC Matrix (V1.8.0)

---
title: 'Access Control & RBAC Matrix'
version: 1.8.0
status: APPROVED
owner: Nattanin Peancharoen / Development Team
last_updated: 2026-02-23
related:
  - specs/02-architecture/02-01-system-architecture.md
  - specs/03-implementation/03-02-backend-guidelines.md
  - specs/07-database/07-01-data-dictionary-v1.8.0.md
  - specs/05-decisions/ADR-005-redis-usage-strategy.md
  - specs/05-decisions/ADR-001-unified-workflow-engine.md
references:
  - [RBAC Implementation](../../99-archives/ADR-004-rbac-implementation.md)
  - [Access Control](../../99-archives/01-04-access-control.md)
---

## 4.1. Overview and Problem Statement

LCBP3-DMS จัดการสิทธิ์การเข้าถึงข้อมูลที่ซับซ้อน ได้แก่:
- **Multi-Organization**: หลายองค์กรใช้ระบบร่วมกัน แต่ต้องแยกข้อมูลตามบริบท
- **Project-Based**: โครงการสามารถมีหลายสัญญาย่อย (Contracts)
- **Hierarchical Permissions**: สิทธิ์ระดับบนสามารถครอบคลุมระดับล่าง
- **Dynamic Roles**: สิทธิ์สามารถปรับเปลี่ยน Role หรือเพิ่ม Role พิเศษได้โดยไม่ต้อง Deploy ระบบใหม่.

Users และ Organizations สามารถเข้าดูหรือแก้ไขเอกสารได้จากสิทธิ์ที่ได้รับ ระบบออกแบบด้วย **4-Level Hierarchical Role-Based Access Control (RBAC)** ដើម្បីรองรับความซับซ้อนนี้.

### Key Requirements
1. User หนึ่งคนสามารถมีหลาย Roles ในหลาย Scopes
2. Permission Inheritance (Global → Organization → Project → Contract)
3. Fine-grained Access Control (เช่น "อนุญาตให้ดู Correspondence เฉพาะใน Project A รวมถึง Contract ภายใต้ Project A เท่านั้น")
4. Performance (Check permission ผ่าน Redis ต้องเร็ว < 10ms)

---

## 4.2. Permission Hierarchy & Enforcement

### 4-Level Scope Hierarchy

การออกแบบสิทธิ์ครอบคลุม Scope ลำดับขั้นดังนี้:

```text
Global (ทั้งระบบ)
│
├─ Organization (ระดับองค์กร)
│  ├─ Project (ระดับโครงการ)
│  │  └─ Contract (ระดับสัญญา)
│  │
│  └─ Project B
│     └─ Contract B
│
└─ Organization 2
   └─ Project C
```

**Permission Enforcement:**
- เมื่อตรวจสอบสิทธิ์ ระบบจะพิจารณาสิทธิ์จากทุก Level ที่ผู้ใช้มี และใช้สิทธิ์ที่ **"ครอบคลุมที่สุด (Most Permissive)"** ในบริบท (Context) นั้นมาเป็นเกณฑ์.
- *Example*: User A เป็น `Viewer` ในองค์กร (ระดับ Organization Level) แต่มอบหมายหน้าที่ให้เป็น `Editor` ในตำแหน่งของ Project X. เมื่อ User A ดำเนินการในบริบท Context ของ Project X (หรือ Contract ที่อยู่ใต้ Project X), User A จะสามารถทำงานด้วยสิทธิ์ `Editor` ทันที.

---

## 4.3. Role and Scope Summary

| Role                 | Scope        | Description                | Key Permissions                                                                                                       |
| :------------------- | :----------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Superadmin**       | Global       | System administrator       | Do everything in the system, manage organizations, manage global data                                                 |
| **Org Admin**        | Organization | Organization administrator | Manage users in the organization, manage roles/permissions within the organization, view organization reports         |
| **Document Control** | Organization | Document controller        | Add/edit/delete documents, set document permissions within the organization                                           |
| **Editor**           | Organization | Document editor            | Edit documents that have been assigned to them                                                                        |
| **Viewer**           | Organization | Document viewer            | View documents that have access permissions                                                                           |
| **Project Manager**  | Project      | Project manager            | Manage members in the project (add/delete/assign roles), create/manage contracts in the project, view project reports |
| **Contract Admin**   | Contract     | Contract administrator     | Manage users in the contract, manage roles/permissions within the contract, view contract reports                     |

### Master Data Management Authority

| Master Data                             | Manager                         | Scope                           |
| :-------------------------------------- | :------------------------------ | :------------------------------ |
| Document Type (Correspondence, RFA)     | **Superadmin**                  | Global                          |
| Document Status (Draft, Approved, etc.) | **Superadmin**                  | Global                          |
| Shop Drawing Category                   | **Project Manager**             | Project (สร้างใหม่ได้ภายในโครงการ) |
| Tags                                    | **Org Admin / Project Manager** | Organization / Project          |
| Custom Roles                            | **Superadmin / Org Admin**      | Global / Organization           |
| Document Numbering Formats              | **Superadmin / Admin**          | Global / Organization           |

---

## 4.4. Onboarding Workflow

- **4.4.1. Create Organization**
  - **Superadmin** สร้าง Organization ใหม่ (e.g. Company A)
  - **Superadmin** แต่งตั้ง User อย่างน้อย 1 คน ให้เป็น **Org Admin** หรือ **Document Control**
- **4.4.2. Add Users to Organization**
  - **Org Admin** เพิ่ม users (`Editor`, `Viewer`) เข้าสู่งองค์กร
- **4.4.3. Assign Users to Project**
  - **Project Manager** เชิญ/กำหนดผู้ใช้เข้าสู่ Project. ในขั้นตอนนี้จะกำหนด **Project Role**
- **4.4.4. Assign Users to Contract**
  - **Contract Admin** เลือก users จาก Project และมอบหมายหน้าที่เจาะจงใน Contract ขั้นตอนนี้จะกำหนด **Contract Role**
- **4.4.5. Security Onboarding**
  - บังคับ Users to change password เป็นครั้งแรก
  - ฝึกอบรม (Security awareness training) สำหรับ users ที่มีสิทธิ์สูงระดับแอดมิน.
  - บันทึก Audit Log ทุกเหตุการณ์เกี่ยวกับการมอบหมาย/ตั้งค่า Permissions.

---

## 4.5. Implementation Details

### 4.5.1 Database Schema (RBAC Tables)

```sql
-- Role Definitions with Scope
CREATE TABLE roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(100) NOT NULL,
  scope ENUM('Global', 'Organization', 'Project', 'Contract') NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE
);

-- Granular Permissions
CREATE TABLE permissions (
  permission_id INT PRIMARY KEY AUTO_INCREMENT,
  permission_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module VARCHAR(50),
  -- Scope Reference ENUM includes CONTRACT
  scope_level ENUM('GLOBAL', 'ORG', 'PROJECT', 'CONTRACT')
);

-- Role -> Permissions Mapping
CREATE TABLE role_permissions (
  role_id INT,
  permission_id INT,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
);

-- User Role Assignments with Context Map
CREATE TABLE user_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  organization_id INT NULL,
  project_id INT NULL,
  contract_id INT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,

  -- ควบคุมโครงสร้าง: ไม่ให้ระบุ Scope เลื่อนลอยข้ามขั้นต้องมีชั้นเดียวชัดเจน
  CONSTRAINT chk_scope CHECK (
    (organization_id IS NOT NULL AND project_id IS NULL AND contract_id IS NULL) OR
    (organization_id IS NULL AND project_id IS NOT NULL AND contract_id IS NULL) OR
    (organization_id IS NULL AND project_id IS NULL AND contract_id IS NOT NULL) OR
    (organization_id IS NULL AND project_id IS NULL AND contract_id IS NULL)
  )
);
```

### 4.5.2 Setup CASL Ability Rules

เพื่อให้ **"การสืบทอดสิทธิ์ (Inheritance Logic)"** ทำงานได้ถูกต้อง เช่น บทบาทระดับ `Project Manager` ให้แผ่คลุมไปถึงทรัพยากรระดับ `Contract` ด้านในด้วย (Logic `project_id -> all embedded contracts`).

```typescript
// ability.factory.ts
import { AbilityBuilder, PureAbility } from '@casl/ability';

export type AppAbility = PureAbility<[string, any]>;

@Injectable()
export class AbilityFactory {
  async createForUser(user: User): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

    const assignments = await this.getUserAssignments(user.user_id);

    for (const assignment of assignments) {
      const role = await this.getRole(assignment.role_id);
      const permissions = await this.getRolePermissions(role.role_id);

      for (const permission of permissions) {
        // e.g. 'correspondence.create', 'project.view'
        const [subject, action] = permission.permission_name.split('.');

        // Apply Scope conditions based on the Role's specified scope level
        switch (role.scope) {
          case 'Global':
            // ได้รับสิทธิ์กับองค์ประกอบทั้งหมด
            can(action, subject);
            break;

          case 'Organization':
            // อนุญาตการ Action ทั้งในองค์กร และโปรเจกต์ภายใต้องค์กร
            can(action, subject, { organization_id: assignment.organization_id });
            // Advanced Case: In some queries mapped to Projects/Contracts, support fallback checks
            // can(action, subject, { '__orgIdFallback': assignment.organization_id });
            break;

          case 'Project':
            // สืบทอดสิทธิ์ไปยัง Project ID นั้นๆ เสมอ และสิทธิ์ครอบคลุมถึงทุก Contracts ที่ผูกกับ Project นี้
            can(action, subject, { project_id: assignment.project_id });
            break;

          case 'Contract':
            // จำกัดเฉพาะใน Contract นั้น ตรงเป้าหมาย
            can(action, subject, { contract_id: assignment.contract_id });
            break;
        }
      }
    }

    return build();
  }
}
```

### 4.5.3 Token Management & Redis Permission Cache

- **Payload Optimization**: JWT Access Token ให้เก็บเฉพาะ `userId` และ ข้อมูล Sessions ขั้นต้น. โครงสร้าง Permissions List ปริมาณมากจะ**ไม่อยู่ใน Token**.
- **Permission Caching**: นำโครงสร้างสิทธิ์ทั้งหมด (Ability Rules ที่ประกอบแล้วจาก 4.5.2) ไป Cache ไว้เป็น Key ภายใต้ฐานข้อมูล **Redis** โดยคงระยะการตั้ง TTL ประมาณ 30 นาที `1800` วินาที. ลดขนาด Payload ลง และเพื่อเป้าหมาย Performance ที่ `< 10ms`.

### 4.5.4 Permission Guard Enforcement (NestJS)

```typescript
// permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
    private redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>('permission', context.getHandler());
    if (!permission) return true; // Route without specific permission requirements

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check Redis cache first
    const cacheKey = `user:${user.user_id}:permissions`;
    let abilityRules = await this.redis.get(cacheKey);

    if (!abilityRules) {
      const newAbility = await this.abilityFactory.createForUser(user);
      abilityRules = newAbility.rules;
      // Store in Cache (1800ms TTL)
      await this.redis.set(cacheKey, JSON.stringify(abilityRules), 'EX', 1800);
    } else {
      abilityRules = JSON.parse(abilityRules);
    }

    const ability = new PureAbility(abilityRules);
    const [action, subject] = permission.split('.');

    // Evaluate mapped payload / resource parameters directly into CASL engine
    const resource = { ...request.params, ...request.body };
    return ability.can(action, subject, resource);
  }
}
```

Controller Example Usage:

```typescript
@Controller('correspondences')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CorrespondenceController {

  @Post()
  @RequirePermission('correspondence.create')
  async create(@Body() dto: CreateCorrespondenceDto) {
    // Accessible only when CASL Evaluate "correspondence.create" successfully fits the parameters limits (Project/Contract scope check)
  }

}
```

---

## 4.6. Cache Invalidation Strategy

เพื่อให้ระบบ Security Update ได้รวดเร็วและปลอดภัย ต้องมีกลไกสั่งรีเซ็ตสิทธิ์ (Invalidation):

1. **When Role Assignemnt Modified**: เมื่อช้อมูลในตาราง `user_assignments` (เช่นลบ/เพิ่ม user ระดับโปรเจกต์) หรือตาราง `role_permissions` (สลับสิทธิ์ของกลุ่ม) เกิดการแก้ไขในฐานข้อมูลแล้ว.
2. **Execute Invalidation**: API Services ต้องทำการลบ Cache เก่าที่ฝั่งขัดข้องทันที ผ่านคำสั่ง `DEL user:{user_id}:permissions` ณ ฝั่ง Redis.
3. ระบบจะทำงานโปรโตซ้ำ (Cold Boot) เข้ามาหยิบ DB -> สร้าง CASL Factory ใหม่ ใน First API Request อีกครั้งในทันที.

---

## 4.7. Appendix: ADR-004 Decision History & Justification

ส่วนอ้างอิงและประวัติศาสตร์การตัดสินใจพิจารณาในอดีต (Reference) ก่อนการนำมาปรับใช้ร่าง Architecture ฉบับ V1.8.0.

### Considered Options Before Version 1.5.0
1. **Option 1**: Simple Role-Based (No Scope)
  - *Pros*: Very simple implementation, Easy to understand
  - *Cons*: ไม่รองรับ Multi-organization, Superadmin เห็นข้อมูลองค์กรอื่นมั่วข้ามกลุ่ม
2. **Option 2**: Organization-Only Scope
  - *Pros*: แยกข้อมูลระหว่าง Organizations ได้ชัดเจน
  - *Cons*: ไม่รองรับระดับ Sub-level Permissions (Project/Contract) ไม่เพียงพอกับ Business Rule.
3. **Option 3**: **4-Level Hierarchical RBAC (Selected)**
  - *Pros*: ครอบคลุม Use Case สูงสุด (Maximum Flexibility), รองรับ Hierarchy สืบทอดสิทธิ์ (Inheritance), ขอบเขตจำกัดข้อมูลอย่างรัดกุมระดับ Contract (Data Isolation).
  - *Cons*: Complexity ทางด้านการ Implement, Invalidate Caching หางานให้ฝั่ง Operations, Developer Learning Curve.

**Decision Rationale:**
เลือกแนวทางที่ 3 รองรับความต้องการของ Construction Projects ที่มีการแบ่งกลุ่มรับเหมาช่วงย่อยระดับ Contracts ต่อเนื่อง (Future proof). แก้ไขปัญหา Performance Cons ด้วยแนวคิดการประจุ Redis Caching ข้ามขั้ว และล้าง Invalidation เฉพาะเมื่อ Triggering Database Updates (อ้างอิงหัวข้อ 4.6).
