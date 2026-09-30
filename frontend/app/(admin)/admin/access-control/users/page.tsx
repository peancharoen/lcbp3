// File: frontend/app/(admin)/admin/access-control/users/page.tsx
// Change Log:
// - 2026-09-25: Feature 258 (T056) — Telegram status column + admin force-unlink action
// - 2026-09-30: ปรับให้ตรงข้อมูล user จริง — org จาก organization.publicId (แก้ ADR-019 violation),
//   เพิ่ม Last Login/Locked/MustChangePassword, role filter, debounce search, limit 100

'use client';

import { useUsers, useDeleteUser, useUnlinkTelegram, useRoles } from '@/hooks/use-users';
import { useOrganizations } from '@/hooks/use-master-data';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Send, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserDialog } from '@/components/admin/user-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { User } from '@/types/user';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { Organization } from '@/types/organization';
import { getApiErrorMessage } from '@/types/api-error';

// limit สูงพอสำหรับหน้า admin (backend default คือ 10 — ต้องระบุเองไม่งั้นเห็นแค่ 10 users)
const USER_PAGE_LIMIT = 100;

// แปลงวันที่ล็อกอินล่าสุด — null = ยังไม่เคย login
const formatLastLogin = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

// บัญชีถูกล็อกเมื่อ lockedUntil ยังอยู่ในอนาคต
const isLocked = (user: User): boolean => {
  if (!user.lockedUntil) return false;
  const until = new Date(user.lockedUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
};

export default function UsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Debounce search 300ms — ลด request ระหว่างพิมพ์ (server-side LIKE)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: users,
    isLoading,
    isError,
    error,
  } = useUsers({
    search: search || undefined,
    primaryOrganizationId: selectedOrgId ?? undefined,
    roleId: selectedRoleId ?? undefined,
    limit: USER_PAGE_LIMIT,
  });

  const { data: organizations = [] } = useOrganizations();
  const { data: roleOptions = [] } = useRoles();
  const userList = Array.isArray(users) ? users : [];
  const organizationList: Organization[] = Array.isArray(organizations) ? organizations : [];

  const deleteMutation = useDeleteUser();
  const unlinkTelegramMutation = useUnlinkTelegram();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Stats for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Feature 258: Telegram unlink confirm dialog
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [userToUnlink, setUserToUnlink] = useState<User | null>(null);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.publicId, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setUserToDelete(null);
        },
      });
    }
  };

  const confirmUnlinkTelegram = () => {
    if (userToUnlink) {
      unlinkTelegramMutation.mutate(userToUnlink.publicId, {
        onSuccess: () => {
          setUnlinkDialogOpen(false);
          setUserToUnlink(null);
        },
      });
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => <span className="font-semibold">{row.original.username}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) =>
        [row.original.firstName, row.original.lastName].filter(Boolean).join(' ') || '—',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      id: 'organization',
      header: 'Organization',
      cell: ({ row }) => {
        const org = row.original.organization;
        if (!org?.publicId) {
          return 'All Organizations';
        }
        // ข้อมูล embed จาก API ก่อน — ถ้า list ไม่มีชื่อ ให้ lookup จาก organizations master
        if (org.organizationCode) {
          return `${org.organizationCode}${org.organizationName ? ` - ${org.organizationName}` : ''}`;
        }
        const master = organizationList.find((o) => o.publicId === org.publicId);
        return master ? `${master.organizationCode} - ${master.organizationName}` : 'All Organizations';
      },
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => {
        const roles = row.original.roles || [];
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r.publicId ?? r.roleName} variant="outline" className="text-xs">
                {r.roleName}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: 'telegram',
      header: 'Telegram',
      cell: ({ row }) => {
        const status = row.original.telegramStatus;
        if (status === 'linked') {
          return (
            <span className="text-sm">
              ✈️ {row.original.telegramUsername ? `@${row.original.telegramUsername}` : 'Linked'}
            </span>
          );
        }
        if (status === 'blocked') {
          return <Badge variant="destructive">⚠️ Blocked</Badge>;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'lastLogin',
      header: 'Last Login',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatLastLogin(row.original.lastLoginAt)}</span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {isLocked(row.original) && (
            <Badge variant="destructive" className="gap-1">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
          {row.original.mustChangePassword && (
            <Badge variant="outline" className="text-xs">
              Reset required
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedUser(user);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              {user.telegramStatus && user.telegramStatus !== 'none' && (
                <DropdownMenuItem
                  onClick={() => {
                    setUserToUnlink(user);
                    setUnlinkDialogOpen(true);
                  }}
                >
                  <Send className="mr-2 h-4 w-4" /> Unlink Telegram
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDeleteClick(user)}>
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and roles</p>
        </div>
        <Button
          onClick={() => {
            setSelectedUser(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-muted/30 p-4 rounded-lg flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 bg-background"
          />
        </div>
        <div className="w-[250px]">
          <Select value={selectedOrgId || 'all'} onValueChange={(val) => setSelectedOrgId(val === 'all' ? null : val)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizationList.map((org) => (
                <SelectItem key={org.publicId} value={org.publicId}>
                  {org.organizationCode} - {org.organizationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <Select
            value={selectedRoleId !== null ? String(selectedRoleId) : 'all'}
            onValueChange={(val) => setSelectedRoleId(val === 'all' ? null : Number(val))}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roleOptions
                .filter((role) => role.roleId !== undefined)
                .map((role) => (
                  <SelectItem key={role.publicId ?? role.roleName} value={String(role.roleId)}>
                    {role.roleName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {getApiErrorMessage(error, 'Failed to load users')}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={userList} />
      )}

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} user={selectedUser} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              <span className="font-semibold text-foreground"> {userToDelete?.username} </span>
              and remove them from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the Telegram account
              {userToUnlink?.telegramUsername ? ` @${userToUnlink.telegramUsername}` : ''} from
              <span className="font-semibold text-foreground"> {userToUnlink?.username} </span>. They will stop
              receiving Telegram notifications until they link again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlinkTelegram}>
              {unlinkTelegramMutation.isPending ? 'Unlinking...' : 'Unlink Telegram'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
