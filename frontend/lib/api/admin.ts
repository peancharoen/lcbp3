import { User, CreateUserDto, Organization, AuditLog } from "@/types/admin";

// Mock Data
const mockUsers: User[] = [
  {
    userId: 1,
    username: "admin",
    email: "admin@example.com",
    firstName: "System",
    lastName: "Admin",
    isActive: true,
    roles: [{ roleId: 1, roleName: "ADMIN", description: "Administrator" }],
  },
  {
    userId: 2,
    username: "jdoe",
    email: "john.doe@example.com",
    firstName: "John",
    lastName: "Doe",
    isActive: true,
    roles: [{ roleId: 2, roleName: "USER", description: "Regular User" }],
  },
];

const mockOrgs: Organization[] = [
  {
    orgId: 1,
    orgCode: "PAT",
    orgName: "Port Authority of Thailand",
    orgNameTh: "การท่าเรือแห่งประเทศไทย",
    description: "Owner",
  },
  {
    orgId: 2,
    orgCode: "CNPC",
    orgName: "CNPC Consortium",
    description: "Main Contractor",
  },
];

const mockLogs: AuditLog[] = [
  {
    auditLogId: 1,
    userName: "admin",
    action: "CREATE",
    entityType: "user",
    description: "Created user 'jdoe'",
    ipAddress: "192.168.1.1",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    auditLogId: 2,
    userName: "jdoe",
    action: "UPDATE",
    entityType: "rfa",
    description: "Updated status of RFA-001 to APPROVED",
    ipAddress: "192.168.1.5",
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
    const newUser: User = {
      userId: Math.max(...mockUsers.map((u) => u.userId)) + 1,
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: data.isActive,
      roles: data.roles.map((id) => ({
        roleId: id,
        roleName: id === 1 ? "ADMIN" : "USER",
        description: "",
      })),
    };
    mockUsers.push(newUser);
    return newUser;
  },

  getOrganizations: async (): Promise<Organization[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockOrgs];
  },

  createOrganization: async (data: Omit<Organization, "orgId">): Promise<Organization> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const newOrg = { ...data, orgId: Math.max(...mockOrgs.map((o) => o.orgId)) + 1 };
    mockOrgs.push(newOrg);
    return newOrg;
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return [...mockLogs];
  },
};
