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
import { useContractDrawingCategories, useShopMainCategories, useShopSubCategories, useProjects } from "@/hooks/use-master-data";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Base Schema
const baseSchema = z.object({
  drawingType: z.enum(["CONTRACT", "SHOP", "AS_BUILT"]),
  projectId: z.string().min(1, "Project is required"),
  file: z.instanceof(File, { message: "File is required" }),
});

// Contract Schema
const contractSchema = baseSchema.extend({
  drawingType: z.literal("CONTRACT"),
  contractDrawingNo: z.string().min(1, "Drawing Number is required"),
  title: z.string().min(3, "Title is required"),
  volumeId: z.string().optional(), // Select input returns string usually (changed to string for input compatibility)
  volumePage: z.string().transform(val => parseInt(val, 10)).optional(), // Input type number returns string
  mapCatId: z.string().min(1, "Category is required"),
});

// Shop Schema
const shopSchema = baseSchema.extend({
  drawingType: z.literal("SHOP"),
  drawingNumber: z.string().min(1, "Drawing Number is required"),
  mainCategoryId: z.string().min(1, "Main Category is required"),
  subCategoryId: z.string().min(1, "Sub Category is required"),
  // Revision Fields
  revisionLabel: z.string().default("0"),
  title: z.string().min(3, "Revision Title is required"),
  legacyDrawingNumber: z.string().optional(),
  description: z.string().optional(),
});

// As Built Schema
const asBuiltSchema = baseSchema.extend({
  drawingType: z.literal("AS_BUILT"),
  drawingNumber: z.string().min(1, "Drawing Number is required"),
  mainCategoryId: z.string().min(1, "Main Category is required"),
  subCategoryId: z.string().min(1, "Sub Category is required"),
  // Revision Fields
  revisionLabel: z.string().default("0"),
  title: z.string().min(1, "Title is required"),
  legacyDrawingNumber: z.string().optional(),
  description: z.string().optional(),
});

const formSchema = z.discriminatedUnion("drawingType", [
  contractSchema,
  shopSchema,
  asBuiltSchema,
]);

type DrawingFormData = z.infer<typeof formSchema>;

export function DrawingUploadForm() {
  const router = useRouter();

  // Project list
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  // Selected project for category fetching
  const [selectedProjectId, setSelectedProjectId] = useState<number | string | undefined>(undefined);

  // Hooks — categories depend on selected project
  const { data: contractCategories } = useContractDrawingCategories(selectedProjectId);
  const { data: shopMainCats } = useShopMainCategories(selectedProjectId as number);

  const [selectedShopMainCat, setSelectedShopMainCat] = useState<number | undefined>();
  const { data: shopSubCats } = useShopSubCategories(selectedProjectId as number, selectedShopMainCat);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DrawingFormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      drawingType: "CONTRACT",
    }
  });

  const drawingType = watch("drawingType");
  const watchedProjectId = watch("projectId");
  const createMutation = useCreateDrawing(drawingType);

  // When project changes, update selectedProjectId for category hooks
  useEffect(() => {
    if (!watchedProjectId) {
      setSelectedProjectId(undefined);
      return;
    }
    // Try to resolve UUID→INT from projects list, or pass UUID directly
    const project = projects.find((p: { id: string; uuid?: string }) => p.id === watchedProjectId || p.uuid === watchedProjectId) as { id: string; uuid?: string } | undefined;
    setSelectedProjectId(project?.id ?? watchedProjectId);
  }, [watchedProjectId, projects]);

  const onSubmit = (data: DrawingFormData) => {
    const formData = new FormData();

    // Common fields
    formData.append('projectId', String(data.projectId));
    formData.append('file', data.file);

    if (data.drawingType === 'CONTRACT') {
      formData.append('contractDrawingNo', data.contractDrawingNo);
      formData.append('title', data.title);
      formData.append('mapCatId', data.mapCatId);
      if (data.volumeId) formData.append('volumeId', data.volumeId);
      if (data.volumePage) formData.append('volumePage', String(data.volumePage));
    } else if (data.drawingType === 'SHOP') {
      formData.append('drawingNumber', data.drawingNumber);
      formData.append('mainCategoryId', data.mainCategoryId);
      formData.append('subCategoryId', data.subCategoryId);
      formData.append('revisionLabel', data.revisionLabel || '0');
      formData.append('title', data.title); // Revision Title
      if (data.legacyDrawingNumber) formData.append('legacyDrawingNumber', data.legacyDrawingNumber);
      if (data.description) formData.append('description', data.description);
      // Date default to now
    } else if (data.drawingType === 'AS_BUILT') {
      formData.append('drawingNumber', data.drawingNumber);
      formData.append('mainCategoryId', data.mainCategoryId);
      formData.append('subCategoryId', data.subCategoryId);
      formData.append('revisionLabel', data.revisionLabel || '0');
      formData.append('title', data.title);
      if (data.legacyDrawingNumber) formData.append('legacyDrawingNumber', data.legacyDrawingNumber);
      if (data.description) formData.append('description', data.description);
    }

    createMutation.mutate(formData as any, {
      onSuccess: () => {
        router.push("/drawings");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drawing Information</h3>

        <div className="space-y-4">
          {/* Project Selector */}
          <div>
            <Label>Project *</Label>
            <Select
              onValueChange={(v) => setValue("projectId", v)}
            >
              <SelectTrigger>
                {isLoadingProjects ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue placeholder="Select Project" />
                )}
              </SelectTrigger>
              <SelectContent>
                {projects.map((project: { id: string; projectName: string; projectCode: string }) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectCode} - {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectId && (
              <p className="text-sm text-destructive">{errors.projectId.message}</p>
            )}
          </div>

          <div>
            <Label>Drawing Type *</Label>
            <Select
              onValueChange={(v) => {
                setValue("drawingType", v as any);
                // Reset errors or fields if needed
              }}
              defaultValue="CONTRACT"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRACT">Contract Drawing</SelectItem>
                <SelectItem value="SHOP">Shop Drawing</SelectItem>
                <SelectItem value="AS_BUILT">As Built Drawing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CONTRACT FIELDS */}
          {drawingType === 'CONTRACT' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Contract Drawing No *</Label>
                  <Input {...register("contractDrawingNo")} placeholder="e.g. CD-001" />
                  {(errors as any).contractDrawingNo && (
                    <p className="text-sm text-destructive">{(errors as any).contractDrawingNo.message}</p>
                  )}
                </div>
                <div>
                   <Label>Title *</Label>
                   <Input {...register("title")} placeholder="Drawing Title" />
                   {(errors as any).title && (
                    <p className="text-sm text-destructive">{(errors as any).title.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label>Category *</Label>
                    <Select onValueChange={(v) => setValue("mapCatId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractCategories?.map((c: any) => (
                           <SelectItem key={c.id} value={String(c.id)}>{c.catName || c.catCode || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(errors as any).mapCatId && (
                      <p className="text-sm text-destructive">{(errors as any).mapCatId.message}</p>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Volume ID</Label>
                      <Input {...register("volumeId")} placeholder="Vol. 1" />
                    </div>
                    <div>
                      <Label>Page No.</Label>
                      <Input {...register("volumePage")} type="number" placeholder="1" />
                    </div>
                 </div>
              </div>
            </>
          )}

          {/* SHOP FIELDS */}
          {drawingType === 'SHOP' && (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Shop Drawing No *</Label>
                    <Input {...register("drawingNumber")} placeholder="e.g. SD-101" />
                    {(errors as any).drawingNumber && (
                       <p className="text-sm text-destructive">{(errors as any).drawingNumber.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Legacy Number</Label>
                    <Input {...register("legacyDrawingNumber")} placeholder="Legacy No." />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Main Category *</Label>
                    <Select onValueChange={(v) => {
                       setValue("mainCategoryId", v);
                      setSelectedShopMainCat(v ? parseInt(v) : undefined);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Main Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {shopMainCats?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.mainCategoryName || c.mainCategoryCode || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {(errors as any).mainCategoryId && (
                       <p className="text-sm text-destructive">{(errors as any).mainCategoryId.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Sub Category *</Label>
                    <Select onValueChange={(v) => setValue("subCategoryId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Sub Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {shopSubCats?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.subCategoryName || c.subCategoryCode || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {(errors as any).subCategoryId && (
                       <p className="text-sm text-destructive">{(errors as any).subCategoryId.message}</p>
                    )}
                  </div>
               </div>

               <div>
                 <Label>Revision Title *</Label>
                 <Input {...register("title")} placeholder="Current Revision Title" />
                 {(errors as any).title && (
                    <p className="text-sm text-destructive">{(errors as any).title.message}</p>
                 )}
               </div>

               <div>
                 <Label>Description</Label>
                 <Textarea {...register("description")} />
               </div>
             </>
          )}

          {/* AS BUILT FIELDS */}
          {drawingType === 'AS_BUILT' && (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Drawing No *</Label>
                    <Input {...register("drawingNumber")} placeholder="e.g. AB-101" />
                    {(errors as any).drawingNumber && (
                       <p className="text-sm text-destructive">{(errors as any).drawingNumber.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Legacy Number</Label>
                    <Input {...register("legacyDrawingNumber")} placeholder="Legacy No." />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Main Category *</Label>
                    <Select onValueChange={(v) => {
                       setValue("mainCategoryId", v);
                      setSelectedShopMainCat(v ? parseInt(v) : undefined);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Main Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {shopMainCats?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.mainCategoryName || c.mainCategoryCode || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {(errors as any).mainCategoryId && (
                       <p className="text-sm text-destructive">{(errors as any).mainCategoryId.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Sub Category *</Label>
                    <Select onValueChange={(v) => setValue("subCategoryId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Sub Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {shopSubCats?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.subCategoryName || c.subCategoryCode || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {(errors as any).subCategoryId && (
                       <p className="text-sm text-destructive">{(errors as any).subCategoryId.message}</p>
                    )}
                  </div>
               </div>

               <div>
                 <Label>Title *</Label>
                 <Input {...register("title")} placeholder="Drawing Title" />
                 {(errors as any).title && (
                    <p className="text-sm text-destructive">{(errors as any).title.message}</p>
                 )}
               </div>
               <div>
                 <Label>Description</Label>
                 <Textarea {...register("description")} />
               </div>
             </>
          )}

          <div className="mt-4">
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
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload Drawing
        </Button>
      </div>
    </form>
  );
}
