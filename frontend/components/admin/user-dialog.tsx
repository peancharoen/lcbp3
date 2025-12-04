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
import { User, CreateUserDto } from "@/types/admin";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api/admin";
import { Loader2 } from "lucide-react";

const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  is_active: z.boolean().default(true),
  roles: z.array(z.number()).min(1, "At least one role is required"),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, user, onSuccess }: UserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      roles: [],
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
        roles: user.roles.map((r) => r.role_id),
      });
    } else {
      reset({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        is_active: true,
        roles: [],
      });
    }
  }, [user, reset, open]);

  const availableRoles = [
    { role_id: 1, role_name: "ADMIN", description: "System Administrator" },
    { role_id: 2, role_name: "USER", description: "Regular User" },
    { role_id: 3, role_name: "APPROVER", description: "Document Approver" },
  ];

  const selectedRoles = watch("roles") || [];

  const handleRoleChange = (roleId: number, checked: boolean) => {
    const currentRoles = selectedRoles;
    const newRoles = checked
      ? [...currentRoles, roleId]
      : currentRoles.filter((id) => id !== roleId);
    setValue("roles", newRoles, { shouldValidate: true });
  };

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      if (user) {
        // await adminApi.updateUser(user.user_id, data);
        console.log("Update user", user.user_id, data);
      } else {
        await adminApi.createUser(data as CreateUserDto);
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      alert("Failed to save user");
    } finally {
      setIsSubmitting(false);
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
              <Label htmlFor="username">Username *</Label>
              <Input id="username" {...register("username")} disabled={!!user} />
              {errors.username && (
                <p className="text-sm text-destructive mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.first_name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          {!user && (
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && (
                <p className="text-sm text-destructive mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="mb-3 block">Roles *</Label>
            <div className="space-y-2 border rounded-md p-4">
              {availableRoles.map((role) => (
                <div
                  key={role.role_id}
                  className="flex items-start gap-3"
                >
                  <Checkbox
                    id={`role-${role.role_id}`}
                    checked={selectedRoles.includes(role.role_id)}
                    onCheckedChange={(checked) => handleRoleChange(role.role_id, checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor={`role-${role.role_id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {role.role_name}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {errors.roles && (
              <p className="text-sm text-destructive mt-1">
                {errors.roles.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={watch("is_active")}
              onCheckedChange={(checked) => setValue("is_active", checked as boolean)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
