"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { transmittalService } from "@/lib/services/transmittal.service";
import { correspondenceService } from "@/lib/services/correspondence.service";
import { projectService } from "@/lib/services/project.service";
import { organizationService } from "@/lib/services/organization.service";
import { CreateTransmittalDto } from "@/types/dto/transmittal/transmittal.dto";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Schema for items
const itemSchema = z.object({
  itemType: z.enum(["DRAWING", "RFA", "CORRESPONDENCE"]),
  itemId: z.number().min(1, "Document is required"),
  description: z.string().optional(),
  // Virtual fields for UI display
  documentNumber: z.string().optional(),
});

// Main form schema
const formSchema = z.object({
  projectId: z.string().min(1, "Project is required"), // ADR-019: UUID
  recipientOrganizationId: z.string().min(1, "Recipient is required"), // ADR-019: UUID
  correspondenceId: z.string().min(1, "Correspondence is required"), // ADR-019: UUID string
  subject: z.string().min(1, "Subject is required"),
  purpose: z.enum(["FOR_APPROVAL", "FOR_INFORMATION", "FOR_REVIEW", "OTHER"]),
  remarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormData = z.infer<typeof formSchema>;

export function TransmittalForm() {
  const router = useRouter();
  const [docOpen, setDocOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: "",
      recipientOrganizationId: "",
      correspondenceId: "",
      subject: "",
      purpose: "FOR_APPROVAL",
      remarks: "",
      items: [
        { itemType: "DRAWING", itemId: 0, description: "" }, // Initial empty row
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // ADR-019: Fetch projects and organizations for UUID-based selectors
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => projectService.getAll(),
  });
  const projectsList = projectsData?.data || projectsData || [];

  const { data: orgsData, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["organizations-dropdown"],
    queryFn: () => organizationService.getAll(),
  });
  const orgsList = orgsData?.data || orgsData || [];

  // Fetch correspondences (for header linkage)
  const { data: correspondences } = useQuery({
    queryKey: ["correspondences-dropdown"],
    queryFn: () => correspondenceService.getAll({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTransmittalDto) => transmittalService.create(data),
    onSuccess: (result) => {
      toast.success("Transmittal created successfully");
      // ADR-019: Navigate using UUID from correspondence
      router.push(`/transmittals/${result.correspondence?.uuid || result.uuid}`);
    },
    onError: () => {
      toast.error("Failed to create transmittal");
    },
  });

  const onSubmit = (data: FormData) => {
    // ADR-019: All IDs are now UUID strings from the form
    const cleanPayload: CreateTransmittalDto = {
        projectId: data.projectId,
        recipientOrganizationId: data.recipientOrganizationId,
        correspondenceId: data.correspondenceId,
        subject: data.subject,
        purpose: data.purpose as string,
        remarks: data.remarks,
        items: data.items.map(item => ({
             itemType: item.itemType,
             itemId: item.itemId,
             description: item.description
        }))
    };

    createMutation.mutate(cleanPayload);
  };

  const selectedDocId = form.watch("correspondenceId");
  const selectedDoc = correspondences?.data?.find(
    (c: { uuid: string }) => c.uuid === selectedDocId
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Main Info */}
        <Card>
          <CardHeader>
            <CardTitle>Transmittal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ADR-019: Project & Recipient Organization selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingProjects}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProjects ? "Loading..." : "Select Project"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Array.isArray(projectsList) ? projectsList : []).map((p: { uuid: string; projectName?: string; projectCode?: string }) => (
                          <SelectItem key={p.uuid} value={p.uuid}>
                            {p.projectName || p.projectCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipientOrganizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingOrgs}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingOrgs ? "Loading..." : "Select Organization"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Array.isArray(orgsList) ? orgsList : []).map((o: { uuid: string; organizationName?: string; orgCode?: string }) => (
                          <SelectItem key={o.uuid} value={o.uuid}>
                            {o.organizationName || o.orgCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Linked Correspondence (Ref No) */}
              <FormField
                control={form.control}
                name="correspondenceId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Reference Document</FormLabel>
                    <Popover open={docOpen} onOpenChange={setDocOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedDoc
                              ? selectedDoc.correspondence_number
                              : "Select reference..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search documents..." />
                          <CommandList>
                            <CommandEmpty>No document found.</CommandEmpty>
                            <CommandGroup>
                              {correspondences?.data?.map(
                                (doc: { uuid: string; correspondence_number: string }) => (
                                  <CommandItem
                                    key={doc.uuid}
                                    value={doc.correspondence_number}
                                    onSelect={() => {
                                      form.setValue("correspondenceId", doc.uuid);
                                      setDocOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        doc.uuid === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {doc.correspondence_number}
                                  </CommandItem>
                                )
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Purpose */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FOR_APPROVAL">For Approval</SelectItem>
                        <SelectItem value="FOR_INFORMATION">
                          For Information
                        </SelectItem>
                        <SelectItem value="FOR_REVIEW">For Review</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter transmittal subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Items Manager */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transmittal Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  itemType: "DRAWING",
                  itemId: 0,
                  description: "",
                  documentNumber: "",
                }, { focusIndex: fields.length })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-muted/20"
                >
                  {/* Item Type */}
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemType`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DRAWING">Drawing</SelectItem>
                              <SelectItem value="RFA">RFA</SelectItem>
                              <SelectItem value="CORRESPONDENCE">
                                Correspondence
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Document Search (Placeholder for now) */}
                  <div className="col-span-5">
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Document ID</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="ID"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          {/* In real app, this would be another AsyncSelect/Combobox */}
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Description */}
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Description</FormLabel>
                          <FormControl>
                            <Input placeholder="Copies/Notes" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Remove Action */}
                  <div className="col-span-1 flex justify-end pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <FormMessage>
              {form.formState.errors.items?.root?.message}
            </FormMessage>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Transmittal
          </Button>
        </div>
      </form>
    </Form>
  );
}
