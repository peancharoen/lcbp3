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
import { useCreateCorrespondence } from "@/hooks/use-correspondence";
import { Organization } from "@/types/organization";
import { useOrganizations } from "@/hooks/use-master-data";
import { CreateCorrespondenceDto } from "@/types/dto/correspondence/create-correspondence.dto";

const correspondenceSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  document_type_id: z.number().default(1),
  from_organization_id: z.number().min(1, "Please select From Organization"),
  to_organization_id: z.number().min(1, "Please select To Organization"),
  importance: z.enum(["NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  attachments: z.array(z.instanceof(File)).optional(),
});

type FormData = z.infer<typeof correspondenceSchema>;

export function CorrespondenceForm() {
  const router = useRouter();
  const createMutation = useCreateCorrespondence();
  const { data: organizations, isLoading: isLoadingOrgs } = useOrganizations();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: {
      importance: "NORMAL",
      document_type_id: 1,
    } as any, // Cast to any to handle partial defaults for required fields
  });

  const onSubmit = (data: FormData) => {
    // Map FormData to CreateCorrespondenceDto
    // Note: projectId is hardcoded to 1 for now as per requirements/context
    const payload: CreateCorrespondenceDto = {
      projectId: 1,
      typeId: data.document_type_id,
      title: data.subject,
      description: data.description,
      originatorId: data.from_organization_id, // Mapping From -> Originator (Impersonation)
      details: {
        to_organization_id: data.to_organization_id,
        importance: data.importance
      },
      // create-correspondence DTO does not have 'attachments' field at root usually, often handled separate or via multipart
      // If useCreateCorrespondence handles multipart, we might need to pass FormData object or specific structure
      // For now, aligning with DTO interface.
    };

    // If the hook expects the DTO directly:
    createMutation.mutate(payload, {
      onSuccess: () => {
        router.push("/correspondences");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" {...register("subject")} placeholder="Enter subject" />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          rows={4}
          placeholder="Enter description details..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>From Organization *</Label>
          <Select
            onValueChange={(v) => setValue("from_organization_id", parseInt(v))}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? "Loading..." : "Select Organization"} />
            </SelectTrigger>
            <SelectContent>
              {organizations?.map((org: Organization) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.from_organization_id && (
            <p className="text-sm text-destructive">{errors.from_organization_id.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>To Organization *</Label>
          <Select
            onValueChange={(v) => setValue("to_organization_id", parseInt(v))}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? "Loading..." : "Select Organization"} />
            </SelectTrigger>
            <SelectContent>
              {organizations?.map((org: Organization) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.to_organization_id && (
            <p className="text-sm text-destructive">{errors.to_organization_id.message}</p>
          )}
        </div>
      </div>

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

      <div className="space-y-2">
        <Label>Attachments</Label>
        <FileUpload
          onFilesSelected={(files) => setValue("attachments", files)}
          maxFiles={10}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
        />
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Correspondence
        </Button>
      </div>
    </form>
  );
}
