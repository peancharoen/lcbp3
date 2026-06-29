'use client';

// File: app/(dashboard)/response-codes/page.tsx
// Master Approval Matrix management UI (T031, FR-022)
import { useState } from 'react';
import { Settings, ShieldCheck, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResponseCodes } from '@/hooks/use-response-codes';
import { MatrixEditor } from '@/components/response-code/MatrixEditor';
import { ProjectOverrideManager } from '@/components/response-code/ProjectOverrideManager';
import { useProjectStore } from '@/lib/stores/project-store';

export default function ResponseCodesPage() {
  const [activeTab, setActiveTab] = useState('global');
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  
  // Dummy data for example - in real app, these would come from specialized hooks
  const { data: globalRules = [] } = useResponseCodes();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span>Master Data</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Approval Matrix & Response Codes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage global response codes and document-specific approval rules.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="global" className="gap-2">
            Global Matrix
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-2">
            Project Overrides
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            Code Definitions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <MatrixEditor 
              documentTypeCode="SDW" 
              rules={globalRules.map(r => ({
                publicId: r.publicId,
                responseCode: {
                  publicId: r.publicId,
                  code: r.code,
                  descriptionEn: r.descriptionEn || '',
                  category: r.category || 'ENGINEERING'
                },
                isEnabled: true,
                requiresComments: false,
                triggersNotification: false,
                isOverridden: false
              }))}
              onToggleEnabled={() => {}}
              onToggleRequiresComments={() => {}}
              onToggleNotification={() => {}}
            />
          </div>
        </TabsContent>

        <TabsContent value="project">
          <ProjectOverrideManager 
            projectPublicId={selectedProjectId ?? ''} 
            projectName="Selected Project"
            overrides={[]}
            onDeleteOverride={() => {}}
            onAddOverride={() => {}}
          />
        </TabsContent>

        <TabsContent value="codes">
          <div className="bg-muted/30 border rounded-lg p-12 text-center text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Response Code definition management is coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
