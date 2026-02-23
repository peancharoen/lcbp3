// File: app/(dashboard)/projects/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, ChevronLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

// 1. กำหนด Schema สำหรับตรวจสอบข้อมูล (Validation)
// อ้างอิงจาก Data Dictionary ตาราง projects
const projectSchema = z.object({
  projectCode: z
    .string()
    .min(1, "กรุณาระบุรหัสโครงการ")
    .max(50, "รหัสโครงการต้องไม่เกิน 50 ตัวอักษร")
    .regex(/^[A-Z0-9-]+$/, "รหัสโครงการควรประกอบด้วยตัวอักษรภาษาอังกฤษตัวใหญ่ ตัวเลข หรือขีด (-) เท่านั้น"),
  projectName: z
    .string()
    .min(1, "กรุณาระบุชื่อโครงการ")
    .max(255, "ชื่อโครงการต้องไม่เกิน 255 ตัวอักษร"),
  description: z.string().optional(),
  status: z.enum(["Active", "Inactive", "On Hold"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ProjectValues = z.infer<typeof projectSchema>;

export default function CreateProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 2. ตั้งค่า React Hook Form
  const {
    register,
    handleSubmit,
    setValue, // ใช้สำหรับ manual set value (เช่น Select)
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectCode: "",
      projectName: "",
      status: "Active",
    },
  });

  // 3. ฟังก์ชัน Submit
  async function onSubmit(data: ProjectValues) {
    setIsLoading(true);
    try {
      // เรียก API สร้างโครงการ (Mockup URL)
      // ใน Phase หลัง Backend จะเตรียม Endpoint POST /projects ไว้ให้
      console.log("Submitting project data:", data);

      // จำลองการส่งข้อมูล (Artificial Delay)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // await apiClient.post("/projects", data);

      toast.success('สร้างโครงการสำเร็จ');
      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการสร้างโครงการ');
      console.error('[CreateProjectPage]', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create New Project</h2>
          <p className="text-muted-foreground">
            สร้างโครงการใหม่เพื่อเริ่มบริหารจัดการสัญญาและเอกสาร
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลโครงการ</CardTitle>
            <CardDescription>
              กรอกรายละเอียดสำคัญของโครงการ รหัสโครงการควรไม่ซ้ำกับที่มีอยู่
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Project Code */}
            <div className="space-y-2">
              <Label htmlFor="project_code" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                รหัสโครงการ (Project Code)
              </Label>
              <Input
                id="project_code"
                placeholder="e.g. LCBP3-C1"
                className={errors.projectCode ? "border-destructive" : ""}
                {...register("projectCode")}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("projectCode").onChange(e);
                }}
              />
              {errors.projectCode ? (
                <p className="text-xs text-destructive">{errors.projectCode.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ใช้ภาษาอังกฤษตัวพิมพ์ใหญ่ ตัวเลข และขีด (-) เท่านั้น
                </p>
              )}
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="project_name" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                ชื่อโครงการ (Project Name)
              </Label>
              <Input
                id="project_name"
                placeholder="ระบุชื่อโครงการฉบับเต็ม..."
                className={errors.projectName ? "border-destructive" : ""}
                {...register("projectName")}
              />
              {errors.projectName && (
                <p className="text-xs text-destructive">{errors.projectName.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">รายละเอียดเพิ่มเติม</Label>
              <Textarea
                id="description"
                placeholder="คำอธิบายเกี่ยวกับขอบเขตงานของโครงการ..."
                className="min-h-[100px]"
                {...register("description")}
              />
            </div>

            {/* Dates Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">วันที่เริ่มต้นสัญญา</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">วันที่สิ้นสุดสัญญา</Label>
                <Input
                  id="end_date"
                  type="date"
                  {...register("endDate")}
                />
              </div>
            </div>

            {/* Status Select */}
            <div className="space-y-2">
              <Label htmlFor="status">สถานะโครงการ</Label>
              {/* เนื่องจาก Select ของ Shadcn เป็น Custom UI
                เราต้องใช้ onValueChange เพื่อเชื่อมกับ React Hook Form
              */}
              <Select
                onValueChange={(value: 'Active' | 'Inactive' | 'On Hold') => setValue('status', value)}
                defaultValue="Active"
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active (กำลังดำเนินงาน)</SelectItem>
                  <SelectItem value="On Hold">On Hold (ระงับชั่วคราว)</SelectItem>
                  <SelectItem value="Inactive">Inactive (ปิดโครงการ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t p-4 bg-muted/50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              บันทึกข้อมูล
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
