'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateOrganization, useUpdateOrganization } from '@/hooks/use-master-data';
import { useEffect } from 'react';
import { Organization } from '@/types/organization';

const organizationSchema = z.object({
  organizationCode: z.string().min(1, 'Organization Code is required'),
  organizationName: z.string().min(1, 'Organization Name is required'),
  isActive: z.boolean().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface OrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization | null;
}

export function OrganizationDialog({ open, onOpenChange, organization }: OrganizationDialogProps) {
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      organizationCode: '',
      organizationName: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        organizationCode: organization.organizationCode,
        organizationName: organization.organizationName,
        isActive: organization.isActive,
      });
    } else {
      reset({
        organizationCode: '',
        organizationName: '',
        isActive: true,
      });
    }
  }, [organization, reset, open]);

  const onSubmit = (data: OrganizationFormData) => {
    if (organization) {
      updateOrg.mutate({ uuid: organization.publicId, data }, { onSuccess: () => onOpenChange(false) });
    } else {
      createOrg.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{organization ? 'Edit Organization' : 'New Organization'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization Code *</Label>
              <Input placeholder="e.g. OWNER" {...register('organizationCode')} />
              {errors.organizationCode && <p className="text-sm text-red-500">{errors.organizationCode.message}</p>}
            </div>

          </div>

          <div className="space-y-2">
            <Label>Organization Name *</Label>
            <Input placeholder="e.g. Project Owner Co., Ltd." {...register('organizationName')} />
            {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Active Status</Label>
              <p className="text-sm text-muted-foreground">Enable or disable this organization</p>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
              {organization ? 'Save Changes' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
