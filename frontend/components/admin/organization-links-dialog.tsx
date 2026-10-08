// File: frontend/components/admin/organization-links-dialog.tsx
// Change Log:
// - 2026-10-08: Dialog กลางสำหรับจัดการ org links ของ project/contract พร้อม role
//   (deferred จาก PR #29 — ตาราง junction มี role_id แต่ยังไม่มี UI กำกับ)
'use client';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Plus, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { organizationService } from '@/lib/services/organization.service';
import { LinkContext, organizationLinksService } from '@/lib/services/organization-links.service';
import { LinkedOrganization, Organization } from '@/types/organization';

interface OrganizationLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** context ของ junction — 'project' หรือ 'contract' */
  context: LinkContext;
  /** publicId ของ project/contract (ADR-019) */
  contextUuid: string;
  /** label สำหรับแสดงใน title เช่น contractCode */
  contextLabel: string;
}

const linkSchema = z.object({
  organizationId: z.string().uuid('Select an organization'),
  roleName: z.string().min(1, 'Select a role'),
});

type LinkFormData = z.infer<typeof linkSchema>;

/**
 * Dialog จัดการองค์กรที่ผูกกับ project/contract พร้อม role ต่อ context
 * ใช้ร่วมกันได้ทั้งหน้า Projects และ Contracts — API path ถูกเลือกจาก prop `context`
 */
export function OrganizationLinksDialog({
  open,
  onOpenChange,
  context,
  contextUuid,
  contextLabel,
}: OrganizationLinksDialogProps) {
  const queryClient = useQueryClient();
  const queryKey = ['org-links', context, contextUuid];

  const { data: links, isLoading } = useQuery({
    queryKey,
    queryFn: () => organizationLinksService.list(context, contextUuid),
    enabled: open,
  });

  const { data: roles } = useQuery({
    queryKey: ['organization-roles'],
    queryFn: () => organizationService.getRoles(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: orgs } = useQuery({
    queryKey: ['organizations-active'],
    queryFn: () => organizationService.getAll({ isActive: true }),
    enabled: open,
  });

  // องค์กรที่ยังไม่ถูกผูก — ห้ามเลือกซ้ำ (DB กันไว้ด้วย PK แต่ UX ควรกรองล่วงหน้า)
  const linkableOrgs = useMemo(() => {
    const orgList: Organization[] = Array.isArray(orgs) ? orgs : [];
    const linkedIds = new Set((links ?? []).map((l) => l.organizationId));
    return orgList.filter((o) => !linkedIds.has(o.publicId));
  }, [orgs, links]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const onError = (fallback: string) => (err: AxiosError<{ message: string }>) =>
    toast.error(err.response?.data?.message || fallback);

  const linkMutation = useMutation({
    mutationFn: (data: LinkFormData) => organizationLinksService.link(context, contextUuid, data),
    onSuccess: () => {
      toast.success('Organization linked');
      invalidate();
      reset({ organizationId: '', roleName: '' });
    },
    onError: onError('Failed to link organization'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ organizationId, roleName }: { organizationId: string; roleName: string }) =>
      organizationLinksService.updateRole(context, contextUuid, organizationId, roleName),
    onSuccess: () => {
      toast.success('Role updated');
      invalidate();
    },
    onError: onError('Failed to update role'),
  });

  const unlinkMutation = useMutation({
    mutationFn: (organizationId: string) => organizationLinksService.unlink(context, contextUuid, organizationId),
    onSuccess: () => {
      toast.success('Organization unlinked');
      invalidate();
    },
    onError: onError('Failed to unlink organization'),
  });

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: { organizationId: '', roleName: '' },
  });

  const onSubmit = (data: LinkFormData) => linkMutation.mutate(data);

  const contextTitle = context === 'project' ? 'Project' : 'Contract';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Organizations — {contextTitle} {contextLabel}
          </DialogTitle>
        </DialogHeader>

        {/* ฟอร์มเพิ่มองค์กรใหม่ */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-3 border rounded-lg p-3 bg-muted/30">
          <div className="flex-1 space-y-1">
            <Label>Organization</Label>
            <Select value={watch('organizationId')} onValueChange={(v) => setValue('organizationId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {linkableOrgs.map((o) => (
                  <SelectItem key={o.publicId} value={o.publicId}>
                    {o.organizationCode} — {o.organizationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.organizationId && <p className="text-sm text-red-500">{errors.organizationId.message}</p>}
          </div>

          <div className="w-48 space-y-1">
            <Label>Role</Label>
            <Select value={watch('roleName')} onValueChange={(v) => setValue('roleName', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r: { roleName: string }) => (
                  <SelectItem key={r.roleName} value={r.roleName}>
                    {r.roleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleName && <p className="text-sm text-red-500">{errors.roleName.message}</p>}
          </div>

          <Button type="submit" disabled={linkMutation.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>

        {/* ตารางองค์กรที่ผูกอยู่ */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (links ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No organizations linked to this {context}</p>
        ) : (
          <div className="divide-y border rounded-lg">
            {(links ?? []).map((link: LinkedOrganization) => (
              <div key={link.organizationId} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{link.organizationCode}</span>
                  <span className="text-muted-foreground ml-2 truncate">{link.organizationName}</span>
                </div>

                {/* เปลี่ยน role inline — ส่ง mutation ทันทีเมื่อเลือก */}
                <Select
                  value={link.roleName ?? undefined}
                  onValueChange={(roleName) =>
                    roleMutation.mutate({
                      organizationId: link.organizationId,
                      roleName,
                    })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="No role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(roles ?? []).map((r: { roleName: string }) => (
                      <SelectItem key={r.roleName} value={r.roleName}>
                        {r.roleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  disabled={unlinkMutation.isPending}
                  onClick={() => unlinkMutation.mutate(link.organizationId)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
