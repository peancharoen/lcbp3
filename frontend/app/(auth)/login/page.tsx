// File: app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// กำหนด Schema สำหรับตรวจสอบข้อมูลฟอร์ม
const loginSchema = z.object({
  username: z.string().min(1, "กรุณาระบุชื่อผู้ใช้งาน"),
  password: z.string().min(1, "กรุณาระบุรหัสผ่าน"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Removed local errorMessage state in favor of toast

  // ตั้งค่า React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // ฟังก์ชันเมื่อกด Submit
  async function onSubmit(data: LoginValues) {
    setIsLoading(true);

    try {
      // เรียกใช้ NextAuth signIn (Credential Provider)
      const result = await signIn("credentials", {
        username: data.username,
        password: data.password,
        redirect: false, // เราจะจัดการ Redirect เอง
      });

      if (result?.error) {
        // กรณี Login ไม่สำเร็จ
        console.error("Login failed:", result.error);
        toast.error("เข้าสู่ระบบไม่สำเร็จ", {
          description: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่",
        });
        return;
      }

      // Login สำเร็จ -> ไปหน้า Dashboard
      toast.success("เข้าสู่ระบบสำเร็จ", {
        description: "กำลังพาท่านไปยังหน้า Dashboard...",
      });
      router.push("/dashboard");
      router.refresh(); // Refresh เพื่อให้ Server Component รับรู้ Session ใหม่
    } catch (error) {
      console.error("Login error:", error);
      toast.error("เกิดข้อผิดพลาด", {
        description: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold text-primary">
          LCBP3 DMS
        </CardTitle>
        <CardDescription>
          กรอกชื่อผู้ใช้งานและรหัสผ่านเพื่อเข้าสู่ระบบ
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          {/* Username Field */}
          <div className="grid gap-2">
            <Label htmlFor="username">ชื่อผู้ใช้งาน</Label>
            <Input
              id="username"
              placeholder="username"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              disabled={isLoading}
              className={errors.username ? "border-destructive" : ""}
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="grid gap-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Input
                id="password"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isLoading}
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
                {...register("password")}
              />
              {/* ปุ่ม Show/Hide Password */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            เข้าสู่ระบบ
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
