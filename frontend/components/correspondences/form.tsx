"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/common/file-upload";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCreateCorrespondence, useUpdateCorrespondence } from "@/hooks/use-correspondence";
import { Organization } from "@/types/organization";
import { useOrganizations, useProjects, useCorrespondenceTypes, useDisciplines } from "@/hooks/use-master-data";
import { CreateCorrespondenceDto } from "@/types/dto/correspondence/create-correspondence.dto";

// Updated Zod Schema with all required fields
const correspondenceSchema = z.object({
  projectId: z.number().min(1, "Please select a Project"),
  documentTypeId: z.number().min(1, "Please select a Document Type"),
  disciplineId: z.number().optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  fromOrganizationId: z.number().min(1, "Please select From Organization"),
  toOrganizationId: z.number().min(1, "Please select To Organization"),
  importance: z.enum(["NORMAL", "HIGH", "URGENT"]),
  attachments: z.array(z.instanceof(File)).optional(),
});

type FormData = z.infer<typeof correspondenceSchema>;

export function CorrespondenceForm({ initialData, id }: { initialData?: any, id?: number }) {
  const router = useRouter();
  const createMutation = useCreateCorrespondence();
  const updateMutation = useUpdateCorrespondence();

  // Fetch master data for dropdowns
  const { data: projects, isLoading: isLoadingProjects } = useProjects();
  const { data: organizations, isLoading: isLoadingOrgs } = useOrganizations();
  const { data: correspondenceTypes, isLoading: isLoadingTypes } = useCorrespondenceTypes();
  const { data: disciplines, isLoading: isLoadingDisciplines } = useDisciplines();

  // Extract initial values if editing
  const currentRev = initialData?.revisions?.find((r: any) => r.isCurrent) || initialData?.revisions?.[0];
  const defaultValues: Partial<FormData> = {
    projectId: initialData?.projectId || undefined,
    documentTypeId: initialData?.correspondenceTypeId || undefined,
    disciplineId: initialData?.disciplineId || undefined,
    subject: currentRev?.title || "",
    description: currentRev?.description || "",
    fromOrganizationId: initialData?.originatorId || undefined,
    toOrganizationId: currentRev?.details?.to_organization_id || undefined,
    importance: currentRev?.details?.importance || "NORMAL",
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: defaultValues as any,
  });

  // Watch for controlled inputs
  const projectId = watch("projectId");
  const documentTypeId = watch("documentTypeId");
  const disciplineId = watch("disciplineId");
  const fromOrgId = watch("fromOrganizationId");
  const toOrgId = watch("toOrganizationId");

  const onSubmit = (data: FormData) => {
    const payload: CreateCorrespondenceDto = {
      projectId: data.projectId,
      typeId: data.documentTypeId,
      disciplineId: data.disciplineId,
      title: data.subject,
      description: data.description,
      originatorId: data.fromOrganizationId,
      details: {
        to_organization_id: data.toOrganizationId,
        importance: data.importance
      },
    };

    if (id && initialData) {
       // UPDATE Mode
       updateMutation.mutate({ id, data: payload }, {
         onSuccess: () => router.push(`/correspondences/${id}`)
       });
    } else {
       // CREATE Mode
       createMutation.mutate(payload, {
         onSuccess: () => router.push("/correspondences"),
       });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      {/* Document Metadata Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Project Dropdown */}
        <div className="space-y-2">
          <Label>Project *</Label>
          <Select
            onValueChange={(v) => setValue("projectId", parseInt(v))}
            value={projectId ? String(projectId) : undefined}
            disabled={isLoadingProjects}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingProjects ? "Loading..." : "Select Project"} />
            </SelectTrigger>
            <SelectContent>
              {(projects || []).map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.projectName} ({p.projectCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.projectId && (
            <p className="text-sm text-destructive">{errors.projectId.message}</p>
          )}
        </div>

        {/* Document Type Dropdown */}
        <div className="space-y-2">
          <Label>Document Type *</Label>
          <Select
            onValueChange={(v) => setValue("documentTypeId", parseInt(v))}
            value={documentTypeId ? String(documentTypeId) : undefined}
            disabled={isLoadingTypes}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingTypes ? "Loading..." : "Select Type"} />
            </SelectTrigger>
            <SelectContent>
              {(correspondenceTypes || []).map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.typeName} ({t.typeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.documentTypeId && (
            <p className="text-sm text-destructive">{errors.documentTypeId.message}</p>
          )}
        </div>

        {/* Discipline Dropdown (Optional) */}
        <div className="space-y-2">
          <Label>Discipline</Label>
          <Select
            onValueChange={(v) => setValue("disciplineId", v ? parseInt(v) : undefined)}
            value={disciplineId ? String(disciplineId) : undefined}
            disabled={isLoadingDisciplines}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingDisciplines ? "Loading..." : "Select Discipline (Optional)"} />
            </SelectTrigger>
            <SelectContent>
              {(disciplines || []).map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.codeNameEn || d.disciplineCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" {...register("subject")} placeholder="Enter subject" />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          rows={4}
          placeholder="Enter description details..."
        />
      </div>

      {/* Organizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>From Organization *</Label>
          <Select
            onValueChange={(v) => setValue("fromOrganizationId", parseInt(v))}
            value={fromOrgId ? String(fromOrgId) : undefined}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? "Loading..." : "Select Organization"} />
            </SelectTrigger>
            <SelectContent>
              {(organizations || []).map((org: Organization) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.fromOrganizationId && (
            <p className="text-sm text-destructive">{errors.fromOrganizationId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>To Organization *</Label>
          <Select
            onValueChange={(v) => setValue("toOrganizationId", parseInt(v))}
            value={toOrgId ? String(toOrgId) : undefined}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? "Loading..." : "Select Organization"} />
            </SelectTrigger>
            <SelectContent>
              {(organizations || []).map((org: Organization) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.toOrganizationId && (
            <p className="text-sm text-destructive">{errors.toOrganizationId.message}</p>
          )}
        </div>
      </div>

      {/* Importance */}
      <div className="space-y-2">
        <Label>Importance</Label>
        <div className="flex gap-6 mt-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              value="NORMAL"
              {...register("importance")}
              className="accent-primary"
            />
            <span>Normal</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              value="HIGH"
              {...register("importance")}
              className="accent-primary"
            />
            <span>High</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              value="URGENT"
              {...register("importance")}
              className="accent-primary"
            />
            <span>Urgent</span>
          </label>
        </div>
      </div>

      {/* Attachments (only for new documents) */}
      {!initialData && (
        <div className="space-y-2">
          <Label>Attachments</Label>
          <FileUpload
            onFilesSelected={(files) => setValue("attachments", files)}
            maxFiles={10}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {id ? "Update Correspondence" : "Create Correspondence"}
        </Button>
      </div>
    </form>
  );
}
