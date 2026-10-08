// File: frontend/app/(admin)/admin/notifications/channels/page.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US2, T042) — admin จัดการ Telegram group/topic bindings
// - 2026-10-06: User Grouping Model — ผูก channel ให้ user group / department ได้ (ไม่ใช่แค่ project)
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Link2, Trash, Loader2, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

import {
  useNotificationChannels,
  useIssueLinkCode,
  usePatchChannel,
  useDeleteChannel,
} from '@/hooks/use-notification-channels';
import { useProjects } from '@/hooks/use-projects';
import { useOrganizations } from '@/hooks/use-master-data';
import { useUserGroups, useDepartments } from '@/hooks/use-grouping';
import { NotificationChannel, IssueLinkCodeDto } from '@/lib/services/notification-channel.service';
import { Organization } from '@/types/organization';
import { useTranslations } from '@/hooks/use-translations';

type ChannelScopeType = 'project' | 'user_group' | 'department';

const linkCodeSchema = z.object({
  scopeType: z.enum(['project', 'user_group', 'department']),
  /** publicId ของ scope ที่เลือก (project / user_group / department) */
  scopeRef: z.string().min(1),
  /** org ที่เลือกก่อน เมื่อ scope = department */
  scopeOrg: z.string().optional(),
  name: z.string().max(255).optional(),
});
type LinkCodeForm = z.infer<typeof linkCodeSchema>;

export default function NotificationChannelsPage() {
  const t = useTranslations();
  const { data: channels, isLoading } = useNotificationChannels();
  const { data: projects } = useProjects();
  const { data: organizations } = useOrganizations({ isActive: true });
  const organizationList: Organization[] = Array.isArray(organizations)
    ? (organizations as Organization[])
    : [];
  const issueLinkCode = useIssueLinkCode();
  const patchChannel = usePatchChannel();
  const deleteChannel = useDeleteChannel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LinkCodeForm>({
    resolver: zodResolver(linkCodeSchema),
    defaultValues: { scopeType: 'project' },
  });
  const scopeType = watch('scopeType');
  const scopeRef = watch('scopeRef');
  const scopeOrg = watch('scopeOrg');
  const { data: userGroups } = useUserGroups();
  const { data: departments } = useDepartments(
    scopeType === 'department' ? scopeOrg : undefined
  );

  const onIssue = async (data: LinkCodeForm) => {
    // Map scopeType + scopeRef → field ของ DTO (ต้องระบุอย่างใดอย่างหนึ่ง)
    const dto: IssueLinkCodeDto = { name: data.name };
    if (data.scopeType === 'project') dto.projectPublicId = data.scopeRef;
    else if (data.scopeType === 'user_group')
      dto.userGroupPublicId = data.scopeRef;
    else dto.departmentPublicId = data.scopeRef;
    const result = await issueLinkCode.mutateAsync(dto);
    setIssuedCode(result.code);
  };

  const columns: ColumnDef<NotificationChannel>[] = [
    {
      accessorKey: 'name',
      header: 'ชื่อ',
      cell: ({ row }) => row.original.name ?? '—',
    },
    {
      accessorKey: 'scopeName',
      header: 'Scope',
      cell: ({ row }) => {
        const ch = row.original;
        const scopeTypeLabel = ch.projectPublicId
          ? 'โครงการ'
          : ch.userGroupPublicId
            ? 'กลุ่มผู้ใช้'
            : ch.departmentPublicId
              ? 'แผนก'
              : 'ทั่วไป';
        return (
          <div className="flex flex-col">
            <span>{ch.scopeName ?? '—'}</span>
            <span className="text-xs text-muted-foreground">
              {scopeTypeLabel}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'externalChatId',
      header: 'Chat / Topic',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.externalChatId}
          {row.original.telegramTopicId != null &&
            ` / topic ${row.original.telegramTopicId}`}
        </span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'สถานะ',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(v) =>
              patchChannel.mutate({
                publicId: row.original.publicId,
                isActive: v,
              })
            }
          />
          {row.original.isActive ? (
            <Badge variant="default">ใช้งาน</Badge>
          ) : (
            <Badge variant="secondary">ปิด</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'lastError',
      header: 'Error ล่าสุด',
      cell: ({ row }) =>
        row.original.lastError ? (
          <span className="text-xs text-destructive">
            {row.original.lastError}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Trash className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยกเลิกการผูก channel นี้?</AlertDialogTitle>
              <AlertDialogDescription>
                กลุ่ม/topic นี้จะไม่ได้รับการแจ้งเตือนจากโครงการอีก
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteChannel.mutate(row.original.publicId)}
              >
                ยืนยัน
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Notification Channels</h3>
          <p className="text-sm text-muted-foreground">
            ผูก Telegram group/forum topic เข้ากับโครงการเพื่อรับแจ้งเตือนระดับทีม
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          เพิ่ม Telegram Channel
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <DataTable columns={columns} data={channels ?? []} />
      )}

      {/* Dialog สร้าง link code */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setIssuedCode(null);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม Telegram Channel</DialogTitle>
          </DialogHeader>
          {issuedCode ? (
            <div className="space-y-4">
              <p className="text-sm">
                นำรหัสนี้ไปพิมพ์ใน Telegram group ที่ต้องการผูก:
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
                <code className="flex-1 font-mono text-lg">/link {issuedCode}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(`/link ${issuedCode}`);
                    toast.success('คัดลอกแล้ว');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                รหัสหมดอายุใน 15 นาที ใช้ได้ครั้งเดียว — ส่งใน group (หรือใน
                topic ของ forum group เพื่อผูกเฉพาะ topic)
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onIssue)} className="space-y-4">
              <div className="space-y-2">
                <Label>ประเภท scope</Label>
                <Select
                  value={scopeType ?? 'project'}
                  onValueChange={(v: ChannelScopeType) => {
                    setValue('scopeType', v);
                    setValue('scopeRef', '');
                    setValue('scopeOrg', undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">โครงการ</SelectItem>
                    <SelectItem value="user_group">กลุ่มผู้ใช้</SelectItem>
                    <SelectItem value="department">แผนก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scopeType === 'department' && (
                <div className="space-y-2">
                  <Label>องค์กร (สำหรับเลือกแผนก)</Label>
                  <Select
                    value={scopeOrg ?? ''}
                    onValueChange={(v) => {
                      setValue('scopeOrg', v);
                      setValue('scopeRef', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกองค์กร" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizationList.map((o) => (
                        <SelectItem key={o.publicId} value={o.publicId}>
                          {o.organizationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  {scopeType === 'user_group'
                    ? 'กลุ่มผู้ใช้'
                    : scopeType === 'department'
                      ? 'แผนก'
                      : 'โครงการ'}
                </Label>
                <Select
                  value={scopeRef}
                  onValueChange={(v) => setValue('scopeRef', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeType === 'project' &&
                      (projects ?? []).map((p) => (
                        <SelectItem key={p.publicId} value={p.publicId}>
                          {p.projectName}
                        </SelectItem>
                      ))}
                    {scopeType === 'user_group' &&
                      (userGroups ?? []).map((g) => (
                        <SelectItem key={g.publicId} value={g.publicId}>
                          {g.name}
                        </SelectItem>
                      ))}
                    {scopeType === 'department' &&
                      (departments ?? []).map((d) => (
                        <SelectItem key={d.publicId} value={d.publicId}>
                          {d.departmentName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.scopeRef && (
                  <p className="text-xs text-destructive">กรุณาเลือก scope</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>ชื่อที่แสดง (ไม่บังคับ)</Label>
                <Input placeholder="เช่น LCBP3 — topic Correspondences" {...register('name')} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={issueLinkCode.isPending}>
                  {issueLinkCode.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  สร้างรหัสผูกกลุ่ม
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
