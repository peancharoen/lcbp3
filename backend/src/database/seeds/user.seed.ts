import { DataSource } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Role, RoleScope } from '../../modules/user/entities/role.entity';
import { UserAssignment } from '../../modules/user/entities/user-assignment.entity';
import * as bcrypt from 'bcrypt';

export async function seedUsers(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);
  const assignmentRepo = dataSource.getRepository(UserAssignment);

  // Create Roles
  const rolesData = [
    {
      roleName: 'Superadmin',
      scope: RoleScope.GLOBAL,
      description:
        'ผู้ดูแลระบบสูงสุด: สามารถทำทุกอย่างในระบบ, จัดการองค์กร, และจัดการข้อมูลหลักระดับ Global',
    },
    {
      roleName: 'Org Admin',
      scope: RoleScope.ORGANIZATION,
      description:
        'ผู้ดูแลองค์กร: จัดการผู้ใช้ในองค์กร, จัดการบทบาท / สิทธิ์ภายในองค์กร, และดูรายงานขององค์กร',
    },
    {
      roleName: 'Document Control',
      scope: RoleScope.ORGANIZATION,
      description:
        'ควบคุมเอกสารขององค์กร: เพิ่ม / แก้ไข / ลบเอกสาร, และกำหนดสิทธิ์เอกสารภายในองค์กร',
    },
    {
      roleName: 'Editor',
      scope: RoleScope.PROJECT,
      description:
        'ผู้แก้ไขเอกสารขององค์กร: เพิ่ม / แก้ไขเอกสารที่ได้รับมอบหมาย',
    },
    {
      roleName: 'Viewer',
      scope: RoleScope.PROJECT,
      description: 'ผู้ดูเอกสารขององค์กร: ดูเอกสารที่มีสิทธิ์เข้าถึงเท่านั้น',
    },
    {
      roleName: 'Project Manager',
      scope: RoleScope.PROJECT,
      description:
        'ผู้จัดการโครงการ: จัดการสมาชิกในโครงการ, สร้าง / จัดการสัญญาในโครงการ, และดูรายงานโครงการ',
    },
    {
      roleName: 'Contract Admin',
      scope: RoleScope.CONTRACT,
      description:
        'ผู้ดูแลสัญญา: จัดการสมาชิกในสัญญา, สร้าง / จัดการข้อมูลหลักเฉพาะสัญญา, และอนุมัติเอกสารในสัญญา',
    },
  ];

  const roleMap = new Map();
  for (const r of rolesData) {
    let role = await roleRepo.findOneBy({ roleName: r.roleName });
    if (!role) {
      // @ts-ignore
      role = await roleRepo.save(roleRepo.create(r));
    }
    roleMap.set(r.roleName, role);
  }

  // Create Users
  const usersData = [
    {
      username: 'superadmin',
      email: 'superadmin@example.com',
      firstName: 'Super',
      lastName: 'Admin',
      roleName: 'Superadmin',
    },
    {
      username: 'admin',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'คคง.',
      roleName: 'Org Admin',
    },
    {
      username: 'editor01',
      email: 'editor01@example.com',
      firstName: 'DC',
      lastName: 'C1',
      roleName: 'Editor',
    },
    {
      username: 'viewer01',
      email: 'viewer01@example.com',
      firstName: 'Viewer',
      lastName: 'สคฉ.03',
      roleName: 'Viewer',
    },
  ];

  const salt = await bcrypt.genSalt();
  const password = await bcrypt.hash('password123', salt); // Default password

  for (const u of usersData) {
    let user = await userRepo.findOneBy({ username: u.username });
    if (!user) {
      user = userRepo.create({
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        password, // Fixed: password instead of passwordHash
      });
      user = await userRepo.save(user);

      // Create Assignment
      const role = roleMap.get(u.roleName);
      if (role) {
        const assignment = assignmentRepo.create({
          user,
          role,
          assignedAt: new Date(),
        });
        await assignmentRepo.save(assignment);
      }
    }
  }
}
