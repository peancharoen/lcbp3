'use client';

import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUploadZone } from '@/components/custom/file-upload-zone';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCreateCorrespondence, useUpdateCorrespondence } from '@/hooks/use-correspondence';
import { Organization } from '@/types/organization';
import { useOrganizations, useProjects, useCorrespondenceTypes, useDisciplines, useContracts } from '@/hooks/use-master-data';
import { CreateCorrespondenceDto } from '@/types/dto/correspondence/create-correspondence.dto';
import { useState, useEffect } from 'react';
import { correspondenceService as _correspondenceService } from '@/lib/services/correspondence.service';
import { numberingApi } from '@/lib/api/numbering';
import { filesApi } from '@/lib/api/files';

// Updated Zod Schema with all required fields
const correspondenceSchema = z.object({
  projectId: z.string().min(1, 'Please select a Project'),
  contractId: z.string().min(1, 'Please select a Contract'),
  documentTypeId: z.number().min(1, 'Please select a Document Type'),
  disciplineId: z.number().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  dueDate: z.string().optional(), // ISO Date string
  documentDate: z.string().optional(),
  issuedDate: z.string().optional(),
  receivedDate: z.string().optional(),
  fromOrganizationId: z.string().min(1, 'Please select From Organization'),
  toOrganizationId: z.string().min(1, 'Please select To Organization'),
  ccOrganizationIds: z.array(z.string()).optional(), // CC organizations support
  importance: z.enum(['NORMAL', 'HIGH', 'URGENT']),
  attachments: z.array(z.instanceof(File)).optional(),
});

type FormData = z.infer<typeof correspondenceSchema>;

type ProjectOption = {
  publicId?: string;
  uuid?: string;
  id?: number;
  projectName: string;
  projectCode: string;
};

type ContractOption = {
  publicId?: string;
  contractName?: string;
  contractCode?: string;
};

type CorrespondenceTypeOption = {
  id: number;
  typeName: string;
  typeCode: string;
};

interface DisciplineOption {
  id: number;
  disciplineCode: string;
  codeNameEn?: string;
}

interface InitialCorrespondenceData {
  projectId?: number | string;
  project?: { uuid?: string };
  correspondenceTypeId?: number;
  disciplineId?: number;
  revisions?: Array<{
    isCurrent?: boolean;
    subject?: string;
    title?: string;
    description?: string;
    body?: string;
    remarks?: string;
    dueDate?: string;
    documentDate?: string;
    issuedDate?: string;
    receivedDate?: string;
    details?: { importance: 'NORMAL' | 'HIGH' | 'URGENT' };
  }>;
  originatorId?: number;
  recipients?: Array<{
    recipientType: string;
    recipientOrganizationId: number;
  }>;
  correspondenceNumber?: string;
}

const extractArrayData = <T,>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

export function CorrespondenceForm({ initialData, uuid }: { initialData?: InitialCorrespondenceData; uuid?: string }) {
  const router = useRouter();
  const createMutation = useCreateCorrespondence();
  const updateMutation = useUpdateCorrespondence();

  // Fetch master data for dropdowns
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const { data: organizations, isLoading: isLoadingOrgs } = useOrganizations();
  const { data: correspondenceTypesData, isLoading: isLoadingTypes } = useCorrespondenceTypes();
  const projects = (projectsData as ProjectOption[]) ?? [];
  const organizationOptions = extractArrayData<Organization>(organizations);
  const correspondenceTypes = extractArrayData<CorrespondenceTypeOption>(correspondenceTypesData);

  // Extract initial values if editing
  const currentRev = initialData?.revisions?.find((r) => r.isCurrent) || initialData?.revisions?.[0];
  const defaultValues: Partial<FormData> = {
    projectId: initialData?.project?.uuid || (initialData?.projectId ? String(initialData.projectId) : undefined),
    documentTypeId: initialData?.correspondenceTypeId || undefined,
    disciplineId: initialData?.disciplineId || undefined,
    subject: currentRev?.subject || currentRev?.title || '',
    description: currentRev?.description || '',
    body: currentRev?.body || '',
    remarks: currentRev?.remarks || '',
    dueDate: currentRev?.dueDate ? new Date(currentRev.dueDate).toISOString().split('T')[0] : undefined,
    documentDate: currentRev?.documentDate ? new Date(currentRev.documentDate).toISOString().split('T')[0] : undefined,
    issuedDate: currentRev?.issuedDate ? new Date(currentRev.issuedDate).toISOString().split('T')[0] : undefined,
    receivedDate: currentRev?.receivedDate ? new Date(currentRev.receivedDate).toISOString().split('T')[0] : undefined,
    fromOrganizationId: initialData?.originatorId ? String(initialData.originatorId) : undefined,
    // Map initial recipient (TO) - Simplified for now
    toOrganizationId: initialData?.recipients?.find((r) => r.recipientType === 'TO')?.recipientOrganizationId
      ? String(initialData.recipients.find((r) => r.recipientType === 'TO')?.recipientOrganizationId)
      : undefined,
    importance: currentRev?.details?.importance || 'NORMAL',
  } as Partial<FormData>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // @ts-ignore: Zod version mismatch
    resolver: zodResolver(correspondenceSchema) as unknown as Resolver<FormData>,
    defaultValues: defaultValues as FormData,
  });

  // Watch for controlled inputs
  const projectId = watch('projectId');
  const contractId = watch('contractId');
  const documentTypeId = watch('documentTypeId');
  const disciplineId = watch('disciplineId');
  const fromOrgId = watch('fromOrganizationId');
  const toOrgId = watch('toOrganizationId');

  // Fetch contracts based on selected project
  const { data: contractsData, isLoading: isLoadingContracts } = useContracts(projectId);
  const contracts = extractArrayData<ContractOption>(contractsData);

  // Fetch disciplines based on selected contract
  const { data: disciplinesData, isLoading: isLoadingDisciplines } = useDisciplines(contractId);
  const disciplines = extractArrayData<DisciplineOption>(disciplinesData);

  // Reset dependent fields when project changes
  useEffect(() => {
    if (projectId) {
      setValue('contractId', '');
      setValue('disciplineId', undefined);
    }
  }, [projectId, setValue]);

  // Reset discipline when contract changes
  useEffect(() => {
    if (contractId) {
      setValue('disciplineId', undefined);
    }
  }, [contractId, setValue]);

  const [isUploading, setIsUploading] = useState(false);

  const onSubmit = async (data: FormData) => {
    // Build recipients array with TO and CC
    const recipients = [
      { organizationId: data.toOrganizationId, type: 'TO' as const },
      ...(data.ccOrganizationIds?.map(orgId => ({ organizationId: orgId, type: 'CC' as const })) || [])
    ];

    // Phase 1: Upload attachments to temp storage
    let attachmentTempIds: string[] | undefined;
    const validFiles = (data.attachments || []).filter((f): f is File => f instanceof File && !('validationError' in f && (f as { validationError?: string }).validationError));
    if (validFiles.length > 0) {
      setIsUploading(true);
      try {
        const uploaded = await filesApi.uploadMany(validFiles);
        attachmentTempIds = uploaded.map((u) => u.tempId);
      } catch (_err) {
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const payload: CreateCorrespondenceDto = {
      projectId: data.projectId,
      typeId: data.documentTypeId,
      disciplineId: data.disciplineId,
      subject: data.subject,
      description: data.description,
      body: data.body,
      remarks: data.remarks,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      documentDate: data.documentDate ? new Date(data.documentDate).toISOString() : undefined,
      issuedDate: data.issuedDate ? new Date(data.issuedDate).toISOString() : undefined,
      receivedDate: data.receivedDate ? new Date(data.receivedDate).toISOString() : undefined,
      originatorId: data.fromOrganizationId,
      attachmentTempIds,
      recipients,
      details: {
        importance: data.importance,
      },
    };

    if (uuid && initialData) {
      updateMutation.mutate(
        { uuid, data: payload },
        { onSuccess: () => router.push(`/correspondences/${uuid}`) }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => router.push('/correspondences'),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isUploading;

  // -- Preview Logic --
  const [preview, setPreview] = useState<{ number: string; isDefaultTemplate: boolean } | null>(null);

  useEffect(() => {
    if (!projectId || !documentTypeId || !fromOrgId || !toOrgId) {
      setPreview(null);
      return;
    }

    const fetchPreview = async () => {
      try {
        const res = await numberingApi.previewNumber({
          projectId,
          correspondenceTypeId: documentTypeId,
          disciplineId,
          originatorOrganizationId: fromOrgId,
          recipientOrganizationId: toOrgId,
        });
        setPreview({ number: res.previewNumber, isDefaultTemplate: res.isDefault });
      } catch (_err) {
        setPreview(null);
      }
    };

    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [projectId, documentTypeId, disciplineId, fromOrgId, toOrgId]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      {/* Existing Document Number (Read Only) */}
      {initialData?.correspondenceNumber && (
        <div className="space-y-2">
          <Label>Current Document Number</Label>
          <div className="flex items-center gap-2">
            <Input
              value={initialData.correspondenceNumber}
              disabled
              readOnly
              className="bg-muted font-mono font-bold text-lg w-full"
            />
            {preview && preview.number !== initialData.correspondenceNumber && (
              <span className="text-xs text-amber-600 font-semibold whitespace-nowrap px-2">Start Change Detected</span>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <div
          className={`p-4 rounded-md border ${preview.number !== initialData?.correspondenceNumber ? 'bg-amber-50 border-amber-200' : 'bg-muted border-border'}`}
        >
          <p className="text-sm font-semibold mb-1 flex items-center gap-2">
            {initialData?.correspondenceNumber ? 'New Document Number (Preview)' : 'Document Number Preview'}
            {preview.number !== initialData?.correspondenceNumber && initialData?.correspondenceNumber && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                Will Update
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <span
              className={`text-xl font-bold font-mono tracking-wide ${preview.number !== initialData?.correspondenceNumber ? 'text-amber-700' : 'text-primary'}`}
            >
              {preview.number}
            </span>
            {preview.isDefaultTemplate && (
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                Default Template
              </span>
            )}
          </div>
          {preview.number !== initialData?.correspondenceNumber && initialData?.correspondenceNumber && (
            <p className="text-xs text-muted-foreground mt-2">
              * The document number will be regenerated because critical fields were changed.
            </p>
          )}
        </div>
      )}

      {/* Document Metadata Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Dropdown */}
        <div className="space-y-2">
          <Label>Project *</Label>
          <Select
            onValueChange={(v) => setValue('projectId', v)}
            value={projectId || undefined}
            disabled={isLoadingProjects}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingProjects ? 'Loading...' : 'Select Project'} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.publicId || String(p.id)} value={p.publicId || String(p.id)}>
                  {p.projectName} ({p.projectCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.projectId && <p className="text-sm text-destructive">{errors.projectId.message}</p>}
        </div>

        {/* Contract Dropdown */}
        <div className="space-y-2">
          <Label>Contract *</Label>
          <Select
            onValueChange={(v) => setValue('contractId', v)}
            value={contractId || undefined}
            disabled={!projectId || isLoadingContracts}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingContracts ? 'Loading...' : 'Select Contract'} />
            </SelectTrigger>
            <SelectContent>
              {contracts.map((c) => {
                const contractValue = c.publicId;

                if (!contractValue) {
                  return null;
                }

                return (
                  <SelectItem key={contractValue} value={contractValue}>
                    {c.contractName || c.contractCode}
                  </SelectItem>
                );
              })}
              {!isLoadingContracts && contracts.length === 0 && (
                <SelectItem value="__no_contract_available__" disabled>
                  No contracts found for this project
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {errors.contractId && <p className="text-sm text-destructive">{errors.contractId.message}</p>}
        </div>

        {/* Document Type Dropdown */}
        <div className="space-y-2">
          <Label>Document Type *</Label>
          <Select
            onValueChange={(v) => setValue('documentTypeId', Number(v))}
            value={documentTypeId ? String(documentTypeId) : undefined}
            disabled={isLoadingTypes}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingTypes ? 'Loading...' : 'Select Type'} />
            </SelectTrigger>
            <SelectContent>
              {correspondenceTypes.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.typeName} ({t.typeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.documentTypeId && <p className="text-sm text-destructive">{errors.documentTypeId.message}</p>}
        </div>

        {/* Discipline Dropdown (Optional) */}
        <div className="space-y-2">
          <Label>Discipline</Label>
          <Select
            onValueChange={(v) => setValue('disciplineId', v ? Number(v) : undefined)}
            value={disciplineId ? String(disciplineId) : undefined}
            disabled={!contractId || isLoadingDisciplines}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingDisciplines ? 'Loading...' : 'Select Discipline (Optional)'} />
            </SelectTrigger>
            <SelectContent>
              {disciplines.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.codeNameEn || d.disciplineCode}
                </SelectItem>
              ))}
              {!isLoadingDisciplines && disciplines.length === 0 && (
                <SelectItem value="__no_discipline_available__" disabled>
                  No disciplines found for this contract
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Organizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>From Organization *</Label>
          <Select
            onValueChange={(v) => setValue('fromOrganizationId', v)}
            value={fromOrgId || undefined}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? 'Loading...' : 'Select Organization'} />
            </SelectTrigger>
            <SelectContent>
              {organizationOptions.map((org) => (
                <SelectItem key={org.publicId} value={org.publicId}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.fromOrganizationId && <p className="text-sm text-destructive">{errors.fromOrganizationId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>To Organization *</Label>
          <Select
            onValueChange={(v) => setValue('toOrganizationId', v)}
            value={toOrgId || undefined}
            disabled={isLoadingOrgs}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingOrgs ? 'Loading...' : 'Select Organization'} />
            </SelectTrigger>
            <SelectContent>
              {organizationOptions.map((org) => (
                <SelectItem key={org.publicId} value={org.publicId}>
                  {org.organizationName} ({org.organizationCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.toOrganizationId && <p className="text-sm text-destructive">{errors.toOrganizationId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>CC Organizations (Optional)</Label>
          <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
            {organizationOptions
              .filter(org => org.publicId !== toOrgId) // Exclude TO organization
              .map((org) => (
                <div key={org.publicId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cc-${org.publicId}`}
                    checked={watch('ccOrganizationIds')?.includes(org.publicId) || false}
                    onCheckedChange={(checked) => {
                      const currentCC = watch('ccOrganizationIds') || [];
                      if (checked) {
                        setValue('ccOrganizationIds', [...currentCC, org.publicId]);
                      } else {
                        setValue('ccOrganizationIds', currentCC.filter(id => id !== org.publicId));
                      }
                    }}
                  />
                  <Label htmlFor={`cc-${org.publicId}`} className="text-sm">
                    {org.organizationName} ({org.organizationCode})
                  </Label>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Select organizations to receive a copy of this correspondence
          </p>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" {...register('subject')} placeholder="Enter subject" />
        {errors.subject && <p className="text-sm text-destructive">{errors.subject.message}</p>}
      </div>

      {/* Body */}
      <div className="space-y-2">
        <Label htmlFor="body">Body (Content)</Label>
        <Textarea id="body" {...register('body')} rows={6} placeholder="Enter letter content..." />
      </div>

      {/* Date Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="documentDate">Document Date</Label>
          <Input
            id="documentDate"
            type="date"
            {...register('documentDate')}
            onChange={(e) => {
              const val = e.target.value;
              setValue('documentDate', val, { shouldValidate: true, shouldDirty: true });
              if (val) {
                setValue('issuedDate', val, { shouldValidate: true, shouldDirty: true });
                setValue('receivedDate', val, { shouldValidate: true, shouldDirty: true });
                const d = new Date(val);
                d.setDate(d.getDate() + 7);
                setValue('dueDate', d.toISOString().split('T')[0], { shouldValidate: true, shouldDirty: true });
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuedDate">Issued Date</Label>
          <Input id="issuedDate" type="date" {...register('issuedDate')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receivedDate">Received Date</Label>
          <Input
            id="receivedDate"
            type="date"
            {...register('receivedDate')}
            onChange={(e) => {
              const val = e.target.value;
              setValue('receivedDate', val, { shouldValidate: true, shouldDirty: true });
              if (val) {
                const d = new Date(val);
                d.setDate(d.getDate() + 7);
                setValue('dueDate', d.toISOString().split('T')[0], { shouldValidate: true, shouldDirty: true });
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" type="date" {...register('dueDate')} />
        </div>
      </div>

      {/* Remarks */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="remarks">Remarks</Label>
          <Input id="remarks" {...register('remarks')} placeholder="Optional remarks" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (Internal Note)</Label>
        <Textarea id="description" {...register('description')} rows={2} placeholder="Enter description..." />
      </div>

      {/* Importance */}
      <div className="space-y-2">
        <Label>Importance</Label>
        <div className="flex gap-6 mt-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="radio" value="NORMAL" {...register('importance')} className="accent-primary" />
            <span>Normal</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="radio" value="HIGH" {...register('importance')} className="accent-primary" />
            <span>High</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="radio" value="URGENT" {...register('importance')} className="accent-primary" />
            <span>Urgent</span>
          </label>
        </div>
      </div>

      {/* Attachments (only for new documents) */}
      {!initialData && (
        <div className="space-y-2">
          <Label>Attachments</Label>
          <FileUploadZone
            onFilesChanged={(files) => setValue('attachments', files)}
            multiple
            accept={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png']}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUploading ? 'Uploading files...' : uuid ? 'Update Correspondence' : 'Create Correspondence'}
        </Button>
      </div>
    </form>
  );
}
