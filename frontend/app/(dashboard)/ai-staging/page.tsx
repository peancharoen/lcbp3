// File: app/(dashboard)/ai-staging/page.tsx
// Change Log
// - 2026-05-14: เพิ่มหน้า AI staging queue สำหรับ human-in-the-loop review.
'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CheckCircle2, RefreshCcw } from 'lucide-react';
import {
  AiStagingRecord,
  AiStagingStatus,
  useAiStagingQueue,
  useApproveAiStagingRecord,
} from '@/lib/api/ai';
import { projectService } from '@/lib/services/project.service';
import { masterDataService } from '@/lib/services/master-data.service';
import { organizationService } from '@/lib/services/organization.service';
import { useQuery } from '@tanstack/react-query';
import { AiStatusBanner } from '@/components/ai/AiStatusBanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslations } from '@/hooks/use-translations';

interface ProjectOption {
  publicId?: string;
  projectCode?: string;
  projectName?: string;
}

interface OrganizationOption {
  publicId?: string;
  organizationCode?: string;
  organizationName?: string;
}

interface CorrespondenceTypeOption {
  typeCode: string;
  typeName: string;
}

const approveSchema = z.object({
  documentNumber: z.string().min(1),
  subject: z.string().min(1),
  categoryCode: z.string().min(1),
  projectPublicId: z.string().uuid(),
  senderOrganizationPublicId: z.string().uuid().optional(),
  receiverOrganizationPublicId: z.string().uuid().optional(),
  issuedDate: z.string().optional(),
  receivedDate: z.string().optional(),
  body: z.string().optional(),
});

type ApproveFormValues = z.infer<typeof approveSchema>;

const getMetadataText = (
  metadata: Record<string, unknown> | undefined,
  keys: string[]
): string => {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string') return value;
  }
  return '';
};

function getStatusVariant(
  status: AiStagingStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === AiStagingStatus.PENDING) return 'secondary';
  if (status === AiStagingStatus.REJECTED) return 'destructive';
  if (status === AiStagingStatus.IMPORTED) return 'default';
  return 'outline';
}

export default function AiStagingPage() {
  const t = useTranslations();
  const [selectedRecord, setSelectedRecord] = useState<AiStagingRecord | null>(
    null
  );
  const queueQuery = useAiStagingQueue();
  const approveMutation = useApproveAiStagingRecord();
  const projectsQuery = useQuery({
    queryKey: ['ai-staging', 'projects'],
    queryFn: () => projectService.getAll({ isActive: true, limit: 100 }),
  });
  const organizationsQuery = useQuery({
    queryKey: ['ai-staging', 'organizations'],
    queryFn: () => organizationService.getAll({ isActive: true, limit: 200 }),
  });
  const typesQuery = useQuery({
    queryKey: ['ai-staging', 'correspondence-types'],
    queryFn: () => masterDataService.getCorrespondenceTypes(),
  });

  const form = useForm<ApproveFormValues>({
    resolver: zodResolver(approveSchema),
    defaultValues: {
      documentNumber: '',
      subject: '',
      categoryCode: '',
      projectPublicId: '',
      senderOrganizationPublicId: undefined,
      receiverOrganizationPublicId: undefined,
      issuedDate: '',
      receivedDate: '',
      body: '',
    },
  });

  const records = queueQuery.data?.items ?? [];
  const projects = useMemo(
    () => (Array.isArray(projectsQuery.data) ? (projectsQuery.data as ProjectOption[]) : []),
    [projectsQuery.data]
  );
  const organizations = useMemo(
    () =>
      Array.isArray(organizationsQuery.data)
        ? (organizationsQuery.data as OrganizationOption[])
        : [],
    [organizationsQuery.data]
  );
  const correspondenceTypes = useMemo(
    () =>
      Array.isArray(typesQuery.data)
        ? (typesQuery.data as CorrespondenceTypeOption[])
        : [],
    [typesQuery.data]
  );

  const openApprovalDialog = (record: AiStagingRecord): void => {
    const metadata = record.extractedMetadata;
    setSelectedRecord(record);
    form.reset({
      documentNumber: getMetadataText(metadata, ['documentNumber', 'doc_number']),
      subject: getMetadataText(metadata, ['subject', 'title']),
      categoryCode: getMetadataText(metadata, ['categoryCode', 'category']),
      projectPublicId: '',
      senderOrganizationPublicId: undefined,
      receiverOrganizationPublicId: undefined,
      issuedDate: getMetadataText(metadata, ['issuedDate', 'issued_date']),
      receivedDate: getMetadataText(metadata, ['receivedDate', 'received_date']),
      body: getMetadataText(metadata, ['body', 'summary']),
    });
  };

  const onSubmit = async (values: ApproveFormValues): Promise<void> => {
    if (!selectedRecord) return;
    try {
      await approveMutation.mutateAsync({
        publicId: selectedRecord.publicId,
        payload: {
          ...values,
          finalMetadata: values,
        },
      });
      toast.success(t('ai.staging.approveSuccess'));
      setSelectedRecord(null);
    } catch {
      toast.error(t('ai.staging.approveError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {t('ai.staging.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('ai.staging.subtitle')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void queueQuery.refetch()}
          disabled={queueQuery.isFetching}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          {t('ai.staging.refresh')}
        </Button>
      </div>

      <AiStatusBanner isOffline={queueQuery.isError} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ai.staging.file')}</TableHead>
              <TableHead>{t('ai.staging.batch')}</TableHead>
              <TableHead>{t('ai.staging.confidence')}</TableHead>
              <TableHead>{t('ai.staging.status')}</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.publicId}>
                <TableCell className="font-medium">
                  {record.originalFileName}
                  {record.errorReason ? (
                    <p className="text-xs text-destructive">
                      {record.errorReason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>{record.batchId}</TableCell>
                <TableCell>
                  {record.confidenceScore === undefined
                    ? t('ai.staging.empty')
                    : `${Math.round(record.confidenceScore * 100)}%`}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(record.status)}>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    disabled={record.status !== AiStagingStatus.PENDING}
                    onClick={() => openApprovalDialog(record)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('ai.staging.review')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {queueQuery.isLoading
                    ? t('ai.staging.loading')
                    : t('ai.staging.emptyQueue')}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={selectedRecord !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRecord(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('ai.staging.reviewTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="documentNumber">
                  {t('ai.staging.documentNumber')}
                </Label>
                <Input id="documentNumber" {...form.register('documentNumber')} />
              </div>
              <div className="space-y-2">
                <Label>{t('ai.staging.category')}</Label>
                <Select
                  value={form.watch('categoryCode')}
                  onValueChange={(value) =>
                    form.setValue('categoryCode', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('ai.staging.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {correspondenceTypes.map((type) => (
                      <SelectItem key={type.typeCode} value={type.typeCode}>
                        {type.typeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">{t('ai.staging.subject')}</Label>
              <Input id="subject" {...form.register('subject')} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('ai.staging.project')}</Label>
                <Select
                  value={form.watch('projectPublicId')}
                  onValueChange={(value) =>
                    form.setValue('projectPublicId', value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('ai.staging.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem
                        key={project.publicId ?? project.projectCode}
                        value={project.publicId ?? ''}
                      >
                        {project.projectName ?? project.projectCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('ai.staging.sender')}</Label>
                <Select
                  value={form.watch('senderOrganizationPublicId') ?? ''}
                  onValueChange={(value) =>
                    form.setValue('senderOrganizationPublicId', value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('ai.staging.selectSender')} />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem
                        key={organization.publicId ?? organization.organizationCode}
                        value={organization.publicId ?? ''}
                      >
                        {organization.organizationName ??
                          organization.organizationCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('ai.staging.receiver')}</Label>
                <Select
                  value={form.watch('receiverOrganizationPublicId') ?? ''}
                  onValueChange={(value) =>
                    form.setValue('receiverOrganizationPublicId', value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('ai.staging.selectReceiver')} />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem
                        key={organization.publicId ?? organization.organizationCode}
                        value={organization.publicId ?? ''}
                      >
                        {organization.organizationName ??
                          organization.organizationCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="issuedDate">{t('ai.staging.issuedDate')}</Label>
                  <Input id="issuedDate" type="date" {...form.register('issuedDate')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receivedDate">
                    {t('ai.staging.receivedDate')}
                  </Label>
                  <Input
                    id="receivedDate"
                    type="date"
                    {...form.register('receivedDate')}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">{t('ai.staging.body')}</Label>
              <Textarea id="body" rows={5} {...form.register('body')} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={approveMutation.isPending}>
                {t('ai.staging.approve')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
