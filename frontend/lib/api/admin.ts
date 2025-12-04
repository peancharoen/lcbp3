import { User, CreateUserDto, Organization, AuditLog } from "@/types/admin";

// Mock Data
const mockUsers: User[] = [
  {
    user_id: 1,
    username: "admin",
    email: "admin@example.com",
    first_name: "System",
    last_name: "Admin",
    is_active: true,
    roles: [{ role_id: 1, role_name: "ADMIN", description: "Administrator" }],
  },
  {
    user_id: 2,
    username: "jdoe",
    email: "john.doe@example.com",
    first_name: "John",
    last_name: "Doe",
    is_active: true,
    roles: [{ role_id: 2, role_name: "USER", description: "Regular User" }],
  },
];

const mockOrgs: Organization[] = [
  {
    org_id: 1,
    org_code: "PAT",
    org_name: "Port Authority of Thailand",
    org_name_th: "การท่าเรือแห่งประเทศไทย",
    description: "Owner",
  },
  {
    org_id: 2,
    org_code: "CNPC",
    org_name: "CNPC Consortium",
    description: "Main Contractor",
  },
];

const mockLogs: AuditLog[] = [
  {
    audit_log_id: 1,
    user_name: "admin",
    action: "CREATE",
    entity_type: "user",
    description: "Created user 'jdoe'",
    ip_address: "192.168.1.1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    audit_log_id: 2,
    user_name: "jdoe",
    action: "UPDATE",
    entity_type: "rfa",
    description: "Updated status of RFA-001 to APPROVED",
    ip_address: "192.168.1.5",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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
      user_id: Math.max(...mockUsers.map((u) => u.user_id)) + 1,
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      is_active: data.is_active,
      roles: data.roles.map((id) => ({
        role_id: id,
        role_name: id === 1 ? "ADMIN" : "USER",
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

  createOrganization: async (data: Omit<Organization, "org_id">): Promise<Organization> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const newOrg = { ...data, org_id: Math.max(...mockOrgs.map((o) => o.org_id)) + 1 };
    mockOrgs.push(newOrg);
    return newOrg;
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return [...mockLogs];
  },
};
