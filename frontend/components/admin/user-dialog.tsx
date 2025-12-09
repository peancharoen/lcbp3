"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateUser, useUpdateUser, useRoles } from "@/hooks/use-users";
import { useOrganizations } from "@/hooks/use-master-data";
import { useEffect } from "react";
import { User } from "@/types/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  password: z.string().min(6).optional(),
  is_active: z.boolean().default(true),
  line_id: z.string().optional(),
  primary_organization_id: z.coerce.number().optional(),
  role_ids: z.array(z.number()).default([]),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { data: roles = [] } = useRoles();
  const { data: organizations = [] } = useOrganizations();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      is_active: true,
      role_ids: [] as number[],
      line_id: "",
      primary_organization_id: undefined as number | undefined,
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        line_id: user.line_id || "",
        primary_organization_id: user.primary_organization_id,
        role_ids: user.roles?.map((r: any) => r.roleId) || [],
      });
    } else {
      reset({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        is_active: true,
        line_id: "",
        primary_organization_id: undefined,
        role_ids: [],
      });
    }
  }, [user, reset, open]);

  const selectedRoleIds = watch("role_ids") || [];

  const onSubmit = (data: UserFormData) => {
    // If password is empty (and editing), exclude it
    if (user && !data.password) {
      delete data.password;
    }

    if (user) {
      updateUser.mutate(
        { id: user.user_id, data },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createUser.mutate(data as any, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Create New User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username *</Label>
              <Input {...register("username")} disabled={!!user} />
              {errors.username && (
                <p className="text-sm text-red-500">{errors.username.message}</p>
              )}
            </div>

            <div>
              <Label>Email *</Label>
              <Input type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input {...register("first_name")} />
            </div>

            <div>
              <Label>Last Name *</Label>
              <Input {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Line ID</Label>
              <Input {...register("line_id")} />
            </div>

            <div>
              <Label>Primary Organization</Label>
              <Select
                value={watch("primary_organization_id")?.toString()}
                onValueChange={(val) =>
                  setValue("primary_organization_id", parseInt(val))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map((org: any) => (
                    <SelectItem
                      key={org.id}
                      value={org.id.toString()}
                    >
                      {org.organizationCode} - {org.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!user && (
            <div>
              <Label>Password *</Label>
              <Input type="password" {...register("password")} />
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="mb-3 block">Roles</Label>
            <div className="space-y-2 border p-3 rounded-md max-h-[200px] overflow-y-auto">
              {roles.length === 0 && <p className="text-sm text-muted-foreground">Loading roles...</p>}
              {roles.map((role: any) => (
                <div key={role.roleId} className="flex items-start space-x-2">
                  <Checkbox
                    id={`role-${role.roleId}`}
                    checked={selectedRoleIds.includes(role.roleId)}
                    onCheckedChange={(checked) => {
                      const current = selectedRoleIds;
                      if (checked) {
                        setValue("role_ids", [...current, role.roleId]);
                      } else {
                        setValue(
                          "role_ids",
                          current.filter((id) => id !== role.roleId)
                        );
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={`role-${role.roleId}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {role.roleName}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={watch("is_active")}
                onCheckedChange={(chk) => setValue("is_active", chk === true)}
              />
              <label
                htmlFor="is_active"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Active User
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUser.isPending || updateUser.isPending}
            >
              {user ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
