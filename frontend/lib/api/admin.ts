import { User, CreateUserDto, Organization, AuditLog } from '@/types/admin';

// Mock Data
const mockUsers: User[] = [
  {
    publicId: 'user-001',
    userId: 1,
    username: 'admin',
    email: 'admin@example.com',
    firstName: 'System',
    lastName: 'Admin',
    isActive: true,
    roles: [{ publicId: 'role-001', roleId: 1, roleName: 'ADMIN', description: 'Administrator' }],
  },
  {
    publicId: 'user-002',
    userId: 2,
    username: 'jdoe',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    roles: [{ publicId: 'role-002', roleId: 2, roleName: 'USER', description: 'Regular User' }],
  },
];

const mockOrgs: Organization[] = [
  {
    publicId: 'org-001',
    orgId: 1,
    orgCode: 'PAT',
    orgName: 'Port Authority of Thailand',
    orgNameTh: 'การท่าเรือแห่งประเทศไทย',
    description: 'Owner',
  },
  {
    publicId: 'org-002',
    orgId: 2,
    orgCode: 'CNPC',
    orgName: 'CNPC Consortium',
    description: 'Main Contractor',
  },
];

const mockLogs: AuditLog[] = [
  {
    publicId: 'log-001',
    auditLogId: 1,
    userName: 'admin',
    action: 'CREATE',
    entityType: 'user',
    description: "Created user 'jdoe'",
    ipAddress: '192.168.1.1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    publicId: 'log-002',
    auditLogId: 2,
    userName: 'jdoe',
    action: 'UPDATE',
    entityType: 'rfa',
    description: 'Updated status of RFA-001 to APPROVED',
    ipAddress: '192.168.1.5',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export const adminApi = {
  getUsers: async (): Promise<User[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockUsers];
  },

  createUser: async (data: CreateUserDto): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const maxId = mockUsers.length > 0 ? Math.max(...mockUsers.map((u) => u.userId ?? 0)) : 0;
    const newUser: User = {
      publicId: `user-${String(maxId + 1).padStart(3, '0')}`,
      userId: maxId + 1,
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: data.isActive,
      roles: data.roles.map((id) => ({
        publicId: `role-${String(id).padStart(3, '0')}`,
        roleId: id,
        roleName: id === 1 ? 'ADMIN' : 'USER',
        description: '',
      })),
    };
    mockUsers.push(newUser);
    return newUser;
  },

  getOrganizations: async (): Promise<Organization[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockOrgs];
  },

  createOrganization: async (data: Omit<Organization, 'orgId'>): Promise<Organization> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const maxId = mockOrgs.length > 0 ? Math.max(...mockOrgs.map((o) => o.orgId ?? 0)) : 0;
    const newOrg: Organization = { ...data, publicId: data.publicId || `org-${String(maxId + 1).padStart(3, '0')}`, orgId: maxId + 1 };
    mockOrgs.push(newOrg);
    return newOrg;
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return [...mockLogs];
  },
};
