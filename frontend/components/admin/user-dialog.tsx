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
import { useCreateUser, useUpdateUser } from "@/hooks/use-users";
import { useEffect } from "react";
import { User } from "@/types/user";

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  password: z.string().min(6).optional(),
  is_active: z.boolean().default(true),
  role_ids: z.array(z.number()).default([]), // Using role_ids array
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
        is_active: true,
        role_ids: []
    }
  });

  useEffect(() => {
    if (user) {
        reset({
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
            role_ids: user.roles?.map(r => r.role_id) || []
        });
    } else {
        reset({
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            is_active: true,
            role_ids: []
        });
    }
  }, [user, reset, open]); // Reset when open changes or user changes

  const availableRoles = [
    { role_id: 1, role_name: "ADMIN", description: "System Administrator" },
    { role_id: 2, role_name: "USER", description: "Regular User" },
    { role_id: 3, role_name: "APPROVER", description: "Document Approver" },
  ];

  const selectedRoleIds = watch("role_ids") || [];

  const onSubmit = (data: UserFormData) => {
    if (user) {
        updateUser.mutate({ id: user.user_id, data }, {
            onSuccess: () => onOpenChange(false)
        });
    } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createUser.mutate(data as any, {
            onSuccess: () => onOpenChange(false)
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
              {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
            </div>

            <div>
              <Label>Email *</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
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

          {!user && (
            <div>
              <Label>Password *</Label>
              <Input type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
          )}

          <div>
            <Label className="mb-3 block">Roles</Label>
            <div className="space-y-2 border p-3 rounded-md">
              {availableRoles.map((role) => (
                <div key={role.role_id} className="flex items-start space-x-2">
                  <Checkbox
                    id={`role-${role.role_id}`}
                    checked={selectedRoleIds.includes(role.role_id)}
                    onCheckedChange={(checked) => {
                      const current = selectedRoleIds;
                      if (checked) {
                        setValue("role_ids", [...current, role.role_id]);
                      } else {
                        setValue("role_ids", current.filter(id => id !== role.role_id));
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={`role-${role.role_id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role.role_name}
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
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
            <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
              {user ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
