// File: app/(dashboard)/profile/page.tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, User, Shield, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import apiClient from "@/lib/api/client";
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณาระบุรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านใหม่ไม่ตรงกัน",
    path: ["confirmPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  // --- Password Form Handling ---
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data: PasswordValues) => {
    setIsLoading(true);
    try {
      // เรียก API เปลี่ยนรหัสผ่าน
      await apiClient.put("/users/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      reset();
    } catch (error) {
      toast.error('ไม่สามารถเปลี่ยนรหัสผ่านได้: รหัสผ่านปัจจุบันไม่ถูกต้อง');
      console.error('[ProfilePage] onPasswordSubmit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Notification State (Mockup) ---
  // ในการใช้งานจริง ควรดึงค่าจาก API /users/preferences หรือ UserPreferenceService
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyLine, setNotifyLine] = useState(true);
  const [digestMode, setDigestMode] = useState(false);

  // Helper to get initials
  const userName = session?.user?.name || "User";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile & Settings</h3>
        <p className="text-sm text-muted-foreground">
          จัดการข้อมูลส่วนตัวและการตั้งค่าระบบของคุณ
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* 1. General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลทั่วไป</CardTitle>
              <CardDescription>
                ข้อมูลพื้นฐานของคุณที่แสดงในระบบ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-lg font-semibold">{userName}</h4>
                  <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                  <div className="mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                    {session?.user?.role || "Member"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ชื่อจริง</Label>
                  <Input defaultValue={userName.split(" ")[0]} disabled />
                </div>
                <div className="space-y-2">
                  <Label>นามสกุล</Label>
                  <Input defaultValue={userName.split(" ")[1] || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>อีเมล</Label>
                  <Input defaultValue={session?.user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>หน่วยงาน / องค์กร</Label>
                  {/* ในอนาคตดึงจาก Organization ID */}
                  <Input defaultValue={`Organization ID: ${session?.user?.organizationId || "-"}`} disabled />
                </div>
              </div>
            </CardContent>
            {/* <CardFooter>
              <Button>บันทึกการเปลี่ยนแปลง</Button>
            </CardFooter>
            */}
          </Card>
        </TabsContent>

        {/* 2. Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>รหัสผ่าน</CardTitle>
              <CardDescription>
                เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชี (ต้องมีอย่างน้อย 8 ตัวอักษร)
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onPasswordSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...register("currentPassword")}
                  />
                  {errors.currentPassword && (
                    <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...register("newPassword")}
                  />
                  {errors.newPassword && (
                    <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  เปลี่ยนรหัสผ่าน
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* 3. Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>การแจ้งเตือน</CardTitle>
              <CardDescription>
                กำหนดช่องทางที่คุณต้องการรับข้อมูลข่าวสารจากระบบ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="notify-email" className="flex flex-col space-y-1">
                  <span>Email Notifications</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    รับแจ้งเตือนงานใหม่และการอนุมัติผ่านทางอีเมล
                  </span>
                </Label>
                <Switch
                  id="notify-email"
                  checked={notifyEmail}
                  onCheckedChange={setNotifyEmail}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="notify-line" className="flex flex-col space-y-1">
                  <span>LINE Notifications</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    รับแจ้งเตือนด่วนผ่าน LINE Official Account
                  </span>
                </Label>
                <Switch
                  id="notify-line"
                  checked={notifyLine}
                  onCheckedChange={setNotifyLine}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="digest-mode" className="flex flex-col space-y-1">
                  <span>Digest Mode (รวมแจ้งเตือน)</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    รับสรุปแจ้งเตือนวันละครั้ง แทนการแจ้งเตือนทันที (ลด Spam)
                  </span>
                </Label>
                <Switch
                  id="digest-mode"
                  checked={digestMode}
                  onCheckedChange={setDigestMode}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => toast.success('บันทึกการตั้งค่าแจ้งเตือนแล้ว')}>
                บันทึกการตั้งค่า
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
