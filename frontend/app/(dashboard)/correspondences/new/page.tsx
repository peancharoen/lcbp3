// File: app/(dashboard)/correspondences/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, Save, Loader2, Send } from "lucide-react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileUpload } from "@/components/forms/file-upload";
import { cn } from "@/lib/utils";

// --- Schema Definition ---
const correspondenceSchema = z.object({
  projectId: z.string().min(1, "กรุณาเลือกโครงการ"),
  originatorId: z.string().min(1, "กรุณาเลือกองค์กรผู้ส่ง"),
  type: z.string().min(1, "กรุณาเลือกประเภทเอกสาร"),
  discipline: z.string().optional(), // สำหรับ RFA/Letter ที่มีสาขา
  subType: z.string().optional(), // สำหรับแบ่งประเภทย่อย
  recipientId: z.string().min(1, "กรุณาเลือกผู้รับ (To)"),
  subject: z.string().min(5, "หัวข้อต้องยาวอย่างน้อย 5 ตัวอักษร"),
  message: z.string().optional(),
  replyRequiredBy: z.date().optional(),
});

type FormValues = z.infer<typeof correspondenceSchema>;

// --- Mock Data for Dropdowns ---
const projects = [
  { id: "1", code: "LCBP3-C1", name: "งานก่อสร้างงานทางทะเล (ส่วนที่ 1)" },
  { id: "2", code: "LCBP3-C2", name: "งานก่อสร้างอาคาร (ส่วนที่ 2)" },
];

const organizations = [
  { id: "1", code: "PAT", name: "การท่าเรือฯ (Owner)" },
  { id: "2", code: "CSC", name: "ที่ปรึกษาคุมงาน (Consult)" },
  { id: "3", code: "CNNC", name: "ผู้รับเหมา C1" },
];

const docTypes = [
  { id: "LET", name: "Letter (จดหมาย)" },
  { id: "MEM", name: "Memo (บันทึกข้อความ)" },
  { id: "RFA", name: "RFA (ขออนุมัติ)" },
  { id: "RFI", name: "RFI (ขอข้อมูล)" },
];

const disciplines = [
  { id: "GEN", name: "General (ทั่วไป)" },
  { id: "STR", name: "Structural (โครงสร้าง)" },
  { id: "ARC", name: "Architectural (สถาปัตยกรรม)" },
  { id: "MEP", name: "MEP (งานระบบ)" },
];

export default function CreateCorrespondencePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: {
      originatorId: "3", // Default เป็น Org ของ User (Mock: CNNC)
    },
  });

  // Watch values to update dynamic parts
  const selectedProject = watch("projectId");
  const selectedType = watch("type");
  const selectedDiscipline = watch("discipline");
  
  // Logic จำลองการ Preview เลขที่เอกสาร (Document Numbering)
  const getPreviewNumber = () => {
    if (!selectedProject || !selectedType) return "---";
    const proj = projects.find(p => p.id === selectedProject)?.code || "PROJ";
    const type = selectedType;
    const disc = selectedDiscipline ? `-${selectedDiscipline}` : "";
    return `${proj}-${type}${disc}-0001 (Draft)`;
  };

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      console.log("Form Data:", data);
      console.log("Files:", files);
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      alert("บันทึกเอกสารเรียบร้อยแล้ว");
      router.push("/correspondences");
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create Correspondence</h2>
          <p className="text-muted-foreground">
            สร้างเอกสารใหม่เพื่อส่งออกไปยังหน่วยงานอื่น
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Section 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลเบื้องต้น (Basic Information)</CardTitle>
            <CardDescription>
              ระบุโครงการและประเภทของเอกสาร เลขที่เอกสารจะถูกสร้างอัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {/* Project Select */}
            <div className="space-y-2">
              <Label className="after:content-['*'] after:text-red-500">โครงการ (Project)</Label>
              <Select onValueChange={(val) => setValue("projectId", val)}>
                <SelectTrigger className={errors.projectId ? "border-destructive" : ""}>
                  <SelectValue placeholder="เลือกโครงการ..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message}</p>}
            </div>

            {/* Document Type Select */}
            <div className="space-y-2">
              <Label className="after:content-['*'] after:text-red-500">ประเภทเอกสาร (Type)</Label>
              <Select onValueChange={(val) => setValue("type", val)}>
                <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                  <SelectValue placeholder="เลือกประเภท..." />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>

            {/* Discipline (Conditional) */}
            <div className="space-y-2">
              <Label>สาขางาน (Discipline)</Label>
              <Select onValueChange={(val) => setValue("discipline", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="ระบุสาขา (ถ้ามี)..." />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">จำเป็นสำหรับ RFA/RFI เพื่อการรันเลขที่ถูกต้อง</p>
            </div>

            {/* Originator (Sender) */}
            <div className="space-y-2">
              <Label className="after:content-['*'] after:text-red-500">ผู้ส่ง (From)</Label>
              <Select defaultValue="3" onValueChange={(val) => setValue("originatorId", val)} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Select Originator" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document Number Preview */}
            <div className="md:col-span-2 p-4 bg-muted/30 rounded-lg border border-dashed flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Preview Document No:</span>
              <span className="font-mono text-lg font-bold text-primary">{getPreviewNumber()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Details & Recipients */}
        <Card>
          <CardHeader>
            <CardTitle>รายละเอียดและผู้รับ (Details & Recipients)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Recipient */}
            <div className="space-y-2">
              <Label className="after:content-['*'] after:text-red-500">ผู้รับ (To)</Label>
              <Select onValueChange={(val) => setValue("recipientId", val)}>
                <SelectTrigger className={errors.recipientId ? "border-destructive" : ""}>
                  <SelectValue placeholder="เลือกหน่วยงานผู้รับ..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.filter(o => o.id !== "3").map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.recipientId && <p className="text-xs text-destructive">{errors.recipientId.message}</p>}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="after:content-['*'] after:text-red-500">หัวข้อเรื่อง (Subject)</Label>
              <Input 
                placeholder="ระบุหัวข้อเอกสาร..." 
                className={errors.subject ? "border-destructive" : ""}
                {...register("subject")} 
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>

            {/* Message/Body */}
            <div className="space-y-2">
              <Label>รายละเอียด (Message)</Label>
              <Textarea 
                placeholder="พิมพ์รายละเอียดเพิ่มเติม..." 
                className="min-h-[120px]"
                {...register("message")}
              />
            </div>

            {/* Reply Required Date */}
            <div className="flex flex-col space-y-2">
              <Label>วันที่ต้องการคำตอบ (Reply Required By)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] pl-3 text-left font-normal",
                      !watch("replyRequiredBy") && "text-muted-foreground"
                    )}
                  >
                    {watch("replyRequiredBy") ? (
                      format(watch("replyRequiredBy")!, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("replyRequiredBy")}
                    onSelect={(date) => setValue("replyRequiredBy", date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

          </CardContent>
        </Card>

        {/* Section 3: Attachments */}
        <Card>
          <CardHeader>
            <CardTitle>เอกสารแนบ (Attachments)</CardTitle>
            <CardDescription>
              รองรับไฟล์ PDF, DWG, Office (สูงสุด 50MB ต่อไฟล์)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload 
              onFilesChange={setFiles} 
              maxFiles={10}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip,.jpg,.png"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" type="button" onClick={() => router.back()} disabled={isLoading}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isLoading} className="min-w-[120px]">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save as Draft
              </>
            )}
          </Button>
          <Button type="submit" disabled={isLoading} className="min-w-[120px] bg-green-600 hover:bg-green-700">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit
          </Button>
        </div>

      </form>
    </div>
  );
}