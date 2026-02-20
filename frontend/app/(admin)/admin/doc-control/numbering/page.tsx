'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Play } from 'lucide-react';
import { NumberingTemplate } from '@/lib/api/numbering';
import { useTemplates, useSaveTemplate } from '@/hooks/use-numbering';
import { TemplateEditor } from '@/components/numbering/template-editor';
import { SequenceViewer } from '@/components/numbering/sequence-viewer';
import { TemplateTester } from '@/components/numbering/template-tester';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, useCorrespondenceTypes, useContracts, useDisciplines } from '@/hooks/use-master-data';

import { ManualOverrideForm } from '@/components/numbering/manual-override-form';
import { MetricsDashboard } from '@/components/numbering/metrics-dashboard';
import { AuditLogsTable } from '@/components/numbering/audit-logs-table';
import { VoidReplaceForm } from '@/components/numbering/void-replace-form';
import { CancelNumberForm } from '@/components/numbering/cancel-number-form';
import { BulkImportForm } from '@/components/numbering/bulk-import-form';

export default function NumberingPage() {
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('1');
  const [activeTab, setActiveTab] = useState('templates');

  // View states
  const [isEditing, setIsEditing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<NumberingTemplate | undefined>(undefined);
  const [isTesting, setIsTesting] = useState(false);
  const [testTemplate, setTestTemplate] = useState<NumberingTemplate | null>(null);

  const selectedProjectName =
    projects.find((p: { id: number; projectName: string }) => p.id.toString() === selectedProjectId)?.projectName ||
    'Unknown Project';

  // Master Data
  const { data: correspondenceTypes = [] } = useCorrespondenceTypes();
  const { data: contracts = [] } = useContracts(Number(selectedProjectId));
  const contractId = contracts[0]?.id;
  const { data: disciplines = [] } = useDisciplines(contractId);

  const { data: templateResponse, isLoading: isLoadingTemplates } = useTemplates();
  const saveTemplateMutation = useSaveTemplate();

  // Extract templates array from response (handles both direct array and { data: array } formats)
  const templates: NumberingTemplate[] = Array.isArray(templateResponse)
    ? templateResponse
    : ((templateResponse as any)?.data ?? []);

  const handleEdit = (template?: NumberingTemplate) => {
    setActiveTemplate(template);
    setIsEditing(true);
  };

  const handleSave = async (data: Partial<NumberingTemplate>) => {
    try {
      await saveTemplateMutation.mutateAsync(data);
      toast.success(data.id ? 'Template updated' : 'Template created');
      setIsEditing(false);
    } catch {
      toast.error('Failed to save template');
    }
  };

  const handleTest = (template: NumberingTemplate) => {
    setTestTemplate(template);
    setIsTesting(true);
  };

  if (isEditing) {
    return (
      <div className="p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
        <TemplateEditor
          template={activeTemplate}
          projectId={Number(selectedProjectId)}
          projectName={selectedProjectName}
          correspondenceTypes={correspondenceTypes}
          disciplines={disciplines}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Numbering</h1>
          <p className="text-muted-foreground mt-1">Manage numbering templates, audit logs, and tools</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: { id: number; projectCode: string; projectName: string }) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.projectCode} - {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="metrics">Metrics & Audit</TabsTrigger>
          <TabsTrigger value="tools">Admin Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleEdit(undefined)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid gap-4">
                {templates
                  .filter((t) => !t.projectId || t.projectId === Number(selectedProjectId))
                  .map((template) => (
                    <Card key={template.id} className="p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">
                              {template.correspondenceType?.typeName || 'Default Format'}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {template.project?.projectCode || selectedProjectName}
                            </Badge>
                            {template.description && <Badge variant="secondary">{template.description}</Badge>}
                          </div>

                          <div className="bg-slate-100 dark:bg-slate-900 rounded px-3 py-2 mb-3 font-mono text-sm inline-block border">
                            {template.formatTemplate}
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                            <div>
                              <span className="text-muted-foreground">Type Code: </span>
                              <span className="font-medium font-mono text-green-600 dark:text-green-400">
                                {template.correspondenceType?.typeCode || 'DEFAULT'}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reset: </span>
                              <span>{template.resetSequenceYearly ? 'Annually' : 'Continuous'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleTest(template)}>
                            <Play className="mr-2 h-4 w-4" />
                            Test
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            <div className="space-y-4">
              <SequenceViewer />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <MetricsDashboard />
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Audit Logs</h3>
            <AuditLogsTable />
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ManualOverrideForm projectId={Number(selectedProjectId)} />
            <VoidReplaceForm projectId={Number(selectedProjectId)} />
            <CancelNumberForm />
            <div className="md:col-span-2">
              <BulkImportForm projectId={Number(selectedProjectId)} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TemplateTester open={isTesting} onOpenChange={setIsTesting} template={testTemplate} />
    </div>
  );
}
