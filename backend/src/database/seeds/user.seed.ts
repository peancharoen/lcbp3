import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/auth/entities/role.entity';
import * as bcrypt from 'bcrypt';

export async function seedUsers(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  // Create Roles
  const rolesData = [
    {
      roleName: 'Superadmin',
      description:
        'ผู้ดูแลระบบสูงสุด: สามารถทำทุกอย่างในระบบ, จัดการองค์กร, และจัดการข้อมูลหลักระดับ Global',
    },
    {
      roleName: 'Org Admin',
      description:
        'ผู้ดูแลองค์กร: จัดการผู้ใช้ในองค์กร, จัดการบทบาท / สิทธิ์ภายในองค์กร, และดูรายงานขององค์กร',
    },
    {
      roleName: 'Document Control',
      description:
        'ควบคุมเอกสารขององค์กร: เพิ่ม / แก้ไข / ลบเอกสาร, และกำหนดสิทธิ์เอกสารภายในองค์กร',
    },
    {
      roleName: 'Editor',
      description:
        'ผู้แก้ไขเอกสารขององค์กร: เพิ่ม / แก้ไขเอกสารที่ได้รับมอบหมาย',
    },
    {
      roleName: 'Viewer',
      description: 'ผู้ดูเอกสารขององค์กร: ดูเอกสารที่มีสิทธิ์เข้าถึงเท่านั้น',
    },
    {
      roleName: 'Project Manager',
      description:
        'ผู้จัดการโครงการ: จัดการสมาชิกในโครงการ, สร้าง / จัดการสัญญาในโครงการ, และดูรายงานโครงการ',
    },
    {
      roleName: 'Contract Admin',
      description:
        'ผู้ดูแลสัญญา: จัดการสมาชิกในสัญญา, สร้าง / จัดการข้อมูลหลักเฉพาะสัญญา, และอนุมัติเอกสารในสัญญา',
    },
  ];

  const roleMap = new Map();
  for (const r of rolesData) {
    let role = await roleRepo.findOneBy({ roleName: r.roleName });
    if (!role) {
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
  const passwordHash = await bcrypt.hash('password123', salt); // Default password

  for (const u of usersData) {
    const exists = await userRepo.findOneBy({ username: u.username });
    if (!exists) {
      const user = userRepo.create({
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        roles: [roleMap.get(u.roleName)],
      });
      await userRepo.save(user);
    }
  }
}
