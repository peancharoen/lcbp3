// File: app/(admin)/admin/migration/review/[id]/page.tsx
// Change Log:
// - 2026-08-31: T041-T045 — เพิ่ม tag accept/reject UI (US3): tag chips พร้อม isNew badge,
//   evidence tooltip, accept/reject buttons, tagDecisions ใน commit payload (FR-006, ADR-050)
// - 2026-08-31: T037-T040 — เพิ่ม ocrQuality section, metadata.confidence badges, acknowledge controls,
//   422 unresolvedFields inline warnings, wire commit ผ่าน useCommitMigrationReview (ADR-050)
// - 2026-08-23: อ่าน sourceFilePath/disciplineId จาก details, ส่ง disciplineId (INT), ใช้ item.projectId
// - 2026-05-22: Initial creation of Migration Review detail page (T024)
// - 2026-08-06: เพิ่ม CompareResultTable และ fieldResolutions state สำหรับ Feature 242 (FR-011, FR-012c)
// - 2026-08-22: เปลี่ยน Sender/Receiver/Discipline เป็น dropdown, แก้ date mapping
// - 2026-08-23: Pretty print error response สำหรับ debug
//   (Doc Date = issued_date จาก excel → document_date, Received Date = received_date),
//   เปลี่ยน label "Issued Date" → "Received Date"
// - 2026-08-25: เพิ่ม remarks field (Excel "หมายเหตุ" → correspondence_revisions.remarks)
// - 2026-08-25: แก้ iframe 401 โดยใช้ StagingFileViewer (auth-via-blob pattern)

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { migrationService } from '@/lib/services/migration.service';
import { organizationService } from '@/lib/services/organization.service';
import { masterDataService } from '@/lib/services/master-data.service';
import { useCommitMigrationReview } from '@/hooks/use-migration-review';
import {
  MigrationReviewQueueItem,
  FieldResolution,
  MigrationReviewStatus,
  MigrationAiStatus,
  MigrationOcrQualityAssessment,
  MigrationMetadataConfidence,
  MigrationTagSuggestion,
} from '@/types/migration';
import { Organization } from '@/types/organization';
import { Discipline, CorrespondenceType } from '@/types/master-data';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription as _FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon, ShieldAlertIcon, AlertTriangleIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { CompareResultTable } from '@/components/migration/compare-result-table';
import { OcrTextEditor } from '@/components/migration/ocr-text-editor';
import { StagingFileViewer } from '@/components/migration/staging-file-viewer';
import aiMessages from '@/public/locales/th/ai.json';

/** ADR-050: i18n helper สำหรับ migration_review namespace จาก ai.json (เดียวกับ review-queue-table.tsx) */
const migrationReviewT = (key: string): string => {
  const parts = key.split('.');
  let current: unknown = (aiMessages as Record<string, unknown>).migration_review;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
};

/** ADR-050: field ที่รองรับการ acknowledge (FR-013/FR-014) */
type AcknowledgeableField = 'ocrQuality' | 'summary' | 'category' | 'tags';

/** ADR-050 (T043): สถานะการตัดสินใจของผู้ตรวจสอบต่อ tag suggestion
 *  'pending' = ยังไม่ตัดสินใจ (default), 'accepted' = ยอมรับ, 'rejected' = ปฏิเสธ */
type TagDecision = 'pending' | 'accepted' | 'rejected';

/** ดึง ocrQuality จาก details อย่างปลอดภัย (รองรับ legacy shape ที่ไม่มี field นี้) */
const getOcrQuality = (details: MigrationReviewQueueItem['details']): MigrationOcrQualityAssessment | null => {
  if (!details || typeof details !== 'object') return null;
  const ocrQuality = (details as Record<string, unknown>).ocrQuality;
  if (!ocrQuality || typeof ocrQuality !== 'object') return null;
  return ocrQuality as MigrationOcrQualityAssessment;
};

/** ดึง metadata.confidence จาก details อย่างปลอดภัย */
const getMetadataConfidence = (details: MigrationReviewQueueItem['details']): MigrationMetadataConfidence | null => {
  if (!details || typeof details !== 'object') return null;
  const metadata = (details as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const confidence = (metadata as Record<string, unknown>).confidence;
  if (!confidence || typeof confidence !== 'object') return null;
  return confidence as MigrationMetadataConfidence;
};

/** ADR-050 (T042): ดึง metadata.tags จาก details อย่างปลอดภัย (FR-006)
 *  คืน array ของ MigrationTagSuggestion หรือ empty array ถ้าไม่มี */
const getTagSuggestions = (details: MigrationReviewQueueItem['details']): MigrationTagSuggestion[] => {
  if (!details || typeof details !== 'object') return [];
  const metadata = (details as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== 'object') return [];
  const tags = (metadata as Record<string, unknown>).tags;
  if (!Array.isArray(tags)) return [];
  return tags as MigrationTagSuggestion[];
};

/** แปลง confidence 0-1 เป็น percentage string */
const formatConfidence = (confidence: number): string => `${(confidence * 100).toFixed(1)}%`;

/** สีตามระดับ confidence */
const getConfidenceColor = (confidence: number): string => {
  if (confidence < 0.5) return 'text-red-600';
  if (confidence < 0.75) return 'text-yellow-600';
  return 'text-green-600';
};

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
  remarks: z.string().optional(),
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
  // ADR-050 (T039): fieldAcknowledgments — field ที่ผู้ตรวจสอบรับทราบ confidence ต่ำโดยไม่แก้ไขค่า (FR-013/FR-014)
  const [fieldAcknowledgments, setFieldAcknowledgments] = useState<AcknowledgeableField[]>([]);
  // ADR-050 (T043): tagDecisions — สถานะการตัดสินใจต่อ tag suggestion รายตัว (FR-006)
  //  key = tag name, value = 'accepted' | 'rejected' (default 'pending' = ไม่อยู่ใน map)
  const [tagDecisions, setTagDecisions] = useState<Record<string, TagDecision>>({});
  // ADR-050 (T040): commit error state สำหรับ inline per-field warnings
  const [commitError, setCommitError] = useState<{
    unresolvedFields?: string[];
    categoryError?: string;
  } | null>(null);
  // ADR-050 (T039): commit hook — POST /ai/migration/review (new contract path)
  const commitMutation = useCommitMigrationReview();
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
      remarks: '',
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
            subject: res.subject || res.originalSubject || '',
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
            // remarks จาก Excel (column "หมายเหตุ") — stored บน queueItem
            remarks: res.remarks || '',
          });
        }
      } catch (error: unknown) {
        // เก็บ error object สำหรับ pretty print บนหน้า
        // รองรับทั้ง structured error จาก interceptor ({ error: {...} })
        // และ raw Axios error ({ response: { data: {...} } })
        const err = error as {
          error?: Record<string, unknown>;
          response?: { data?: Record<string, unknown> };
        };
        setLoadError(err?.error ?? err?.response?.data ?? { message: String(error) });
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
    if (!item.publicId) {
      toast.error('Invalid item publicId');
      return;
    }
    try {
      setSubmitting(true);
      setCommitError(null);
      const idempotencyKey = `review-${item.publicId}-${Date.now()}`;
      // ADR-050 (T039): commit ผ่าน useCommitMigrationReview (POST /ai/migration/review)
      // ส่ง fieldAcknowledgments สำหรับ field ที่ผู้ตรวจสอบรับทราบ confidence ต่ำ (FR-013/FR-014)
      // ส่ง fieldResolutions สำหรับ Feature 242 (FR-011b)
      // ADR-050 (T044): ส่ง tagDecisions สำหรับ tag ที่ผู้ตรวจสอบตัดสินใจ (FR-006/FR-008)
      //   Backend (migration-review.service.ts:757-781) iterate ทุก entry ใน tagDecisions[]
      //   ตรงๆ ไม่ได้ diff กับ AI suggestions ใดๆ — จึงต้องส่งทั้ง accepted และ rejected
      //   entries ครบทุกตัวที่ผู้ตรวจสอบตัดสินใจแล้ว มิฉะนั้น (a) rejected tag จะไม่ถูกบันทึก
      //   ai_audit_logs (FR-008) และ (b) ถ้า reject ทุก tag, payload จะว่างเปล่า ทำให้ backend
      //   มองว่า tags field ยังไม่ถูก review เลย (ค้าง unresolved ตลอดไป — FR-014)
      //   - accepted tags: { name, accepted: true, evidence }
      //   - rejected tags: { name, accepted: false, evidence }
      //   - pending tags (ยังไม่ตัดสินใจ): ไม่ส่ง
      //   การส่ง tagDecisions ที่ไม่ว่าง = review action สำหรับ tags field (edited=true, T045)
      const tagSuggestions = getTagSuggestions(item.details);
      const reviewedTagDecisions = tagSuggestions
        .filter((tag) => tagDecisions[tag.name] === 'accepted' || tagDecisions[tag.name] === 'rejected')
        .map((tag) => ({
          name: tag.name,
          accepted: tagDecisions[tag.name] === 'accepted',
          evidence: tag.evidence,
        }));
      const commitPayload = {
        publicId: item.publicId,
        idempotencyKey,
        subject: values.subject,
        category: values.category,
        projectId: item.projectId || 1,
        issuedDate: values.documentDate || undefined,
        receivedDate: values.receivedDate || undefined,
        senderId: values.senderPublicId || undefined,
        receiverId: values.receiverPublicId || undefined,
        body: values.remarks || undefined,
        fieldAcknowledgments: fieldAcknowledgments.length > 0 ? fieldAcknowledgments : undefined,
        fieldResolutions: fieldResolutions.length > 0 ? fieldResolutions : undefined,
        tagDecisions: reviewedTagDecisions.length > 0 ? reviewedTagDecisions : undefined,
      };
      await commitMutation.mutateAsync(commitPayload);
      // hook จัดการ toast.success + query invalidation เอง
      router.push('/admin/migration');
    } catch (error: unknown) {
      // ADR-050 (T040): แยก error ตามประเภทเพื่อแสดง inline per-field warnings
      const err = error as {
        error?: {
          code?: string;
          unresolvedFields?: string[];
          message?: string;
          statusCode?: number;
        };
      };
      const errorObj = err?.error;
      if (errorObj?.code === 'UNRESOLVED_FIELDS' && Array.isArray(errorObj.unresolvedFields)) {
        setCommitError({ unresolvedFields: errorObj.unresolvedFields });
      } else if (errorObj?.code === 'CATEGORY_NOT_ALLOWED') {
        setCommitError({ categoryError: errorObj.message || 'หมวดหมู่ไม่ถูกต้อง' });
      }
      // hook จัดการ toast.error เอง — ไม่ toast ซ้ำ
    } finally {
      setSubmitting(false);
    }
  };

  /** ADR-050 (T039): toggle field acknowledgment — เพิ่ม/ลบ field จาก fieldAcknowledgments */
  const toggleAcknowledgment = (field: AcknowledgeableField) => {
    setFieldAcknowledgments((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  /** ADR-050 (T043): toggle tag decision — ตั้งค่า tag เป็น 'accepted' หรือ 'rejected'
   *  ถ้าคลิกปุ่มเดิมซ้ำจะกลับเป็น 'pending' (toggle off) */
  const toggleTagDecision = (tagName: string, decision: 'accepted' | 'rejected') => {
    setTagDecisions((prev) => {
      const current = prev[tagName];
      if (current === decision) {
        // คลิกซ้ำ → กลับเป็น pending (ลบออกจาก map)
        const next = { ...prev };
        delete next[tagName];
        return next;
      }
      return { ...prev, [tagName]: decision };
    });
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

  // ADR-050 (T037): ดึง diagnostic data จาก details
  const ocrQuality = getOcrQuality(item.details);
  const metadataConfidence = getMetadataConfidence(item.details);
  // ADR-050 (T042): ดึง tag suggestions จาก details.metadata.tags (FR-006)
  const tagSuggestions = getTagSuggestions(item.details);
  const aiIssuesKeyPoints = (item.aiIssues as MigrationAiIssues)?.keyPoints;
  // aiIssues อาจเป็น array ของ issue objects หรือ object ที่มี keyPoints — รองรับทั้งสองกรณี
  const aiIssuesArray = Array.isArray(item.aiIssues) ? item.aiIssues : [];
  const hasAiIssues = (aiIssuesKeyPoints && aiIssuesKeyPoints.length > 0) || aiIssuesArray.length > 0;

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
              <StagingFileViewer sourceFilePath={sourceFilePath} />
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

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="หมายเหตุจาก Excel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ADR-050 (T040): 422 unresolvedFields inline warning */}
                {commitError?.unresolvedFields && commitError.unresolvedFields.length > 0 && (
                  <div
                    data-testid="unresolved-fields-warning"
                    className="mt-4 p-3 rounded-md border border-red-300 bg-red-50 text-sm"
                  >
                    <div className="flex items-center gap-2 font-semibold text-red-700">
                      <AlertTriangleIcon className="h-4 w-4" />
                      {migrationReviewT('commit_unresolved_fields_error').replace(
                        '{{fields}}',
                        commitError.unresolvedFields.join(', ')
                      )}
                    </div>
                  </div>
                )}

                {/* ADR-050 (T037): OCR Quality section — "hard to read" diagnostic (FR-004)
                    distinct block จาก metadata.confidence และ aiIssues (FR-009, /106 finding I1) */}
                {ocrQuality && (
                  <div
                    data-testid="ocr-quality-section"
                    className="mt-4 p-3 rounded-md border border-blue-200 bg-blue-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-1.5 text-blue-700">
                        <ShieldAlertIcon className="h-4 w-4" />
                        {migrationReviewT('ocr_quality_title')}
                      </h3>
                      <span className={`font-mono text-sm font-semibold ${getConfidenceColor(ocrQuality.confidence)}`}>
                        {migrationReviewT('ocr_quality_confidence')}: {formatConfidence(ocrQuality.confidence)}
                      </span>
                    </div>
                    {ocrQuality.issues.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          {migrationReviewT('ocr_quality_issues')}
                        </p>
                        {ocrQuality.issues.map((issue, idx) => (
                          <div key={idx} className="text-xs space-y-0.5 pl-2 border-l-2 border-blue-200">
                            <p className="font-medium text-blue-800">{issue.type}</p>
                            <p className="text-muted-foreground">{issue.message}</p>
                            {issue.evidence && (
                              <p className="text-muted-foreground/70 italic">"{issue.evidence}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* T039: acknowledge button for ocrQuality */}
                    <Button
                      type="button"
                      variant={fieldAcknowledgments.includes('ocrQuality') ? 'default' : 'outline'}
                      size="sm"
                      data-testid="acknowledge-ocrQuality"
                      onClick={() => toggleAcknowledgment('ocrQuality')}
                      className="w-full"
                    >
                      {fieldAcknowledgments.includes('ocrQuality') ? `✓ ${migrationReviewT('acknowledged')}` : migrationReviewT('acknowledge_ocr_quality')}
                    </Button>
                  </div>
                )}

                {/* ADR-050 (T038): Metadata Confidence section — "hard to classify" diagnostic
                    per-field badges สำหรับ summary, category, tags (FR-005/FR-006) */}
                {metadataConfidence && (
                  <div
                    data-testid="metadata-confidence-section"
                    className="mt-4 p-3 rounded-md border border-amber-200 bg-amber-50/50 space-y-2"
                  >
                    <h3 className="font-semibold text-sm text-amber-700">{migrationReviewT('metadata_confidence_title')}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Summary: <span className={`ml-1 font-mono font-semibold ${getConfidenceColor(metadataConfidence.summary)}`}>
                          {formatConfidence(metadataConfidence.summary)}
                        </span>
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Category: <span className={`ml-1 font-mono font-semibold ${getConfidenceColor(metadataConfidence.category)}`}>
                          {formatConfidence(metadataConfidence.category)}
                        </span>
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Tags: <span className={`ml-1 font-mono font-semibold ${getConfidenceColor(metadataConfidence.tags)}`}>
                          {formatConfidence(metadataConfidence.tags)}
                        </span>
                      </Badge>
                    </div>
                    {/* T039: acknowledge buttons for summary and category */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={fieldAcknowledgments.includes('summary') ? 'default' : 'outline'}
                        size="sm"
                        data-testid="acknowledge-summary"
                        onClick={() => toggleAcknowledgment('summary')}
                        className="flex-1"
                      >
                        {fieldAcknowledgments.includes('summary') ? `✓ ${migrationReviewT('acknowledged')}` : migrationReviewT('ack_summary')}
                      </Button>
                      <Button
                        type="button"
                        variant={fieldAcknowledgments.includes('category') ? 'default' : 'outline'}
                        size="sm"
                        data-testid="acknowledge-category"
                        onClick={() => toggleAcknowledgment('category')}
                        className="flex-1"
                      >
                        {fieldAcknowledgments.includes('category') ? `✓ ${migrationReviewT('acknowledged')}` : migrationReviewT('ack_category')}
                      </Button>
                      {/* Orchestrator review fix: when metadata.tags is empty but confidence.tags is
                          still low, there are no tag chips to accept/reject (see the section below,
                          which only renders when tagSuggestions.length > 0) — without this button the
                          "tags" field could never be resolved, permanently blocking commit (FR-014) */}
                      {tagSuggestions.length === 0 && (
                        <Button
                          type="button"
                          variant={fieldAcknowledgments.includes('tags') ? 'default' : 'outline'}
                          size="sm"
                          data-testid="acknowledge-tags"
                          onClick={() => toggleAcknowledgment('tags')}
                          className="flex-1"
                        >
                          {fieldAcknowledgments.includes('tags') ? `✓ ${migrationReviewT('acknowledged')}` : migrationReviewT('ack_tags')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* ADR-050 (T040): category-invalid inline warning */}
                {commitError?.categoryError && (
                  <div
                    data-testid="category-error-warning"
                    className="mt-2 p-2 rounded-md border border-red-300 bg-red-50 text-xs text-red-700"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangleIcon className="h-3.5 w-3.5" />
                      {commitError.categoryError}
                    </div>
                  </div>
                )}

                {/* ADR-050 (T042-T043): Tag Suggestions — chip พร้อม accept/reject (FR-006)
                    แต่ละ chip แสดง name, isNew badge, evidence tooltip (title attribute)
                    ปุ่ม Accept/Reject สำหรับ tag รายตัว — default 'pending' */}
                {tagSuggestions.length > 0 && (
                  <div
                    data-testid="tag-suggestions-section"
                    className="mt-4 p-3 rounded-md border border-purple-200 bg-purple-50/50 space-y-2"
                  >
                    <h3 className="font-semibold text-sm text-purple-700">
                      {migrationReviewT('tag_suggestions_title')}
                    </h3>
                    <div className="space-y-2">
                      {tagSuggestions.map((tag) => {
                        const decision = tagDecisions[tag.name] ?? 'pending';
                        return (
                          <div
                            key={tag.name}
                            data-testid={`tag-chip-${tag.name}`}
                            title={tag.evidence}
                            className="flex items-center gap-2 p-2 rounded-md border border-purple-200 bg-white"
                          >
                            <span className="text-sm font-medium flex-1">{tag.name}</span>
                            {tag.isNew && (
                              <Badge
                                data-testid={`tag-is-new-badge-${tag.name}`}
                                variant="secondary"
                                className="text-xs bg-purple-100 text-purple-700"
                              >
                                {migrationReviewT('tag_is_new_badge')}
                              </Badge>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={decision === 'accepted' ? 'default' : 'outline'}
                              data-testid={`tag-accept-${tag.name}`}
                              data-active={decision === 'accepted' ? 'true' : 'false'}
                              onClick={() => toggleTagDecision(tag.name, 'accepted')}
                              className="h-7 px-2 text-xs"
                            >
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              {migrationReviewT('tag_accept')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={decision === 'rejected' ? 'destructive' : 'outline'}
                              data-testid={`tag-reject-${tag.name}`}
                              data-active={decision === 'rejected' ? 'true' : 'false'}
                              onClick={() => toggleTagDecision(tag.name, 'rejected')}
                              className="h-7 px-2 text-xs"
                            >
                              <XCircleIcon className="h-3 w-3 mr-1" />
                              {migrationReviewT('tag_reject')}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ADR-050 (T037): aiIssues — business validation issues (FR-009, /106 finding I1)
                    แยกจาก ocrQuality — ไม่ merge หรือ relabel */}
                {hasAiIssues && (
                  <div data-testid="ai-issues-section" className="mt-6 border-t pt-4">
                    <h3 className="font-semibold text-sm mb-2 text-muted-foreground">AI Extracted Key Points</h3>
                    {aiIssuesKeyPoints && aiIssuesKeyPoints.length > 0 && (
                      <ul className="text-sm space-y-1 list-disc pl-4 text-muted-foreground">
                        {aiIssuesKeyPoints.map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    )}
                    {aiIssuesArray.length > 0 && (
                      <ul className="text-sm space-y-1 list-disc pl-4 text-muted-foreground">
                        {aiIssuesArray.map((issue, i) => {
                          const msg = typeof issue === 'object' && issue !== null && 'message' in issue
                            ? String((issue as Record<string, unknown>).message)
                            : String(issue);
                          return <li key={i}>{msg}</li>;
                        })}
                      </ul>
                    )}
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
                    item.aiStatus !== MigrationAiStatus.DONE &&
                    item.aiStatus !== MigrationAiStatus.WAITING && (
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
