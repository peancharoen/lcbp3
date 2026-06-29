// File: frontend/components/admin/ai/ContextConfigEditor.tsx
// Change Log:
// - 2026-06-14: Created ContextConfigEditor component with project/contract loaders and selectors (conforming to task T028)
// - 2026-06-15: Added field validation UI with error messages (T069)

import React, { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Settings, AlertCircle } from 'lucide-react';
import { ContextConfig } from '@/lib/types/ai-prompts';
import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';
import { cn } from '@/lib/utils';

interface ContextConfigEditorProps {
  initialConfig: ContextConfig | null;
  onSave: (config: ContextConfig) => Promise<void>;
  isSaving: boolean;
}

interface ProjectOption {
  publicId: string;
  projectName: string;
}

interface ContractOption {
  publicId: string;
  contractName: string;
  project?: {
    publicId?: string;
  };
}

/**
 * คอมโพเนนต์ฟอร์มสำหรับแก้ไขบริบทข้อมูล (Context Configuration)
 * จัดการตัวเลือกการกรองข้อมูลรายโครงการ (Project Filter) และรายสัญญา (Contract Filter) รวมทั้งภาษาและจำนวนประวัติการดึงข้อมูล
 */
export default function ContextConfigEditor({
  initialConfig,
  onSave,
  isSaving,
}: ContextConfigEditorProps) {
  const t = useTranslations();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<ContractOption[]>([]);

  // State ฟอร์ม
  const [projectId, setProjectId] = useState<string>('all');
  const [contractId, setContractId] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(3);
  const [language, setLanguage] = useState<string>('th');
  const [outputLanguage, setOutputLanguage] = useState<string>('th');

  // Validation errors (T069)
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate pageSize
    if (pageSize < 1 || pageSize > 1000) {
      newErrors.pageSize = t('prompt_management.pageSize_invalid');
    }

    // Validate language
    if (!language || language.trim().length === 0) {
      newErrors.language = t('prompt_management.language_required');
    }

    // Validate outputLanguage
    if (!outputLanguage || outputLanguage.trim().length === 0) {
      newErrors.outputLanguage = t('prompt_management.output_language_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const projList = await projectService.getAll();
        setProjects(
          Array.isArray(projList)
            ? (projList as unknown as Record<string, unknown>[]).map((p) => ({
                publicId: String(p.publicId || ''),
                projectName: String(p.projectName || ''),
              }))
            : []
        );
        const contrList = await contractService.getAll();
        setContracts(
          Array.isArray(contrList)
            ? (contrList as unknown as Record<string, unknown>[]).map((c) => ({
                publicId: String(c.publicId || ''),
                contractName: String(c.contractName || ''),
                project: c.project
                  ? {
                      publicId: String((c.project as unknown as Record<string, unknown>).publicId || ''),
                    }
                  : undefined,
              }))
            : []
        );
      } catch (_err) {
        // Error handling silently - backend logs via NestJS Logger
      }
    };
    loadData();
  }, []);

  // พรีโหลดค่าตั้งต้น
  useEffect(() => {
    if (initialConfig) {
      setProjectId(initialConfig.filter?.projectId || 'all');
      setContractId(initialConfig.filter?.contractId || 'all');
      setPageSize(initialConfig.pageSize || 3);
      setLanguage(initialConfig.language || 'th');
      setOutputLanguage(initialConfig.outputLanguage || 'th');
    } else {
      setProjectId('all');
      setContractId('all');
      setPageSize(3);
      setLanguage('th');
      setOutputLanguage('th');
    }
  }, [initialConfig]);

  // กรองรายการสัญญาตามโครงการที่เลือก
  useEffect(() => {
    if (projectId && projectId !== 'all') {
      const filtered = contracts.filter((c) => c.project?.publicId === projectId);
      setFilteredContracts(filtered);
      // รีเซ็ตสัญญาถ้าไม่ได้ผูกกับโครงการที่เลือก
      const isStillValid = filtered.some((c) => c.publicId === contractId);
      if (!isStillValid && contractId !== 'all') {
        setContractId('all');
      }
    } else {
      setFilteredContracts(contracts);
    }
  }, [projectId, contracts, contractId]);

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    const config: ContextConfig = {
      filter: {
        projectId: projectId === 'all' ? null : projectId,
        contractId: contractId === 'all' ? null : contractId,
      },
      pageSize: Number(pageSize),
      language,
      outputLanguage,
    };
    onSave(config);
  };

  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-3 border-b border-border/10">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <Settings className="h-4 w-4 text-primary" />
          การตั้งค่าบริบทข้อมูล (Context Configuration)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* เลือกล็อคโครงการ */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            ตัวกรองโครงการ (Project Filter)
          </label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm">
              <SelectValue placeholder="เลือกโครงการ..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด (ไม่กรอง / Global)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.publicId} value={p.publicId}>
                  {p.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* เลือกล็อคสัญญา */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            ตัวกรองสัญญา (Contract Filter)
          </label>
          <Select value={contractId} onValueChange={setContractId}>
            <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm">
              <SelectValue placeholder="เลือกสัญญา..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด (ไม่กรอง / Global)</SelectItem>
              {filteredContracts.map((c) => (
                <SelectItem key={c.publicId} value={c.publicId}>
                  {c.contractName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ปริมาณเอกสารอ้างอิงและภาษา */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('prompt_management.page_size')}
            </label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Math.max(1, Number(e.target.value)));
                setErrors((prev) => ({ ...prev, pageSize: '' }));
              }}
              className={cn(
                'bg-background/50 border-border/50 text-sm focus-visible:ring-primary/30',
                errors.pageSize && 'border-destructive'
              )}
            />
            {errors.pageSize && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.pageSize}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('prompt_management.language')}
            </label>
            <Select value={language} onValueChange={(val) => { setLanguage(val); setErrors((prev) => ({ ...prev, language: '' })); }}>
              <SelectTrigger className={cn('bg-background/50 border-border/50 backdrop-blur-sm', errors.language && 'border-destructive')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="th">ไทย (TH)</SelectItem>
                <SelectItem value="en">English (EN)</SelectItem>
                <SelectItem value="mixed">ไทย + อังกฤษ (MIXED)</SelectItem>
              </SelectContent>
            </Select>
            {errors.language && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.language}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('prompt_management.output_language')}
            </label>
            <Select value={outputLanguage} onValueChange={(val) => { setOutputLanguage(val); setErrors((prev) => ({ ...prev, outputLanguage: '' })); }}>
              <SelectTrigger className={cn('bg-background/50 border-border/50 backdrop-blur-sm', errors.outputLanguage && 'border-destructive')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="th">ไทย (TH)</SelectItem>
                <SelectItem value="en">English (EN)</SelectItem>
                <SelectItem value="mixed">ไทย + อังกฤษ (MIXED)</SelectItem>
              </SelectContent>
            </Select>
            {errors.outputLanguage && (
              <div className="flex items-center gap-1 text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.outputLanguage}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/10 pt-4 bg-muted/5 rounded-b-xl">
        <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          การตั้งค่านี้จะผูกกับเวอร์ชันของพรอมต์โดยตรง
        </span>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="bg-primary hover:bg-primary/95 font-semibold text-xs"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกบริบท (Save Config)'}
        </Button>
      </CardFooter>
    </Card>
  );
}
