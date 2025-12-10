"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateOrganization,
  useUpdateOrganization,
} from "@/hooks/use-master-data";
import { useEffect } from "react";
import { Organization } from "@/types/organization";

// Organization role types matching database
const ORGANIZATION_ROLES = [
  { value: "1", label: "Owner" },
  { value: "2", label: "Designer" },
  { value: "3", label: "Consultant" },
  { value: "4", label: "Contractor" },
  { value: "5", label: "Third Party" },
] as const;

const organizationSchema = z.object({
  organizationCode: z.string().min(1, "Organization Code is required"),
  organizationName: z.string().min(1, "Organization Name is required"),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface OrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization | null;
}

export function OrganizationDialog({
  open,
  onOpenChange,
  organization,
}: OrganizationDialogProps) {
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      organizationCode: "",
      organizationName: "",
      roleId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        organizationCode: organization.organizationCode,
        organizationName: organization.organizationName,
        roleId: organization.roleId?.toString() || "",
        isActive: organization.isActive,
      });
    } else {
      reset({
        organizationCode: "",
        organizationName: "",
        roleId: "",
        isActive: true,
      });
    }
  }, [organization, reset, open]);

  const onSubmit = (data: OrganizationFormData) => {
    const submitData = {
      ...data,
      roleId: data.roleId ? parseInt(data.roleId) : undefined,
    };

    if (organization) {
      updateOrg.mutate(
        { id: organization.id, data: submitData },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createOrg.mutate(submitData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {organization ? "Edit Organization" : "New Organization"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization Code *</Label>
              <Input
                placeholder="e.g. OWNER"
                {...register("organizationCode")}
              />
              {errors.organizationCode && (
                <p className="text-sm text-red-500">
                  {errors.organizationCode.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={watch("roleId")}
                onValueChange={(value) => setValue("roleId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Organization Name *</Label>
            <Input
              placeholder="e.g. Project Owner Co., Ltd."
              {...register("organizationName")}
            />
            {errors.organizationName && (
              <p className="text-sm text-red-500">
                {errors.organizationName.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this organization
              </p>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrg.isPending || updateOrg.isPending}
            >
              {organization ? "Save Changes" : "Create Organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
