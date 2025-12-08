'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Play } from 'lucide-react';
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

const PROJECTS = [
  { id: '1', name: 'LCBP3' },
  { id: '2', name: 'LCBP3-Maintenance' },
];

export default function NumberingPage() {
  const [selectedProjectId, setSelectedProjectId] = useState("1");
  const [templates, setTemplates] = useState<NumberingTemplate[]>([]);
  const [, setLoading] = useState(true);

  // View states
  const [isEditing, setIsEditing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<NumberingTemplate | undefined>(undefined);
  const [isTesting, setIsTesting] = useState(false);
  const [testTemplate, setTestTemplate] = useState<NumberingTemplate | null>(null);

  const selectedProjectName = PROJECTS.find(p => p.id === selectedProjectId)?.name || 'Unknown Project';

  const loadTemplates = async () => {
    setLoading(true);
    try {
        const data = await numberingApi.getTemplates();
        setTemplates(data);
    } catch {
        toast.error("Failed to load templates");
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
          toast.success(data.template_id ? "Template updated" : "Template created");
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
            Manage numbering templates and sequences
          </p>
        </div>
        <div className="flex gap-2">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                    {PROJECTS.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                            {project.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={() => handleEdit(undefined)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Templates - {selectedProjectName}</h2>
            <div className="grid gap-4">
                {templates
                  .filter(t => !t.project_id || t.project_id === Number(selectedProjectId)) // Show all if no project_id (legacy mock), or match
                  .map((template) => (
                <Card key={template.template_id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                            {template.document_type_name}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                             {PROJECTS.find(p => p.id === template.project_id?.toString())?.name || selectedProjectName}
                        </Badge>
                        {template.discipline_code && <Badge>{template.discipline_code}</Badge>}
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-900 rounded px-3 py-2 mb-3 font-mono text-sm inline-block border">
                        {template.template_format}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                            <div>
                                <span className="text-muted-foreground">Example: </span>
                                <span className="font-medium font-mono text-green-600 dark:text-green-400">
                                {template.example_number}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Reset: </span>
                                <span>
                                {template.reset_annually ? 'Annually' : 'Never'}
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
             {/* Sequence Viewer Sidebar */}
             <SequenceViewer />
          </div>
      </div>

      <TemplateTester
          open={isTesting}
          onOpenChange={setIsTesting}
          template={testTemplate}
      />
    </div>
  );
}
