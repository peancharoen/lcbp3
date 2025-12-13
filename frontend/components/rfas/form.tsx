"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useCreateRFA } from "@/hooks/use-rfa";
import { useDisciplines, useContracts } from "@/hooks/use-master-data";
import { CreateRFADto } from "@/types/rfa";
import { useState, useEffect } from "react";
import { correspondenceService } from "@/lib/services/correspondence.service";

const rfaItemSchema = z.object({
  itemNo: z.string().min(1, "Item No is required"),
  description: z.string().min(3, "Description is required"),
  quantity: z.number().min(0, "Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
});
const rfaSchema = z.object({
  contractId: z.number().min(1, "Contract is required"),
  disciplineId: z.number().min(1, "Discipline is required"),
  rfaTypeId: z.number().min(1, "Type is required"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  toOrganizationId: z.number().min(1, "Please select To Organization"),
  dueDate: z.string().optional(),
  shopDrawingRevisionIds: z.array(z.number()).optional(),
  items: z.array(rfaItemSchema).min(1, "At least one item is required"),
});

type RFAFormData = z.infer<typeof rfaSchema>;

export function RFAForm() {
  const router = useRouter();
  const createMutation = useCreateRFA();

  // Dynamic Contract Loading (Default Project Context: 1)
  const currentProjectId = 1;
  const { data: contracts, isLoading: isLoadingContracts } = useContracts(currentProjectId);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RFAFormData>({
    resolver: zodResolver(rfaSchema),
    defaultValues: {
      contractId: 0,
      disciplineId: 0,
      rfaTypeId: 0,
      subject: "",
      description: "",
      body: "",
      remarks: "",
      toOrganizationId: 0,
      dueDate: "",
      shopDrawingRevisionIds: [],
      items: [{ itemNo: "1", description: "", quantity: 0, unit: "" }],
    },
  });

  const selectedContractId = watch("contractId");
  const { data: disciplines, isLoading: isLoadingDisciplines } = useDisciplines(selectedContractId);

  // Watch fields for preview
  const rfaTypeId = watch("rfaTypeId");
  const disciplineId = watch("disciplineId");
  const toOrganizationId = watch("toOrganizationId");

  // -- Preview Logic --
  const [preview, setPreview] = useState<{ number: string; isDefaultTemplate: boolean } | null>(null);

  useEffect(() => {
    if (!rfaTypeId || !disciplineId || !toOrganizationId) {
       setPreview(null);
       return;
    }

    const fetchPreview = async () => {
       try {
         const res = await correspondenceService.previewNumber({
             projectId: currentProjectId,
             typeId: rfaTypeId, // RfaTypeId acts as TypeId
             disciplineId,
             // RFA uses 'TO' organization as recipient
             recipients: [{ organizationId: toOrganizationId, type: 'TO' }],
             dueDate: new Date().toISOString()
         });
         setPreview(res);
       } catch (err) {
         setPreview(null);
       }
    };

    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [rfaTypeId, disciplineId, toOrganizationId, currentProjectId]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const onSubmit = (data: RFAFormData) => {
    const payload: CreateRFADto = {
      ...data,
      projectId: currentProjectId,
    };
    createMutation.mutate(payload as any, {
      onSuccess: () => {
        router.push("/rfas");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
      {/* Preview Section */}
      {preview && (
        <Card className="p-4 bg-muted border-l-4 border-l-primary">
           <p className="text-sm text-muted-foreground mb-1">Document Number Preview</p>
           <div className="flex items-center gap-3">
             <span className="text-xl font-bold font-mono text-primary tracking-wide">{preview.number}</span>
             {preview.isDefaultTemplate && (
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                   Default Template
                </span>
             )}
           </div>
        </Card>
      )}

      {/* Basic Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">RFA Information</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input id="subject" {...register("subject")} placeholder="Enter subject" />
            {errors.subject && (
              <p className="text-sm text-destructive mt-1">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div>
             <Label htmlFor="body">Body (Content)</Label>
             <Textarea id="body" {...register("body")} rows={4} placeholder="Enter content..." />
          </div>

           <div>
             <Label htmlFor="remarks">Remarks</Label>
             <Input id="remarks" {...register("remarks")} placeholder="Optional remarks" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} placeholder="Enter key description" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contract *</Label>
              <Select
                onValueChange={(val) => setValue("contractId", Number(val))}
                disabled={isLoadingContracts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingContracts ? "Loading..." : "Select Contract"} />
                </SelectTrigger>
                <SelectContent>
                  {contracts?.map((c: any) => (
                    <SelectItem key={c.id || c.contract_id} value={String(c.id || c.contract_id)}>
                      {c.name || c.contract_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contractId && (
                <p className="text-sm text-destructive mt-1">{errors.contractId.message}</p>
              )}
            </div>

            <div>
              <Label>Discipline *</Label>
              <Select
                onValueChange={(val) => setValue("disciplineId", Number(val))}
                disabled={!selectedContractId || isLoadingDisciplines}
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
                  {!isLoadingDisciplines && !disciplines?.length && (
                     <SelectItem value="0" disabled>No disciplines found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.disciplineId && (
                <p className="text-sm text-destructive mt-1">{errors.disciplineId.message}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* RFA Items */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">RFA Items</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                itemNo: (fields.length + 1).toString(),
                description: "",
                quantity: 0,
                unit: "",
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-4 bg-muted/20">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium text-sm">Item #{index + 1}</h4>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Item No.</Label>
                  <Input {...register(`items.${index}.itemNo`)} placeholder="1.1" />
                  {errors.items?.[index]?.itemNo && (
                    <p className="text-xs text-destructive mt-1">{errors.items[index]?.itemNo?.message}</p>
                  )}
                </div>
                <div className="md:col-span-6">
                  <Label className="text-xs">Description *</Label>
                  <Input {...register(`items.${index}.description`)} placeholder="Item description" />
                  {errors.items?.[index]?.description && (
                    <p className="text-xs text-destructive mt-1">{errors.items[index]?.description?.message}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    {...register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.items?.[index]?.quantity && (
                    <p className="text-xs text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Unit</Label>
                  <Input {...register(`items.${index}.unit`)} placeholder="pcs, m3" />
                  {errors.items?.[index]?.unit && (
                    <p className="text-xs text-destructive mt-1">{errors.items[index]?.unit?.message}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {errors.items?.root && (
          <p className="text-sm text-destructive mt-2">
            {errors.items.root.message}
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create RFA
        </Button>
      </div>
    </form>
  );
}
