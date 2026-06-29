'use client';

// File: components/review-team/ReviewTeamForm.tsx
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
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useState } from 'react';

const reviewTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
  defaultForRfaTypes: z.array(z.string()).optional(),
});

type ReviewTeamFormValues = z.infer<typeof reviewTeamSchema>;

interface ReviewTeamFormProps {
  projectPublicId: string;
  defaultValues?: Partial<ReviewTeamFormValues>;
  onSubmit: (values: ReviewTeamFormValues & { projectPublicId: string }) => void;
  isLoading?: boolean;
}

const RFA_TYPE_OPTIONS = ['SDW', 'DDW', 'ADW', 'MS', 'MAT', 'BOQ'];

export function ReviewTeamForm({
  projectPublicId,
  defaultValues,
  onSubmit,
  isLoading,
}: ReviewTeamFormProps) {
  const [typeInput, setTypeInput] = useState('');

  const form = useForm<ReviewTeamFormValues>({
    resolver: zodResolver(reviewTeamSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      defaultForRfaTypes: defaultValues?.defaultForRfaTypes ?? [],
    },
  });

  const rfaTypes = form.watch('defaultForRfaTypes') ?? [];

  const addRfaType = (type: string) => {
    if (type && !rfaTypes.includes(type)) {
      form.setValue('defaultForRfaTypes', [...rfaTypes, type]);
    }
    setTypeInput('');
  };

  const removeRfaType = (type: string) => {
    form.setValue(
      'defaultForRfaTypes',
      rfaTypes.filter((t) => t !== type),
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSubmit({ ...values, projectPublicId }),
        )}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Structural Review Team" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Default for RFA Types</FormLabel>
          <div className="flex flex-wrap gap-2 mb-2">
            {rfaTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1">
                {type}
                <button
                  type="button"
                  onClick={() => removeRfaType(type)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            {RFA_TYPE_OPTIONS.filter((t) => !rfaTypes.includes(t)).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addRfaType(type)}
                className="text-xs px-2 py-1 rounded border border-dashed hover:bg-accent"
              >
                + {type}
              </button>
            ))}
          </div>
          <input type="hidden" value={typeInput} onChange={(e) => setTypeInput(e.target.value)} />
        </FormItem>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Team'}
        </Button>
      </form>
    </Form>
  );
}
