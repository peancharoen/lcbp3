"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const rfaItemSchema = z.object({
  item_no: z.string().min(1, "Item No is required"),
  description: z.string().min(3, "Description is required"),
  quantity: z.number({ invalid_type_error: "Quantity must be a number" }).min(0),
  unit: z.string().min(1, "Unit is required"),
});

const rfaSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  contract_id: z.number({ required_error: "Contract is required" }),
  discipline_id: z.number({ required_error: "Discipline is required" }),
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
      contract_id: undefined, // Force selection
      items: [{ item_no: "1", description: "", quantity: 0, unit: "" }],
    },
  });

  const selectedContractId = watch("contract_id");
  const { data: disciplines, isLoading: isLoadingDisciplines } = useDisciplines(selectedContractId);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const onSubmit = (data: RFAFormData) => {
    // Map to DTO if needed, assuming generic structure matches
    createMutation.mutate(data as unknown as CreateRFADto, {
      onSuccess: () => {
        router.push("/rfas");
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
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
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} placeholder="Enter description" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contract *</Label>
              <Select
                onValueChange={(v) => setValue("contract_id", parseInt(v))}
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
              {errors.contract_id && (
                <p className="text-sm text-destructive mt-1">{errors.contract_id.message}</p>
              )}
            </div>

            <div>
              <Label>Discipline *</Label>
              <Select
                onValueChange={(v) => setValue("discipline_id", parseInt(v))}
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
              {errors.discipline_id && (
                <p className="text-sm text-destructive mt-1">{errors.discipline_id.message}</p>
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
                item_no: (fields.length + 1).toString(),
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
                  <Input {...register(`items.${index}.item_no`)} placeholder="1.1" />
                  {errors.items?.[index]?.item_no && (
                    <p className="text-xs text-destructive mt-1">{errors.items[index]?.item_no?.message}</p>
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
