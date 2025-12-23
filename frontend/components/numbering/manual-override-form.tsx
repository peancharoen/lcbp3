"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { documentNumberingService } from "@/lib/services/document-numbering.service";
import { ManualOverrideDto } from "@/types/dto/numbering.dto";
import { useState } from "react";

const formSchema = z.object({
  projectId: z.coerce.number().min(1, "Project is required"),
  originatorOrganizationId: z.coerce.number().min(1, "Originator is required"),
  recipientOrganizationId: z.coerce.number().min(1, "Recipient is required"),
  correspondenceTypeId: z.coerce.number().min(1, "Type is required"),
  newLastNumber: z.coerce.number().min(1, "New number is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  resetScope: z.string().optional()
});

export function ManualOverrideForm({ projectId = 1 }: { projectId?: number }) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      projectId: projectId,
      originatorOrganizationId: 0,
      recipientOrganizationId: 0,
      correspondenceTypeId: 0,
      newLastNumber: 0,
      reason: "",
      resetScope: "YEAR_2025" // Example, should be dynamic or selected
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const dto: ManualOverrideDto = {
        ...values,
        resetScope: values.resetScope || "YEAR_" + new Date().getFullYear()
      };
      await documentNumberingService.manualOverride(dto);
      toast.success("Manual override applied successfully.");
      form.reset();
    } catch (error) {
      toast.error("Failed to apply override.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-md mt-4">
        <h3 className="text-lg font-medium">Manual Override Sequence</h3>
        <p className="text-sm text-gray-500">Careful: This updates the LAST generated number. Next number will receive +1.</p>

        <div className="grid grid-cols-2 gap-4">
           {/* Allow simple text input for IDs for now, ideally Selects from Master Data */}
           <FormField control={form.control} name="projectId" render={({ field }) => (
             <FormItem>
               <FormLabel>Project ID</FormLabel>
               <FormControl><Input type="number" {...field} /></FormControl>
               <FormMessage />
             </FormItem>
           )} />
           <FormField control={form.control} name="correspondenceTypeId" render={({ field }) => (
             <FormItem>
               <FormLabel>Type ID</FormLabel>
               <FormControl><Input type="number" {...field} /></FormControl>
               <FormMessage />
             </FormItem>
           )} />
           <FormField control={form.control} name="originatorOrganizationId" render={({ field }) => (
             <FormItem>
               <FormLabel>Originator Org ID</FormLabel>
               <FormControl><Input type="number" {...field} /></FormControl>
               <FormMessage />
             </FormItem>
           )} />
           <FormField control={form.control} name="recipientOrganizationId" render={({ field }) => (
             <FormItem>
               <FormLabel>Recipient Org ID</FormLabel>
               <FormControl><Input type="number" {...field} /></FormControl>
               <FormMessage />
             </FormItem>
           )} />
        </div>

        <FormField control={form.control} name="newLastNumber" render={({ field }) => (
          <FormItem>
            <FormLabel>Set Last Number To</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormDescription>
                If you set 99, the next auto-generated number will be 100.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem>
            <FormLabel>Reason</FormLabel>
            <FormControl>
              <Input placeholder="Why are you overriding?" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={loading}>
          {loading ? "Applying..." : "Apply Override"}
        </Button>
      </form>
    </Form>
  );
}
