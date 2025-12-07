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
import { useOrganizations } from "@/hooks/use-master-data";

const correspondenceSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  document_type_id: z.number().default(1), // Default to General for now
  from_organization_id: z.number({ required_error: "Please select From Organization" }),
  to_organization_id: z.number({ required_error: "Please select To Organization" }),
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
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(correspondenceSchema),
    defaultValues: {
      importance: "NORMAL",
      document_type_id: 1,
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data as any, {
      onSuccess: () => {
        router.push("/correspondences");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
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

      {/* From/To Organizations */}
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
              {organizations?.map((org: any) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name || org.org_name} ({org.code || org.org_code})
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
              {organizations?.map((org: any) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name || org.org_name} ({org.code || org.org_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.to_organization_id && (
            <p className="text-sm text-destructive">{errors.to_organization_id.message}</p>
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

      {/* File Attachments */}
      <div className="space-y-2">
        <Label>Attachments</Label>
        <FileUpload
          onFilesSelected={(files) => setValue("attachments", files)}
          maxFiles={10}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
        />
      </div>

      {/* Actions */}
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
