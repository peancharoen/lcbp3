# TASK-FE-010: Admin Panel & Settings UI

**ID:** TASK-FE-010
**Title:** Admin Panel for User & Master Data Management
**Category:** Administration
**Priority:** P2 (Medium)
**Effort:** 5-7 days
**Dependencies:** TASK-FE-002, TASK-FE-005, TASK-BE-012, TASK-BE-013
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build comprehensive Admin Panel for managing users, roles, master data (organizations, projects, contracts, disciplines, document types), system settings, and viewing audit logs.

---

## 🎯 Objectives

1. Create admin layout with separate navigation
2. Build User Management UI (CRUD users, assign roles)
3. Implement Master Data Management screens
4. Create System Settings interface
5. Build Audit Logs viewer
6. Add bulk operations and data import/export

---

## ✅ Acceptance Criteria

- [ ] Admin area accessible only to admins
- [ ] User management (create/edit/delete/deactivate)
- [ ] Role assignment with permission preview
- [ ] Master data CRUD (Organizations, Projects, etc.)
- [ ] Audit logs searchable and filterable
- [ ] System settings editable
- [ ] CSV import/export for bulk operations

---

## 🔧 Implementation Steps

### Step 1: Admin Layout

```typescript
// File: src/app/(admin)/layout.tsx
import { AdminSidebar } from '@/components/admin/sidebar';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // Check if user has admin role
  if (!session?.user?.roles?.some((r) => r.role_name === 'ADMIN')) {
    redirect('/');
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
```

### Step 2: User Management Page

```typescript
// File: src/app/(admin)/admin/users/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import { UserDialog } from '@/components/admin/user-dialog';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'first_name',
      header: 'Name',
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'secondary'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.roles?.map((role: any) => (
            <Badge key={role.user_role_id} variant="outline">
              {role.role_name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setSelectedUser(row.original);
                setDialogOpen(true);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeactivate(row.original.user_id)}
            >
              {row.original.is_active ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage system users and their roles
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedUser(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <DataTable columns={columns} data={users} />

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
      />
    </div>
  );
}
```

### Step 3: User Create/Edit Dialog

```typescript
// File: src/components/admin/user-dialog.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  password: z.string().min(6).optional(),
  is_active: z.boolean().default(true),
  roles: z.array(z.number()),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: user || {},
  });

  const availableRoles = [
    { role_id: 1, role_name: 'ADMIN', description: 'System Administrator' },
    { role_id: 2, role_name: 'USER', description: 'Regular User' },
    { role_id: 3, role_name: 'APPROVER', description: 'Document Approver' },
  ];

  const selectedRoles = watch('roles') || [];

  const onSubmit = async (data: UserFormData) => {
    // Call API to create/update user
    console.log(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username *</Label>
              <Input {...register('username')} />
              {errors.username && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <Label>Email *</Label>
              <Input type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input {...register('first_name')} />
            </div>

            <div>
              <Label>Last Name *</Label>
              <Input {...register('last_name')} />
            </div>
          </div>

          {!user && (
            <div>
              <Label>Password *</Label>
              <Input type="password" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="mb-3 block">Roles</Label>
            <div className="space-y-2">
              {availableRoles.map((role) => (
                <label
                  key={role.role_id}
                  className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.role_id)}
                    onCheckedChange={(checked) => {
                      const newRoles = checked
                        ? [...selectedRoles, role.role_id]
                        : selectedRoles.filter((id) => id !== role.role_id);
                      setValue('roles', newRoles);
                    }}
                  />
                  <div>
                    <div className="font-medium">{role.role_name}</div>
                    <div className="text-sm text-gray-600">
                      {role.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox {...register('is_active')} defaultChecked />
            <Label>Active</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {user ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: Master Data Management (Organizations)

```typescript
// File: src/app/(admin)/admin/organizations/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    org_code: '',
    org_name: '',
    org_name_th: '',
    description: '',
  });

  const columns = [
    { accessorKey: 'org_code', header: 'Code' },
    { accessorKey: 'org_name', header: 'Name (EN)' },
    { accessorKey: 'org_name_th', header: 'Name (TH)' },
    { accessorKey: 'description', header: 'Description' },
  ];

  const handleSubmit = async () => {
    // Call API to create organization
    console.log(formData);
    setDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-gray-600 mt-1">Manage project organizations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Add Organization</Button>
      </div>

      <DataTable columns={columns} data={organizations} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organization Code *</Label>
              <Input
                value={formData.org_code}
                onChange={(e) =>
                  setFormData({ ...formData, org_code: e.target.value })
                }
                placeholder="e.g., กทท."
              />
            </div>
            <div>
              <Label>Name (English) *</Label>
              <Input
                value={formData.org_name}
                onChange={(e) =>
                  setFormData({ ...formData, org_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Name (Thai)</Label>
              <Input
                value={formData.org_name_th}
                onChange={(e) =>
                  setFormData({ ...formData, org_name_th: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Step 5: Audit Logs Viewer

```typescript
// File: src/app/(admin)/admin/audit-logs/page.tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    user: '',
    action: '',
    entity: '',
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-gray-600 mt-1">View system activity and changes</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Input placeholder="Search user..." />
          </div>
          <div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correspondence">Correspondence</SelectItem>
                <SelectItem value="rfa">RFA</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Logs List */}
      <div className="space-y-2">
        {logs.map((log: any) => (
          <Card key={log.audit_log_id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium">{log.user_name}</span>
                  <Badge>{log.action}</Badge>
                  <Badge variant="outline">{log.entity_type}</Badge>
                </div>
                <p className="text-sm text-gray-600">{log.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {log.ip_address && (
                <span className="text-xs text-gray-500">
                  IP: {log.ip_address}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Step 6: Admin Sidebar Navigation

```typescript
// File: src/components/admin/sidebar.tsx
'use client';

import Link from 'link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Users, Building2, Settings, FileText, Activity } from 'lucide-react';

const menuItems = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/projects', label: 'Projects', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-gray-50 p-4">
      <h2 className="text-lg font-bold mb-6">Admin Panel</h2>
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-gray-100'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## 📦 Deliverables

- [ ] Admin layout with sidebar navigation
- [ ] User Management (CRUD, roles assignment)
- [ ] Master Data Management screens:
  - [ ] Organizations
  - [ ] Projects
  - [ ] Contracts
  - [ ] Disciplines
  - [ ] Document Types
- [ ] System Settings interface
- [ ] Audit Logs viewer with filters
- [ ] CSV import/export functionality

---

## 🧪 Testing

### Test Cases

1. **User Management**

   - Create new user
   - Assign multiple roles
   - Deactivate/activate user
   - Delete user

2. **Master Data**

   - Create organization
   - Edit organization details
   - Delete organization (check for dependencies)

3. **Audit Logs**
   - View all logs
   - Filter by user/action/entity
   - Search logs
   - Export logs

---

## 🔗 Related Documents

- [TASK-BE-012: Master Data Management](./TASK-BE-012-master-data-management.md)
- [TASK-BE-013: User Management](./TASK-BE-013-user-management.md)
- [ADR-004: RBAC Implementation](../../05-decisions/ADR-004-rbac-implementation.md)

---

**Created:** 2025-12-01
**Status:** Ready
