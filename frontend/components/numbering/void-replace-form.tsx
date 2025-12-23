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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { documentNumberingService } from "@/lib/services/document-numbering.service";
import { VoidReplaceDto } from "@/types/dto/numbering.dto";
import { useState } from "react";

const formSchema = z.object({
  documentNumber: z.string().min(3, "Document Number is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  replace: z.boolean(),
  projectId: z.number()
});

type VoidReplaceFormData = z.infer<typeof formSchema>;

export function VoidReplaceForm({ projectId = 1 }: { projectId?: number }) {
  const [loading, setLoading] = useState(false);

  const form = useForm<VoidReplaceFormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      documentNumber: "",
      reason: "",
      replace: false,
      projectId: projectId
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const dto: VoidReplaceDto = {
        ...values,
      };
      await documentNumberingService.voidAndReplace(dto);
      toast.success("Number voided successfully. " + (values.replace ? "Replacement generated." : ""));
      form.reset();
    } catch (error) {
      toast.error("Failed to void number. Check if it exists.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-md">
        <h3 className="text-lg font-medium">Void & Replace Number</h3>
        <p className="text-sm text-gray-500">Void a generated number. Useful for skipped numbers or errors.</p>

        <FormField control={form.control} name="documentNumber" render={({ field }) => (
          <FormItem>
            <FormLabel>Document Number</FormLabel>
            <FormControl>
              <Input placeholder="e.g. LCB3-COR-GGL-2025-0001" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem>
            <FormLabel>Reason</FormLabel>
            <FormControl>
              <Input placeholder="Reason for voiding..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="replace" render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>
                Generate Replacement?
              </FormLabel>
              <FormDescription>
                If checked, a new number will be reserved immediately.
              </FormDescription>
            </div>
          </FormItem>
        )} />

        <Button type="submit" variant="destructive" disabled={loading}>
          {loading ? "Processing..." : "Void Number"}
        </Button>
      </form>
    </Form>
  );
}
