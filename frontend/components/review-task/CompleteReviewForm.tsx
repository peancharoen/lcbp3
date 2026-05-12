'use client';

// File: components/review-task/CompleteReviewForm.tsx
// Form สำหรับบันทึกผล Review Task (FR-009) — Response Code + Comments
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ResponseCodeSelector } from '@/components/response-code/ResponseCodeSelector';
import { CodeImplications } from '@/components/response-code/CodeImplications';
import { useResponseCodes } from '@/hooks/use-response-codes';
import { ResponseCode } from '@/types/review-team';
import { useState } from 'react';

const completeReviewSchema = z.object({
  responseCodePublicId: z.string().uuid('Response Code is required'),
  comments: z.string().optional(),
});

type CompleteReviewFormValues = z.infer<typeof completeReviewSchema>;

interface CompleteReviewFormProps {
  taskPublicId: string;
  documentTypeId: number;
  projectId?: number;
  onSubmit: (values: CompleteReviewFormValues) => void;
  isLoading?: boolean;
}

export function CompleteReviewForm({
  taskPublicId: _taskPublicId,
  documentTypeId,
  projectId,
  onSubmit,
  isLoading,
}: CompleteReviewFormProps) {
  const [selectedCode, setSelectedCode] = useState<ResponseCode | null>(null);
  const { data: allCodes = [] } = useResponseCodes();

  const form = useForm<CompleteReviewFormValues>({
    resolver: zodResolver(completeReviewSchema),
  });

  const handleCodeChange = (publicId: string) => {
    form.setValue('responseCodePublicId', publicId);
    const found = (allCodes as ResponseCode[]).find((c) => c.publicId === publicId) ?? null;
    setSelectedCode(found);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="responseCodePublicId"
          render={() => (
            <FormItem>
              <FormLabel>Response Code</FormLabel>
              <FormControl>
                <ResponseCodeSelector
                  documentTypeId={documentTypeId}
                  projectId={projectId}
                  value={form.watch('responseCodePublicId')}
                  onChange={handleCodeChange}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedCode && <CodeImplications responseCode={selectedCode} />}

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Comments
                {selectedCode?.code === '2' || selectedCode?.code === '3' ? (
                  <span className="text-destructive ml-1">*</span>
                ) : null}
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter review comments..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit Review'}
        </Button>
      </form>
    </Form>
  );
}
