'use client';

// File: components/reminder/ReminderRuleForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReminderType } from '@/types/workflow';
import { CreateReminderRuleDto } from '@/hooks/use-reminder';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  documentTypeCode: z.string().optional(),
  reminderType: z.nativeEnum(ReminderType),
  daysBeforeDue: z.coerce.number(),
  escalationLevel: z.coerce.number().min(0).max(2).default(0),
  messageTemplate: z.string().optional(),
});

interface ReminderRuleFormProps {
  onSubmit: (data: CreateReminderRuleDto) => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreateReminderRuleDto>;
}

export function ReminderRuleForm({ onSubmit, isLoading, defaultValues }: ReminderRuleFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      documentTypeCode: defaultValues?.documentTypeCode ?? '',
      reminderType: defaultValues?.reminderType ?? ReminderType.DUE_SOON,
      daysBeforeDue: defaultValues?.daysBeforeDue ?? 2,
      escalationLevel: defaultValues?.escalationLevel ?? 0,
      messageTemplate: defaultValues?.messageTemplate ?? '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rule Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 2 Days Before Reminder" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reminderType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ReminderType.DUE_SOON}>Due Soon</SelectItem>
                    <SelectItem value={ReminderType.ON_DUE}>On Due</SelectItem>
                    <SelectItem value={ReminderType.OVERDUE}>Overdue</SelectItem>
                    <SelectItem value={ReminderType.ESCALATION_L1}>Escalation L1</SelectItem>
                    <SelectItem value={ReminderType.ESCALATION_L2}>Escalation L2</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="daysBeforeDue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trigger Days</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>+ for before, - for after due</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="escalationLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escalation Level</FormLabel>
              <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="0">0 - Normal Reminder</SelectItem>
                  <SelectItem value="1">1 - Escalation L1 (Lead)</SelectItem>
                  <SelectItem value="2">2 - Escalation L2 (PM)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="messageTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message Template (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Custom message for notification..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Rule'}
        </Button>
      </form>
    </Form>
  );
}
