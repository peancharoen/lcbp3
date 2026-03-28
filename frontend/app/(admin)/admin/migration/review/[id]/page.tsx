'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { migrationService } from '@/lib/services/migration.service';
import { MigrationReviewQueueItem } from '@/types/migration';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription as _FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface MigrationAiIssues {
  documentDate?: string;
  issuedDate?: string;
  receivedDate?: string;
  senderId?: string | number;
  disciplineId?: string | number;
  sourceFilePath?: string;
  keyPoints?: string[];
  validationResults?: Array<{ message: string; severity: string }>;
}

const reviewFormSchema = z.object({
  documentNumber: z.string().min(1, 'Document number is required'),
  subject: z.string().min(1, 'Subject is required'),
  category: z.string().min(1, 'Category is required'),
  documentDate: z.string().optional(),
  issuedDate: z.string().optional(),
  receivedDate: z.string().optional(),
  senderId: z.string().optional(),
  disciplineId: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export default function MigrationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [item, setItem] = useState<MigrationReviewQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      documentNumber: '',
      subject: '',
      category: '',
      documentDate: '',
      issuedDate: '',
      receivedDate: '',
      senderId: '',
      disciplineId: '',
    },
  });

  const fetchItem = useCallback(
    async (itemId: number) => {
      try {
        setLoading(true);
        const res = await migrationService.getQueueItem(itemId);
        setItem(res);

        if (res) {
          // Pre-fill form from database item and aiIssues payload
          const issues = (res.aiIssues || {}) as MigrationAiIssues;
          form.reset({
            documentNumber: res.documentNumber || '',
            subject: res.title || res.originalTitle || '',
            category: res.aiSuggestedCategory || '',
            documentDate: issues.documentDate || '',
            issuedDate: issues.issuedDate || '',
            receivedDate: issues.receivedDate || '',
            senderId: issues.senderId ? String(issues.senderId) : '',
            disciplineId: issues.disciplineId ? String(issues.disciplineId) : '',
          });
        }
      } catch (_error) {
        toast.error('Failed to load queue item');
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  useEffect(() => {
    if (!id) return;
    fetchItem(id);
  }, [id, fetchItem]);

  const onSubmit = async (values: ReviewFormValues) => {
    if (!item) return;

    try {
      setSubmitting(true);
      const issues = item.aiIssues || {};

      const payload = {
        documentNumber: values.documentNumber,
        subject: values.subject,
        category: values.category,
        sourceFilePath: issues.sourceFilePath || '',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'MANUAL_REVIEW_BATCH',
        projectId: 1, // Assumption or pulled from store
        documentDate: values.documentDate,
        issuedDate: values.issuedDate,
        receivedDate: values.receivedDate,
        senderId: values.senderId ? Number(values.senderId) : undefined,
        disciplineId: values.disciplineId ? Number(values.disciplineId) : undefined,
        details: {
          tags: issues.tags || [],
          aiConfidence: item.aiConfidence,
        },
      };

      if (!item?.id) {
        toast.error('Invalid item ID');
        return;
      }
      // Mock idempotency key based on timestamp to ensure uniqueness per approval retry
      const idempotencyKey = `review-${item.id}-${Date.now()}`;
      await migrationService.approveQueueItem(item.id, payload, idempotencyKey);

      toast.success('Document approved and imported successfully');
      router.push('/admin/migration');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to approve and import');
    } finally {
      setSubmitting(false);
    }
  };

  const onReject = async () => {
    if (!item || !item.id || !confirm('Are you sure you want to REJECT this document? It will not be imported.')) return;

    try {
      setSubmitting(true);
      await migrationService.rejectQueueItem(item.id);
      toast.success('Document rejected');
      router.push('/admin/migration');
    } catch (_error: unknown) {
      toast.error('Failed to reject document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center">Loading document data...</div>;
  }

  if (!item) {
    return <div className="py-10 text-center text-red-500">Document not found</div>;
  }

  const pdfUrl = (item.aiIssues as MigrationAiIssues)?.sourceFilePath
    ? migrationService.getStagingFileUrl((item.aiIssues as MigrationAiIssues).sourceFilePath!)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-4">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/admin/migration">
            <Button variant="outline" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Document: {item.documentNumber}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Status: <span className="font-semibold text-primary">{item.status}</span>
              {' | '} Confidence:{' '}
              <span className={item.aiConfidence && item.aiConfidence < 0.8 ? 'text-red-500' : 'text-green-500'}>
                {item.aiConfidence ? (item.aiConfidence * 100).toFixed(1) + '%' : 'N/A'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Side: PDF Viewer */}
        <Card className="flex-1 hidden md:flex flex-col overflow-hidden border-2 border-primary/10 shadow-md">
          <CardContent className="p-0 flex-1 relative bg-slate-100">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="absolute inset-0 w-full h-full"
                title="Document Viewer"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <p>No Source File Path found for this document</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Form */}
        <Card className="w-full md:w-[450px] lg:w-[500px] flex-shrink-0 flex flex-col overflow-hidden border-2 border-primary/10 shadow-md">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-semibold text-lg flex items-center gap-2">Extracted Information</h2>
            {item.reviewReason && (
              <p className="text-sm text-red-500 mt-1 font-medium bg-red-50 p-2 rounded border border-red-100">
                Reason: {item.reviewReason}
              </p>
            )}
          </div>
          <CardContent className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CORR">CORR</SelectItem>
                            <SelectItem value="RFA">RFA</SelectItem>
                            <SelectItem value="LETTER">LETTER</SelectItem>
                            <SelectItem value="MEMO">MEMO</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disciplineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discipline ID</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="documentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doc Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="issuedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issued Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="senderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender Org ID</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="Optional" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(item.aiIssues as MigrationAiIssues)?.keyPoints && (item.aiIssues as MigrationAiIssues).keyPoints!.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="font-semibold text-sm mb-2 text-muted-foreground">AI Extracted Key Points</h3>
                    <ul className="text-sm space-y-1 list-disc pl-4 text-muted-foreground">
                      {(item.aiIssues as MigrationAiIssues).keyPoints!.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4 pt-6 mt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur z-10">
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={submitting || item.status !== 'PENDING'}
                    onClick={onReject}
                  >
                    <XCircleIcon className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={submitting || item.status !== 'PENDING'}
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    {submitting ? 'Processing...' : 'Approve & Import'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
