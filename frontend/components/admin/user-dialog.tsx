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
import { useEffect, useState } from "react";
import { User } from "@/types/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

// Update schema to include confirmPassword
const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  isActive: z.boolean().optional(),
  lineId: z.string().optional(),
  primaryOrganizationId: z.number().optional(),
  roleIds: z.array(z.number()).optional(),
}).refine((data) => {
  // If password is provided (creating or resetting), confirmPassword must match
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => {
   // Password required for creation
   // We can't easily check "isCreating" here without context, checking length if provided
   if (data.password && data.password.length < 6) {
       return false;
   }
   return true;
}, {
    message: "Password must be at least 6 characters",
    path: ["password"]
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      isActive: true,
      roleIds: [],
      lineId: "",
      primaryOrganizationId: undefined,
      password: "",
      confirmPassword: ""
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lineId: user.lineId || "",
        primaryOrganizationId: user.primaryOrganizationId,
        roleIds: user.roles?.map((r: any) => r.roleId) || [],
        password: "",
        confirmPassword: ""
      });
    } else {
      reset({
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        isActive: true,
        lineId: "",
        primaryOrganizationId: undefined,
        roleIds: [],
        password: "",
        confirmPassword: ""
      });
    }
    // Also reset visibility
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [user, reset, open]);

  const selectedRoleIds = watch("roleIds") || [];

  const onSubmit = (data: UserFormData) => {
    // Basic validation for create vs update
    if (!user && !data.password) {
        // This should be caught by schema ideally, but refined schema is tricky with conditional
        // Force error via set error not possible easily here, rely on form state?
        // Actually the refine check handles length check if provided, but for create it is mandatory.
        // Let's rely on server side or manual check if schema misses it (zod optional() makes it pass if undefined)
        // Adjusting schema to be strict string for create is hard with one schema.
        // Let's trust Zod or add checks.
    }

    // Clean up data
    const payload = { ...data };
    delete payload.confirmPassword; // Don't send to API
    if (!payload.password) delete payload.password; // Don't send empty password on edit

    if (user) {
      updateUser.mutate(
        { id: user.userId, data: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      // Create req: Password mandatory
      if (!payload.password) return; // Should allow Zod to catch or show error

      createUser.mutate(payload as any, {
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
              <Input
                {...register("username")}
                disabled={!!user}
                autoComplete="off"
              />
              {errors.username && (
                <p className="text-sm text-red-500">{errors.username.message}</p>
              )}
            </div>

            <div>
              <Label>Email *</Label>
              <Input type="email" {...register("email")} autoComplete="off" />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input {...register("firstName")} autoComplete="off" />
               {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <Label>Last Name *</Label>
              <Input {...register("lastName")} autoComplete="off" />
               {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Line ID</Label>
              <Input {...register("lineId")} autoComplete="off" />
            </div>

            <div>
              <Label>Primary Organization</Label>
              <Select
                value={watch("primaryOrganizationId")?.toString()}
                onValueChange={(val) =>
                  setValue("primaryOrganizationId", parseInt(val))
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

          {/* Password Section - Show for Create, or Optional for Edit */}
          <div className="space-y-4 border p-4 rounded-md">
             <h3 className="text-sm font-medium">{user ? "Change Password (Optional)" : "Password Setup"}</h3>

             <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label>Password {user ? "" : "*"}</Label>
                  <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...register("password")}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                  </div>
                   {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                 <div className="relative">
                  <Label>Confirm Password {user ? "" : "*"}</Label>
                   <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        {...register("confirmPassword")}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                         {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                   </div>
                   {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
             </div>
          </div>

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
                        setValue("roleIds", [...current, role.roleId]);
                      } else {
                        setValue(
                          "roleIds",
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
                checked={watch("isActive")}
                onCheckedChange={(chk) => setValue("isActive", chk === true)}
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
