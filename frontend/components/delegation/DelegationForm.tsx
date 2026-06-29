'use client';

// File: components/delegation/DelegationForm.tsx
// Form สร้าง Delegation พร้อม date range picker (FR-011)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateDelegationDto } from '@/hooks/use-delegation';
import { DelegationScope } from '@/types/review-team';

const delegationSchema = z
  .object({
    delegateUserPublicId: z.string().uuid('Select a valid user'),
    scope: z.enum(['ALL', 'RFA_ONLY', 'CORRESPONDENCE_ONLY', 'SPECIFIC_TYPES'] as const),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().max(500).optional(),
  })
  .refine((d: { startDate: string; endDate: string }) => new Date(d.startDate) < new Date(d.endDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

type DelegationFormValues = z.infer<typeof delegationSchema>;

interface User {
  publicId: string;
  fullName?: string;
  email?: string;
}

interface DelegationFormProps {
  availableUsers: User[];
  onSubmit: (dto: CreateDelegationDto) => void;
  isLoading?: boolean;
}

const SCOPE_LABELS: Record<DelegationScope, string> = {
  ALL: 'All Documents',
  RFA_ONLY: 'RFA Only',
  CORRESPONDENCE_ONLY: 'Correspondence Only',
  SPECIFIC_TYPES: 'Specific Document Types',
};

export function DelegationForm({ availableUsers, onSubmit, isLoading }: DelegationFormProps) {
  const form = useForm<DelegationFormValues>({
    resolver: zodResolver(delegationSchema),
    defaultValues: { scope: 'ALL' },
  });

  const handleSubmit = (values: DelegationFormValues) => {
    onSubmit({
      ...values,
      scope: values.scope as DelegationScope,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="delegateUserPublicId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delegate To</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user to delegate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.publicId} value={u.publicId}>
                        {u.fullName ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scope</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SCOPE_LABELS) as DelegationScope[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SCOPE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g. Annual leave 12-18 May" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Delegation'}
        </Button>
      </form>
    </Form>
  );
}
