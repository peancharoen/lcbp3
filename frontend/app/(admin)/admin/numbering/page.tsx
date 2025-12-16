'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Play, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { numberingApi, NumberingTemplate } from '@/lib/api/numbering';
import { TemplateEditor } from '@/components/numbering/template-editor';
import { SequenceViewer } from '@/components/numbering/sequence-viewer';
import { TemplateTester } from '@/components/numbering/template-tester';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects, useCorrespondenceTypes, useContracts, useDisciplines } from '@/hooks/use-master-data';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- Sub-components for Tools ---
function ManualOverrideForm({ onSuccess, projectId }: { onSuccess: () => void, projectId: number }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        typeId: '',
        disciplineId: '',
        year: new Date().getFullYear().toString(),
        newSequence: '',
        reason: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await numberingApi.manualOverride({
                projectId,
                correspondenceTypeId: parseInt(formData.typeId) || null,
                year: parseInt(formData.year),
                newValue: parseInt(formData.newSequence),
            });
            toast.success("Manual override applied successfully");
            onSuccess();
        } catch (error) {
            toast.error("Failed to apply override");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Override</CardTitle>
                <CardDescription>Force set a counter sequence. Use with caution.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>Changing counters manually can cause duplication errors.</AlertDescription>
                </Alert>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type ID</Label>
                            <Input
                                placeholder="e.g. 1"
                                value={formData.typeId}
                                onChange={e => setFormData({...formData, typeId: e.target.value})}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                             <Label>Discipline ID</Label>
                             <Input
                                placeholder="Optional"
                                value={formData.disciplineId}
                                onChange={e => setFormData({...formData, disciplineId: e.target.value})}
                             />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label>Year</Label>
                             <Input
                                type="number"
                                value={formData.year}
                                onChange={e => setFormData({...formData, year: e.target.value})}
                                required
                             />
                        </div>
                        <div className="space-y-2">
                             <Label>New Sequence</Label>
                             <Input
                                type="number"
                                placeholder="e.g. 5"
                                value={formData.newSequence}
                                onChange={e => setFormData({...formData, newSequence: e.target.value})}
                                required
                             />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                            placeholder="Why is this override needed?"
                            value={formData.reason}
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                            required
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading && <ShieldAlert className="mr-2 h-4 w-4 animate-spin" />}
                        Apply Override
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

function AdminMetrics() {
     // Fetch metrics from /admin/document-numbering/metrics
     return (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-sm font-medium">Generation Success Rate</CardTitle>
                     <CheckCircle2 className="h-4 w-4 text-green-500" />
                 </CardHeader>
                 <CardContent>
                     <div className="text-2xl font-bold">99.9%</div>
                     <p className="text-xs text-muted-foreground">+0.1% from last month</p>
                 </CardContent>
             </Card>
              {/* More cards... */}
              <Card className="col-span-full">
                  <CardHeader>
                      <CardTitle>Recent Audit Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground">Log viewer implementation pending.</p>
                  </CardContent>
              </Card>
         </div>
     )
}

export default function NumberingPage() {
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState("1");
  const [activeTab, setActiveTab] = useState("templates");

  const [templates, setTemplates] = useState<NumberingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // View states
  const [isEditing, setIsEditing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<NumberingTemplate | undefined>(undefined);
  const [isTesting, setIsTesting] = useState(false);
  const [testTemplate, setTestTemplate] = useState<NumberingTemplate | null>(null);

  const selectedProjectName = projects.find((p: any) => p.id.toString() === selectedProjectId)?.projectName || 'Unknown Project';

  // Master Data
  const { data: correspondenceTypes = [] } = useCorrespondenceTypes();
  const { data: contracts = [] } = useContracts(Number(selectedProjectId));
  const contractId = contracts[0]?.id;
  const { data: disciplines = [] } = useDisciplines(contractId);

  const loadTemplates = async () => {
    setLoading(true);
    try {
        const response = await numberingApi.getTemplates();
        // Handle wrapped response { data: [...] } or direct array
        const data = Array.isArray(response) ? response : (response as { data?: NumberingTemplate[] })?.data ?? [];
        setTemplates(data);
    } catch {
        toast.error("Failed to load templates");
        setTemplates([]);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEdit = (template?: NumberingTemplate) => {
      setActiveTemplate(template);
      setIsEditing(true);
  };

  const handleSave = async (data: Partial<NumberingTemplate>) => {
      try {
          await numberingApi.saveTemplate(data);
          toast.success(data.id ? "Template updated" : "Template created");
          setIsEditing(false);
          loadTemplates();
      } catch {
          toast.error("Failed to save template");
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
          <h1 className="text-3xl font-bold tracking-tight">
            Document Numbering
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage numbering templates, audit logs, and tools
          </p>
        </div>
        <div className="flex gap-2">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                    {projects.map((project: any) => (
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
                          .filter(t => !t.projectId || t.projectId === Number(selectedProjectId))
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
                                        <span>
                                        {template.resetSequenceYearly ? 'Annually' : 'Continuous'}
                                        </span>
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
              <AdminMetrics />
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                  <ManualOverrideForm onSuccess={() => {}} projectId={Number(selectedProjectId)} />

                  <Card>
                      <CardHeader>
                          <CardTitle>Void & Replace</CardTitle>
                          <CardDescription>Safe voiding of issued numbers.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <div className="space-y-4">
                               <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-900 text-sm">
                                   To void and replace numbers, please use the <strong>Correspondences</strong> list view actions or edit specific documents directly.
                                   <br/><br/>
                                   This ensures the void action is linked to the correct document record.
                               </div>
                               <Button variant="outline" className="w-full" disabled>
                                   Standalone Void Tool (Coming Soon)
                               </Button>
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </TabsContent>
      </Tabs>

      <TemplateTester
          open={isTesting}
          onOpenChange={setIsTesting}
          template={testTemplate}
      />
    </div>
  );
}
