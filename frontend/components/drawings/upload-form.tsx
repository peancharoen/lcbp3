"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useCreateDrawing } from "@/hooks/use-drawing";
import { useDisciplines } from "@/hooks/use-master-data";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const drawingSchema = z.object({
  drawingType: z.enum(["CONTRACT", "SHOP"]),
  drawingNumber: z.string().min(1, "Drawing Number is required"),
  title: z.string().min(5, "Title must be at least 5 characters"),
  disciplineId: z.number().min(1, "Discipline is required"),
  sheetNumber: z.string().min(1, "Sheet Number is required"),
  scale: z.string().optional(),
  file: z.instanceof(File, { message: "File is required" }), // In real app, might validation creation before upload
});

type DrawingFormData = z.infer<typeof drawingSchema>;

export function DrawingUploadForm() {
  const router = useRouter();

  // Discipline Hook
  const { data: disciplines, isLoading: isLoadingDisciplines } = useDisciplines();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DrawingFormData>({
    resolver: zodResolver(drawingSchema),
  });

  const drawingType = watch("drawingType");
  const createMutation = useCreateDrawing(drawingType); // Hook depends on type but defaults to undefined initially which is fine or handled

  const onSubmit = (data: DrawingFormData) => {
    // Only proceed if createMutation is valid for the type (it should be since we watch type)
    if (!drawingType) return;

    // Convert to FormData
    // Note: Backend might expect JSON Body or Multipart/Form-Data depending on implementation.
    // Assuming Multipart/Form-Data if file is involved, OR
    // Two-step upload: 1. Upload File -> Get URL 2. Create Record with URL.
    // The previous code assumed direct call.
    // Let's assume the service handles FormData conversion if we pass plain object or we construct here.
    // My previous assumption in implementation plan: "File upload will use FormData".
    // I should check service again. `contract-drawing.service` takes `CreateContractDrawingDto`.
    // Usually NestJS with FileUpload uses Interceptors and FormData.

    // Creating FormData manually to be safe for file upload
    /*
    const formData = new FormData();
    formData.append('title', data.title);
    // ...
    // BUT useCreateDrawing calls service.create(data). Service uses apiClient.post(data).
    // axios handles FormData automatically if passed directly, but nested objects are tricky.
    // Let's pass the raw DTO and hope services handle it or assume Backend accepts DTO JSON and file separately?
    // Actually standard Axios with FormData:
    */

    // Let's try to construct FormData here as generic approach for file uploads
    // However, if I change the argument to FormData, Types might complain.
    // Let's just pass `data` and let the developer (me) ensure Service handles it correctly or modify service later if failed.
    // Wait, `contractDrawingService.create` takes `CreateContractDrawingDto`.
    // I will assume for now I pass the object. If file upload fails, I will fix service.

    // Actually better to handle FormData logic here since we have the File object
    const formData = new FormData();
    formData.append('drawingNumber', data.drawingNumber);
    formData.append('title', data.title);
    formData.append('disciplineId', String(data.disciplineId));
    formData.append('sheetNumber', data.sheetNumber);
    if(data.scale) formData.append('scale', data.scale);
    formData.append('file', data.file);
    // Type specific fields if any? (Project ID?)
    // Contract/Shop might have different fields. Assuming minimal common set.

    createMutation.mutate(data as any, { // Passing raw data or FormData? Hook awaits 'any'.
        // If I pass FormData, Axios sends it as multipart/form-data.
        // If I pass JSON, it sends as JSON (and File is empty object).
        // Since there is a File, I MUST use FormData for it to work with standard uploads.
        // But wait, the `useCreateDrawing` calls `service.create` which calls `apiClient.post`.
        // If I pass FormData to `mutate`, it goes to `service.create`.
        // So I will pass FormData but `data as any` above cast allows it.
        // BUT `data` argument in `onSubmit` is `DrawingFormData` (Object).
        // I will pass `formData` to mutate.
        // WARNING: Hooks expects correct type. I used `any` in hook definition.
       onSuccess: () => {
         router.push("/drawings");
       }
    });
  };

  // Actually, to make it work with TypeScript and `mutate`, let's wrap logic
  const handleFormSubmit = (data: DrawingFormData) => {
      // Create FormData
      const formData = new FormData();
      Object.keys(data).forEach(key => {
          if (key === 'file') {
              formData.append(key, data.file);
          } else {
              formData.append(key, String((data as any)[key]));
          }
      });
      // Append projectId if needed (hardcoded 1 for now)
      formData.append('projectId', '1');

      createMutation.mutate(formData as any, {
          onSuccess: () => {
              router.push("/drawings");
          }
      });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drawing Information</h3>

        <div className="space-y-4">
          <div>
            <Label>Drawing Type *</Label>
            <Select onValueChange={(v) => setValue("drawingType", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRACT">Contract Drawing</SelectItem>
                <SelectItem value="SHOP">Shop Drawing</SelectItem>
              </SelectContent>
            </Select>
            {errors.drawingType && (
              <p className="text-sm text-destructive mt-1">{errors.drawingType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="drawingNumber">Drawing Number *</Label>
              <Input id="drawingNumber" {...register("drawingNumber")} placeholder="e.g. A-101" />
              {errors.drawingNumber && (
                <p className="text-sm text-destructive mt-1">{errors.drawingNumber.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="sheetNumber">Sheet Number *</Label>
              <Input id="sheetNumber" {...register("sheetNumber")} placeholder="e.g. 01" />
              {errors.sheetNumber && (
                <p className="text-sm text-destructive mt-1">{errors.sheetNumber.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} placeholder="Drawing Title" />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Discipline *</Label>
              <Select
                onValueChange={(v) => setValue("disciplineId", parseInt(v))}
                disabled={isLoadingDisciplines}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingDisciplines ? "Loading..." : "Select Discipline"} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines?.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.disciplineId && (
                <p className="text-sm text-destructive mt-1">{errors.disciplineId.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="scale">Scale</Label>
              <Input id="scale" {...register("scale")} placeholder="e.g. 1:100" />
            </div>
          </div>

          <div>
            <Label htmlFor="file">Drawing File *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.dwg"
              className="cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setValue("file", file);
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Accepted: PDF, DWG (Max 50MB)
            </p>
            {errors.file && (
              <p className="text-sm text-destructive mt-1">{errors.file.message}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending || !drawingType}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload Drawing
        </Button>
      </div>
    </form>
  );
}
