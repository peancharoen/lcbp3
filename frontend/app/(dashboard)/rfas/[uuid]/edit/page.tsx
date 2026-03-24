'use client';

import { useParams, useRouter, notFound } from 'next/navigation';
import { useRFA, useUpdateRFA } from '@/hooks/use-rfa';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdateRfaDto } from '@/types/dto/rfa/rfa.dto';
import { useEffect } from 'react';

const editRfaSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  dueDate: z.string().optional(),
});

type EditRfaFormValues = z.infer<typeof editRfaSchema>;

export default function RFAEditPage() {
  const { uuid } = useParams();
  const router = useRouter();

  if (!uuid) notFound();

  const { data: rfa, isLoading, isError } = useRFA(String(uuid));
  const updateMutation = useUpdateRFA();

  const currentRevision =
    rfa?.revisions?.find((r) => r.isCurrent) ?? rfa?.revisions?.[0];

  const form = useForm<EditRfaFormValues>({
    resolver: zodResolver(editRfaSchema),
    defaultValues: {
      subject: '',
      description: '',
      body: '',
      remarks: '',
      dueDate: '',
    },
  });

  useEffect(() => {
    if (currentRevision) {
      form.reset({
        subject: currentRevision.subject ?? '',
        description: currentRevision.description ?? '',
        body: currentRevision.body ?? '',
        remarks: currentRevision.remarks ?? '',
        dueDate: currentRevision.dueDate
          ? currentRevision.dueDate.slice(0, 10)
          : '',
      });
    }
  }, [currentRevision, form]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !rfa) {
    return <div className="text-center py-20 text-red-500">RFA not found.</div>;
  }

  if (currentRevision?.statusCode?.statusCode !== 'DFT') {
    return (
      <div className="text-center py-20 text-amber-600">
        Only DRAFT RFAs can be edited.{' '}
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const onSubmit = (values: EditRfaFormValues) => {
    const dto: UpdateRfaDto = {
      subject: values.subject,
      description: values.description || undefined,
      body: values.body || undefined,
      remarks: values.remarks || undefined,
      dueDate: values.dueDate || undefined,
    };

    updateMutation.mutate(
      { uuid: String(uuid), data: dto },
      {
        onSuccess: () => {
          router.push(`/rfas/${String(uuid)}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit RFA</h1>
        <p className="text-muted-foreground mt-1">
          {rfa.correspondence?.correspondenceNumber || 'Draft RFA'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revision Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                {...form.register('subject')}
                placeholder="Subject of this RFA"
              />
              {form.formState.errors.subject && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.subject.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Detailed description..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                {...form.register('body')}
                placeholder="Main body content..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                {...form.register('remarks')}
                placeholder="Additional remarks..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register('dueDate')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
