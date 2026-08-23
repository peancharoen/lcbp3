// File: app/(admin)/admin/migration/review/[id]/page.tsx
// Change Log:
// - 2026-08-23: อ่าน sourceFilePath/disciplineId จาก details, ส่ง disciplineId (INT), ใช้ item.projectId
// - 2026-05-22: Initial creation of Migration Review detail page (T024)
// - 2026-08-06: เพิ่ม CompareResultTable และ fieldResolutions state สำหรับ Feature 242 (FR-011, FR-012c)
// - 2026-08-22: เปลี่ยน Sender/Receiver/Discipline เป็น dropdown, แก้ date mapping
// - 2026-08-23: Pretty print error response สำหรับ debug
//   (Doc Date = issued_date จาก excel → document_date, Received Date = received_date),
//   เปลี่ยน label "Issued Date" → "Received Date"

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { migrationService } from '@/lib/services/migration.service';
import { organizationService } from '@/lib/services/organization.service';
import { masterDataService } from '@/lib/services/master-data.service';
import { MigrationReviewQueueItem, FieldResolution, MigrationReviewStatus, MigrationAiStatus } from '@/types/migration';
import { Organization } from '@/types/organization';
import { Discipline, CorrespondenceType } from '@/types/master-data';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription as _FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { CompareResultTable } from '@/components/migration/compare-result-table';
import { OcrTextEditor } from '@/components/migration/ocr-text-editor';

interface MigrationAiIssues {
  documentDate?: string;
  issuedDate?: string;
  receivedDate?: string;
  senderId?: string | number;
  keyPoints?: string[];
  validationResults?: Array<{ message: string; severity: string }>;
  tags?: string[];
}

const reviewFormSchema = z.object({
  documentNumber: z.string().min(1, 'Document number is required'),
  subject: z.string().min(1, 'Subject is required'),
  category: z.string().min(1, 'Category is required'),
  documentDate: z.string().optional(),
  receivedDate: z.string().optional(),
  senderPublicId: z.string().optional(),
  receiverPublicId: z.string().optional(),
  disciplineId: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export default function MigrationReviewPage() {
  const params = useParams();
  const router = useRouter();
  // ADR-019: ใช้ publicId (UUIDv7) จาก route param ห้ามแปลงเป็น number
  const publicId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<MigrationReviewQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<Record<string, unknown> | null>(null);
  const [fieldResolutions, setFieldResolutions] = useState<FieldResolution[]>([]);
  // Reference data สำหรับ dropdown
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [correspondenceTypes, setCorrespondenceTypes] = useState<CorrespondenceType[]>([]);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      documentNumber: '',
      subject: '',
      category: '',
      documentDate: '',
      receivedDate: '',
      senderPublicId: '',
      receiverPublicId: '',
      disciplineId: '',
    },
  });

  // โหลด reference data สำหรับ dropdown (Organizations, Disciplines, CorrespondenceTypes)
  useEffect(() => {
    const loadRefData = async () => {
      try {
        const [orgs, discs, corrTypes] = await Promise.all([
          organizationService.getAll(),
          masterDataService.getDisciplines(),
          masterDataService.getCorrespondenceTypes(),
        ]);
        setOrganizations(orgs ?? []);
        setDisciplines(discs ?? []);
        setCorrespondenceTypes(corrTypes ?? []);
      } catch {
        // ไม่ block หน้า ถ้า reference data โหลดไม่ได้
      }
    };
    loadRefData();
  }, []);

  const fetchItem = useCallback(
    async (itemPublicId: string) => {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await migrationService.getQueueItem(itemPublicId);
        setItem(res);

        if (res) {
          // Pre-fill form: Doc Date = issuedDate (excel issued_date → document_date)
          //                Received Date = receivedDate (excel received_date → received_date)
          const issues = (res.aiIssues || {}) as MigrationAiIssues;
          const details = res.details || {};
          form.reset({
            documentNumber: res.documentNumber || '',
            subject: res.title || res.originalTitle || res.subject || res.originalSubject || '',
            category: res.aiSuggestedCategory || '',
            documentDate: res.issuedDate
              ? String(res.issuedDate).split('T')[0]
              : issues.documentDate || '',
            receivedDate: res.receivedDate
              ? String(res.receivedDate).split('T')[0]
              : issues.receivedDate || '',
            senderPublicId: res.senderOrganizationPublicId || '',
            receiverPublicId: res.receiverOrganizationPublicId || '',
            // อ่าน disciplineId จาก details ที่ AI enrichment เก็บไว้
            disciplineId: details.disciplineId ? String(details.disciplineId) : '',
          });
        }
      } catch (error: unknown) {
        // เก็บ error object สำหรับ pretty print บนหน้า
        const err = error as { response?: { data?: Record<string, unknown> } };
        setLoadError(err?.response?.data ?? { message: String(error) });
        toast.error('Failed to load queue item');
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  useEffect(() => {
    if (!publicId) return;
    fetchItem(publicId);
  }, [publicId, fetchItem]);

  const handleStartExtract = async () => {
    if (!item?.publicId) return;
    try {
      setSubmitting(true);
      const idempotencyKey = `extract-${item.publicId}-${Date.now()}`;
      await migrationService.startExtractQueueItem(item.publicId, idempotencyKey);
      toast.success('เริ่มประมวลผล OCR/AI แล้ว กรุณารอสักครู่แล้วรีเฟรช');
      await fetchItem(item.publicId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'เริ่มประมวลผลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (values: ReviewFormValues) => {
    if (!item) return;
    try {
      setSubmitting(true);
      const issues = (item.aiIssues || {}) as unknown as MigrationAiIssues;
      const details = item.details || {};
      const payload = {
        documentNumber: values.documentNumber,
        subject: values.subject,
        category: values.category,
        // อ่าน canonical path จาก details ที่ ingestion / AI enrichment เก็บไว้
        sourceFilePath: typeof details.source_file_path === 'string' ? details.source_file_path : '',
        migratedBy: 'SYSTEM_IMPORT',
        batchId: 'MANUAL_REVIEW_BATCH',
        projectId: item.projectId || 1,
        // Mapping: documentDate = issued_date จาก excel (วันที่ออกเอกสาร)
        documentDate: values.documentDate,
        receivedDate: values.receivedDate,
        // ADR-019: ส่ง publicId (UUID) สำหรับ sender/receiver
        senderPublicId: values.senderPublicId || undefined,
        receiverPublicId: values.receiverPublicId || undefined,
        // Discipline ใช้ internal INT id (ADR-019 Excluded Tables: Master/Lookup)
        disciplineId: values.disciplineId ? Number(values.disciplineId) : undefined,
        details: {
          tags: issues.tags || [],
          aiConfidence: item.aiConfidence,
        },
      };
      if (!item?.publicId) {
        toast.error('Invalid item publicId');
        return;
      }
      const idempotencyKey = `review-${item.publicId}-${Date.now()}`;
      // Feature 242: ส่ง fieldResolutions ใน commit payload (FR-011b)
      const commitPayload = {
        ...payload,
        fieldResolutions: fieldResolutions.length > 0 ? fieldResolutions : undefined,
      };
      await migrationService.approveQueueItem(item.publicId, commitPayload, idempotencyKey);
      toast.success('Execute Import สำเร็จ');
      router.push('/admin/migration');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Execute Import ล้มเหลว');
    } finally {
      setSubmitting(false);
    }
  };

  const onReject = async () => {
    if (!item || !item.publicId || !confirm('Are you sure you want to REJECT this document? It will not be imported.')) return;

    try {
      setSubmitting(true);
      // ADR-016: ส่ง Idempotency-Key สำหรับ rejection mutation
      const idempotencyKey = `reject-${item.publicId}-${Date.now()}`;
      await migrationService.rejectQueueItem(item.publicId, idempotencyKey);
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
    return (
      <div className="py-10 text-center space-y-4">
        <div className="text-red-500 font-medium">Document not found</div>
        {loadError && (
          <pre className="text-left text-xs text-muted-foreground bg-muted p-4 rounded-md overflow-auto max-w-2xl mx-auto">
            {JSON.stringify(loadError, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const sourceFilePath =
    typeof item.details?.source_file_path === 'string'
      ? item.details.source_file_path
      : null;
  const pdfUrl = sourceFilePath
    ? migrationService.getStagingFileUrl(sourceFilePath)
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
        {/* Left Side: PDF Viewer + Compare Result */}
        <div className="flex-1 hidden md:flex flex-col gap-4 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden border-2 border-primary/10 shadow-md">
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
          {/* Feature 242: Compare Result Table (FR-007, FR-011, FR-012c) */}
          {item.compareStatus && (
            <CompareResultTable
              compareStatus={item.compareStatus}
              compareResult={item.compareResult}
              compareUnavailableReason={item.compareUnavailableReason}
              capturedThresholds={item.capturedThresholds}
              fieldResolutions={fieldResolutions}
              onFieldResolutionChange={setFieldResolutions}
            />
          )}

          {/* ADR-047: OCR 3 หน้าแรก Text Editor — superadmin/admin แก้ไขและ Re-embed RAG ได้ */}
          {item.publicId && (
            <OcrTextEditor
              publicId={item.publicId}
              initialOcrText={item.ocrText}
              onSaved={(newText) =>
                setItem((prev) => (prev ? { ...prev, ocrText: newText } : prev))
              }
            />
          )}
        </div>

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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {correspondenceTypes.map((ct) => (
                              <SelectItem key={ct.typeCode} value={ct.typeCode}>
                                {ct.typeCode} — {ct.typeName}
                              </SelectItem>
                            ))}
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
                        <FormLabel>Discipline</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select discipline" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {disciplines.map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>
                                {d.disciplineCode} — {d.codeNameEn || d.codeNameTh}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <FormLabel>Issued Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="receivedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Received Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="senderPublicId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender Organization</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.publicId} value={org.publicId}>
                              {org.organizationCode} — {org.organizationName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receiverPublicId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiver Organization</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select receiver" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.publicId} value={org.publicId}>
                              {org.organizationCode} — {org.organizationName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    disabled={submitting || item.status === 'IMPORTED'}
                    onClick={onReject}
                  >
                    <XCircleIcon className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  {item.status === MigrationReviewStatus.PENDING &&
                    item.aiStatus !== MigrationAiStatus.RUNNING &&
                    item.aiStatus !== MigrationAiStatus.DONE && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={handleStartExtract}
                        disabled={submitting}
                      >
                        <RefreshCwIcon className="w-4 h-4 mr-2" />
                        Start Extract
                      </Button>
                    )}
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={
                      submitting ||
                      item.status !== MigrationReviewStatus.PENDING_REVIEW
                    }
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    {submitting ? 'Processing...' : 'Execute Import'}
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
