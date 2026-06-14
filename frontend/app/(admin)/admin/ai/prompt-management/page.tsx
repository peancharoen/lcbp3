// File: frontend/app/(admin)/admin/ai/prompt-management/page.tsx
// Change Log:
// - 2026-06-14: Created unified prompt management page (conforming to tasks T019, T029, T038)

'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { PromptType, PromptVersion, ContextConfig } from '@/lib/types/ai-prompts';
import PromptTypeDropdown from '@/components/admin/ai/PromptTypeDropdown';
import VersionHistory from '@/components/admin/ai/VersionHistory';
import PromptEditor from '@/components/admin/ai/PromptEditor';
import ContextConfigEditor from '@/components/admin/ai/ContextConfigEditor';
import SandboxTabs from '@/components/admin/ai/SandboxTabs';
import RuntimeParametersPanel from '@/components/admin/ai/RuntimeParametersPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Brain, Sliders, Play, Settings } from 'lucide-react';

export default function UnifiedPromptManagementPage() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<PromptType>('ocr_extraction');
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);

  // ดึงข้อมูลประวัติเวอร์ชันทั้งหมดของ prompt_type ที่เลือก
  const { data: versions = [], isLoading } = useQuery<PromptVersion[]>({
    queryKey: ['admin-ai-prompts', selectedType],
    queryFn: async () => {
      const res = await adminAiService.listPrompts(selectedType);
      return res || [];
    },
  });

  // อัปเดต selectedVersion เมื่อเปลี่ยนประเภทหรือข้อมูลรีเฟรช
  useEffect(() => {
    if (versions.length > 0) {
      const active = versions.find((v) => v.isActive) || versions[0];
      setSelectedVersion(active);
    } else {
      setSelectedVersion(null);
    }
  }, [versions, selectedType]);

  // สร้างเวอร์ชันใหม่
  const createMutation = useMutation({
    mutationFn: async (payload: { template: string; manualNote: string }) => {
      return await adminAiService.createPrompt(selectedType, {
        template: payload.template,
        manualNote: payload.manualNote,
      });
    },
    onSuccess: () => {
      toast.success('สร้าง Prompt Version ใหม่สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts', selectedType] });
    },
    onError: () => {
      toast.error('ไม่สามารถสร้าง Prompt Version ใหม่ได้');
    },
  });

  // เปิดใช้งานเวอร์ชัน
  const activateMutation = useMutation({
    mutationFn: async (versionNumber: number) => {
      return await adminAiService.activatePrompt(selectedType, versionNumber);
    },
    onSuccess: () => {
      toast.success('เปิดใช้งาน Prompt Version สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts', selectedType] });
    },
    onError: () => {
      toast.error('ไม่สามารถเปิดใช้งาน Prompt Version ได้');
    },
  });

  // ลบเวอร์ชัน
  const deleteMutation = useMutation({
    mutationFn: async (versionNumber: number) => {
      return await adminAiService.deletePrompt(selectedType, versionNumber);
    },
    onSuccess: () => {
      toast.success('ลบ Prompt Version สำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts', selectedType] });
    },
    onError: (err: unknown) => {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(errorMsg || 'ไม่สามารถลบ Prompt Version ได้');
    },
  });

  // อัปเดตบริบทข้อมูล (Context Config)
  const updateConfigMutation = useMutation({
    mutationFn: async (payload: { versionNumber: number; config: ContextConfig }) => {
      return await adminAiService.updateContextConfig(
        selectedType,
        payload.versionNumber,
        payload.config
      );
    },
    onSuccess: () => {
      toast.success('อัปเดตการตั้งค่าบริบทสำเร็จ');
      queryClient.invalidateQueries({ queryKey: ['admin-ai-prompts', selectedType] });
    },
    onError: (err: unknown) => {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(errorMsg || 'ไม่สามารถอัปเดตบริบทได้');
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            ระบบจัดการ Prompt และบริบท (Prompt & Context Manager)
          </h1>
          <p className="text-sm text-muted-foreground">
            จัดการเทมเพลตพรอมต์และตัวกรองข้อมูล Master Data เพื่อส่งให้ระบบ AI ประมวลผลอย่างแม่นยำ
          </p>
        </div>
        <div className="w-full md:w-[320px] bg-background/40 p-2.5 rounded-lg border border-border/50">
          <PromptTypeDropdown value={selectedType} onChange={setSelectedType} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Sidebar: รายการประวัติเวอร์ชัน */}
        <div className="xl:col-span-4 space-y-4">
          <VersionHistory
            versions={versions}
            isLoading={isLoading}
            onLoadTemplate={setSelectedVersion}
            onActivateVersion={(v) => activateMutation.mutate(v)}
            onDeleteVersion={(v) => deleteMutation.mutate(v)}
            isActivating={activateMutation.isPending}
            isDeleting={deleteMutation.isPending}
          />
        </div>

        {/* Main Panel: แผงแก้ไขและทดสอบ Sandbox */}
        <div className="xl:col-span-8">
          <Tabs defaultValue="editor" className="w-full space-y-4">
            <TabsList className="bg-background/40 border border-border/50 p-1">
              <TabsTrigger value="editor" className="text-xs font-semibold flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-primary" />
                ตัวแก้ไขและบริบท (Editor & Context)
              </TabsTrigger>
              <TabsTrigger value="sandbox" className="text-xs font-semibold flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-primary" />
                บอร์ดทดลอง (3-Step Sandbox)
              </TabsTrigger>
              <TabsTrigger value="parameters" className="text-xs font-semibold flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                พารามิเตอร์รันไทม์ (Runtime Params)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4 mt-0 focus-visible:outline-none">
              <PromptEditor
                promptType={selectedType}
                initialTemplate={selectedVersion?.template || ''}
                onSave={async (tmpl, note) => {
                  await createMutation.mutateAsync({ template: tmpl, manualNote: note });
                }}
                isSaving={createMutation.isPending}
              />
              {selectedVersion && (
                <ContextConfigEditor
                  initialConfig={selectedVersion.contextConfig}
                  onSave={async (config) => {
                    await updateConfigMutation.mutateAsync({
                      versionNumber: selectedVersion.versionNumber,
                      config,
                    });
                  }}
                  isSaving={updateConfigMutation.isPending}
                />
              )}
            </TabsContent>

            <TabsContent value="sandbox" className="mt-0 focus-visible:outline-none">
              <SandboxTabs
                promptType={selectedType}
                selectedVersionNumber={selectedVersion?.versionNumber}
                onActivateVersion={(v) => activateMutation.mutate(v)}
              />
            </TabsContent>

            <TabsContent value="parameters" className="mt-0 focus-visible:outline-none">
              <RuntimeParametersPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
