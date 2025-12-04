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
import { drawingApi } from "@/lib/api/drawings";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const drawingSchema = z.object({
  drawing_type: z.enum(["CONTRACT", "SHOP"], { required_error: "Type is required" }),
  drawing_number: z.string().min(1, "Drawing Number is required"),
  title: z.string().min(5, "Title must be at least 5 characters"),
  discipline_id: z.number({ required_error: "Discipline is required" }),
  sheet_number: z.string().min(1, "Sheet Number is required"),
  scale: z.string().optional(),
  file: z.instanceof(File, { message: "File is required" }),
});

type DrawingFormData = z.infer<typeof drawingSchema>;

export function DrawingUploadForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DrawingFormData>({
    resolver: zodResolver(drawingSchema),
  });

  const onSubmit = async (data: DrawingFormData) => {
    setIsSubmitting(true);
    try {
      await drawingApi.create(data as any);
      router.push("/drawings");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to upload drawing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drawing Information</h3>

        <div className="space-y-4">
          <div>
            <Label>Drawing Type *</Label>
            <Select onValueChange={(v) => setValue("drawing_type", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRACT">Contract Drawing</SelectItem>
                <SelectItem value="SHOP">Shop Drawing</SelectItem>
              </SelectContent>
            </Select>
            {errors.drawing_type && (
              <p className="text-sm text-destructive mt-1">{errors.drawing_type.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="drawing_number">Drawing Number *</Label>
              <Input id="drawing_number" {...register("drawing_number")} placeholder="e.g. A-101" />
              {errors.drawing_number && (
                <p className="text-sm text-destructive mt-1">{errors.drawing_number.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="sheet_number">Sheet Number *</Label>
              <Input id="sheet_number" {...register("sheet_number")} placeholder="e.g. 01" />
              {errors.sheet_number && (
                <p className="text-sm text-destructive mt-1">{errors.sheet_number.message}</p>
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
                onValueChange={(v) => setValue("discipline_id", parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Discipline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">STR - Structure</SelectItem>
                  <SelectItem value="2">ARC - Architecture</SelectItem>
                  <SelectItem value="3">ELE - Electrical</SelectItem>
                  <SelectItem value="4">MEC - Mechanical</SelectItem>
                </SelectContent>
              </Select>
              {errors.discipline_id && (
                <p className="text-sm text-destructive mt-1">{errors.discipline_id.message}</p>
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload Drawing
        </Button>
      </div>
    </form>
  );
}
