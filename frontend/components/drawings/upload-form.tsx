'use client';

import { useForm, FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useCreateDrawing } from '@/hooks/use-drawing';
import {
  useContractDrawingCategories,
  useShopMainCategories,
  useShopSubCategories,
  useProjects,
} from '@/hooks/use-master-data';
import {
  ShopMainCategory,
  ShopSubCategory,
  ContractDrawingCategory,
} from '@/types/master-data';
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { filesApi } from '@/lib/api/files';
import { toast } from 'sonner';
import {
  CreateContractDrawingDto,
} from '@/types/dto/drawing/contract-drawing.dto';
import {
  CreateShopDrawingDto,
} from '@/types/dto/drawing/shop-drawing.dto';
import {
  CreateAsBuiltDrawingDto,
} from '@/types/dto/drawing/asbuilt-drawing.dto';

// Base Schema
const baseSchema = z.object({
  drawingType: z.enum(['CONTRACT', 'SHOP', 'AS_BUILT']),
  projectId: z.string().min(1, 'Project is required'),
  file: z.instanceof(File, { message: 'File is required' }),
});

// Contract Schema
const contractSchema = baseSchema.extend({
  drawingType: z.literal('CONTRACT'),
  contractDrawingNo: z.string().min(1, 'Drawing Number is required'),
  title: z.string().min(3, 'Title is required'),
  volumeId: z.string().optional(), // Select input returns string usually (changed to string for input compatibility)
  volumePage: z
    .string()
    .transform((val) => Number(val))
    .optional(), // Input type number returns string
  mapCatId: z.string().min(1, 'Category is required'),
});

// Shop Schema
const shopSchema = baseSchema.extend({
  drawingType: z.literal('SHOP'),
  drawingNumber: z.string().min(1, 'Drawing Number is required'),
  mainCategoryId: z.string().min(1, 'Main Category is required'),
  subCategoryId: z.string().min(1, 'Sub Category is required'),
  // Revision Fields
  revisionLabel: z.string().default('0'),
  title: z.string().min(3, 'Revision Title is required'),
  legacyDrawingNumber: z.string().optional(),
  description: z.string().optional(),
});

// As Built Schema
const asBuiltSchema = baseSchema.extend({
  drawingType: z.literal('AS_BUILT'),
  drawingNumber: z.string().min(1, 'Drawing Number is required'),
  mainCategoryId: z.string().min(1, 'Main Category is required'),
  subCategoryId: z.string().min(1, 'Sub Category is required'),
  // Revision Fields
  revisionLabel: z.string().default('0'),
  title: z.string().min(1, 'Title is required'),
  legacyDrawingNumber: z.string().optional(),
  description: z.string().optional(),
});

const formSchema = z.discriminatedUnion('drawingType', [contractSchema, shopSchema, asBuiltSchema]);

type DrawingFormData = z.infer<typeof formSchema>;

export function DrawingUploadForm() {
  const router = useRouter();

  // Project list - ADR-019: useProjects returns array directly now
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = useMemo(
    () => (projectsData ?? []) as { id?: number; publicId?: string; projectName: string; projectCode: string }[],
    [projectsData]
  );

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
    resolver: zodResolver(formSchema),
    defaultValues: {
      drawingType: 'CONTRACT',
    } as DrawingFormData,
  });

  // Type-safe error access for discriminated union fields
  const formErrors = errors as Record<string, FieldError | undefined>;

  const drawingType = watch('drawingType');
  const watchedProjectId = watch('projectId');
  const createMutation = useCreateDrawing(drawingType);

  // When project changes, update selectedProjectId for category hooks
  useEffect(() => {
    if (!watchedProjectId) {
      setSelectedProjectId(undefined);
      return;
    }
    // Try to resolve UUID→INT from projects list, or pass UUID directly
    const project = projects.find(
      (p: { id?: number; publicId?: string }) => String(p.publicId ?? p.id) === watchedProjectId
    ) as { id?: number; publicId?: string } | undefined;
    setSelectedProjectId(project?.publicId ?? project?.id ?? watchedProjectId);
  }, [watchedProjectId, projects]);

  const [isUploading, setIsUploading] = useState(false);

  // Two-phase upload (ADR-016): อัปโหลดไฟล์เข้า temp ก่อน แล้วส่ง tempId
  // ใน JSON DTO — ไม่ส่ง FormData ตรงๆ (backend create endpoints รับ @Body() JSON)
  const onSubmit = async (data: DrawingFormData) => {
    setIsUploading(true);
    let attachmentTempIds: string[] | undefined;
    try {
      const uploaded = await filesApi.upload(data.file);
      attachmentTempIds = [uploaded.tempId];
    } catch {
      toast.error('File upload failed');
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    const redirect = { onSuccess: () => router.push('/drawings') };
    if (data.drawingType === 'CONTRACT') {
      const payload: CreateContractDrawingDto = {
        projectId: data.projectId,
        contractDrawingNo: data.contractDrawingNo,
        title: data.title,
        mapCatId: data.mapCatId,
        volumeId: data.volumeId || undefined,
        volumePage: data.volumePage || undefined,
        attachmentTempIds,
      };
      createMutation.mutate(payload, redirect);
    } else if (data.drawingType === 'SHOP') {
      const payload: CreateShopDrawingDto = {
        projectId: data.projectId,
        drawingNumber: data.drawingNumber,
        mainCategoryId: data.mainCategoryId,
        subCategoryId: data.subCategoryId,
        revisionLabel: data.revisionLabel || '0',
        title: data.title,
        legacyDrawingNumber: data.legacyDrawingNumber || undefined,
        description: data.description || undefined,
        attachmentTempIds,
      };
      createMutation.mutate(payload, redirect);
    } else {
      const payload: CreateAsBuiltDrawingDto = {
        projectId: data.projectId,
        drawingNumber: data.drawingNumber,
        mainCategoryId: data.mainCategoryId,
        subCategoryId: data.subCategoryId,
        revisionLabel: data.revisionLabel || '0',
        title: data.title,
        legacyDrawingNumber: data.legacyDrawingNumber || undefined,
        description: data.description || undefined,
        attachmentTempIds,
      };
      createMutation.mutate(payload, redirect);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drawing Information</h3>

        <div className="space-y-4">
          {/* Project Selector */}
          <div>
            <Label>Project *</Label>
            <Select onValueChange={(v) => setValue('projectId', v)}>
              <SelectTrigger>
                {isLoadingProjects ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue placeholder="Select Project" />
                )}
              </SelectTrigger>
              <SelectContent>
                {projects.map((project: { publicId?: string; id?: number; projectCode: string; projectName: string }) => {
                const projectValue = String(project.publicId ?? project.id ?? '');
                return (
                  <SelectItem key={projectValue} value={projectValue}>
                    {project.projectCode} - {project.projectName}
                  </SelectItem>
                );
              })}
              </SelectContent>
            </Select>
            {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
          </div>

          <div>
            <Label>Drawing Type *</Label>
            <Select
              onValueChange={(v) => {
                setValue('drawingType', v as DrawingFormData['drawingType']);
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
                  <Input {...register('contractDrawingNo')} placeholder="e.g. CD-001" />
                  {formErrors.contractDrawingNo && (
                    <p className="text-sm text-destructive">{formErrors.contractDrawingNo.message}</p>
                  )}
                </div>
                <div>
                  <Label>Title *</Label>
                  <Input {...register('title')} placeholder="Drawing Title" />
                  {formErrors.title && <p className="text-sm text-destructive">{formErrors.title.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <Select onValueChange={(v) => setValue('mapCatId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractCategories?.map((c: ContractDrawingCategory) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.catName || c.catCode || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.mapCatId && <p className="text-sm text-destructive">{formErrors.mapCatId.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Volume ID</Label>
                    <Input {...register('volumeId')} placeholder="Vol. 1" />
                  </div>
                  <div>
                    <Label>Page No.</Label>
                    <Input {...register('volumePage')} type="number" placeholder="1" />
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
                  <Input {...register('drawingNumber')} placeholder="e.g. SD-101" />
                  {formErrors.drawingNumber && (
                    <p className="text-sm text-destructive">{formErrors.drawingNumber.message}</p>
                  )}
                </div>
                <div>
                  <Label>Legacy Number</Label>
                  <Input {...register('legacyDrawingNumber')} placeholder="Legacy No." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Main Category *</Label>
                  <Select
                    onValueChange={(v) => {
                      setValue('mainCategoryId', v);
                      setSelectedShopMainCat(v ? Number(v) : undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Main Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopMainCats?.map((c: ShopMainCategory) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.mainCategoryName || c.mainCategoryCode || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.mainCategoryId && (
                    <p className="text-sm text-destructive">{formErrors.mainCategoryId.message}</p>
                  )}
                </div>
                <div>
                  <Label>Sub Category *</Label>
                  <Select onValueChange={(v) => setValue('subCategoryId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Sub Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopSubCats?.map((c: ShopSubCategory) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.subCategoryName || c.subCategoryCode || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.subCategoryId && (
                    <p className="text-sm text-destructive">{formErrors.subCategoryId.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Revision Title *</Label>
                <Input {...register('title')} placeholder="Current Revision Title" />
                {formErrors.title && <p className="text-sm text-destructive">{formErrors.title.message}</p>}
              </div>

              <div>
                <Label>Description</Label>
                <Textarea {...register('description')} />
              </div>
            </>
          )}

          {/* AS BUILT FIELDS */}
          {drawingType === 'AS_BUILT' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Drawing No *</Label>
                  <Input {...register('drawingNumber')} placeholder="e.g. AB-101" />
                  {formErrors.drawingNumber && (
                    <p className="text-sm text-destructive">{formErrors.drawingNumber.message}</p>
                  )}
                </div>
                <div>
                  <Label>Legacy Number</Label>
                  <Input {...register('legacyDrawingNumber')} placeholder="Legacy No." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Main Category *</Label>
                  <Select
                    onValueChange={(v) => {
                      setValue('mainCategoryId', v);
                      setSelectedShopMainCat(v ? Number(v) : undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Main Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopMainCats?.map((c: ShopMainCategory) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.mainCategoryName || c.mainCategoryCode || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.mainCategoryId && (
                    <p className="text-sm text-destructive">{formErrors.mainCategoryId.message}</p>
                  )}
                </div>
                <div>
                  <Label>Sub Category *</Label>
                  <Select onValueChange={(v) => setValue('subCategoryId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Sub Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopSubCats?.map((c: ShopSubCategory) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.subCategoryName || c.subCategoryCode || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.subCategoryId && (
                    <p className="text-sm text-destructive">{formErrors.subCategoryId.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Title *</Label>
                <Input {...register('title')} placeholder="Drawing Title" />
                {formErrors.title && <p className="text-sm text-destructive">{formErrors.title.message}</p>}
              </div>
              <div>
                <Label>Description</Label>
                <Textarea {...register('description')} />
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
                if (file) setValue('file', file);
              }}
            />
            {errors.file && <p className="text-sm text-destructive mt-1">{errors.file.message}</p>}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending || isUploading}>
          {(createMutation.isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Upload Drawing
        </Button>
      </div>
    </form>
  );
}
