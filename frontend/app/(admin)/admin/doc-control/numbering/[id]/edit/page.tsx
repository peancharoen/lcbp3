'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TemplateEditor } from '@/components/numbering/template-editor';
import { SequenceViewer } from '@/components/numbering/sequence-viewer';
import { numberingApi, SaveTemplateDto } from '@/lib/api/numbering';
import { NumberingTemplate } from '@/lib/api/numbering';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCorrespondenceTypes, useContracts, useDisciplines } from '@/hooks/use-master-data';
import { useProjects } from '@/hooks/use-projects';
import { toast } from 'sonner';

export default function EditTemplatePage() {
  const params = useParams();
  const id = params['id'] as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<NumberingTemplate | null>(null);

  // Master Data
  const { data: correspondenceTypes = [] } = useCorrespondenceTypes();
  const { data: projects = [] } = useProjects();
  const projectId = template?.projectId || 1;
  const { data: contractsData } = useContracts(projectId);
  const contracts = Array.isArray(contractsData) ? contractsData : [];
  const firstContract = contracts[0] as { id?: number; publicId?: string } | undefined;
  const contractId = firstContract?.publicId ?? firstContract?.id;
  const { data: disciplines = [] } = useDisciplines(contractId);

  const selectedProjectName =
    projects.find((p: { id?: number; publicId?: string; projectCode: string; projectName: string }) =>
      String(p.publicId ?? p.id) === String(projectId))
      ?.projectName || 'LCBP3';

  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const data = await numberingApi.getTemplate(Number(id));
        if (data) {
          setTemplate(data);
        }
      } catch {
        toast.error('Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [id]);

  const handleSave = async (data: Partial<NumberingTemplate>) => {
    if (!template) return;
    try {
      // Map to SaveTemplateDto ensuring all required fields are present
      const payload: SaveTemplateDto = {
        id: Number(id),
        projectId: data.projectId ?? template.projectId,
        correspondenceTypeId: data.correspondenceTypeId ?? template.correspondenceTypeId,
        formatTemplate: data.formatTemplate ?? template.formatTemplate,
        disciplineId: data.disciplineId ?? template.disciplineId,
        description: data.description ?? template.description,
        resetSequenceYearly: data.resetSequenceYearly ?? template.resetSequenceYearly,
        isActive: data.isActive ?? template.isActive,
      };
      await numberingApi.saveTemplate(payload);
      router.push('/admin/doc-control/numbering');
    } catch {
      toast.error('Failed to update template');
    }
  };

  const handleCancel = () => {
    router.push('/admin/doc-control/numbering');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Template not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Edit Numbering Template</h1>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <TemplateEditor
            template={template}
            projectId={template.projectId || 1}
            projectName={selectedProjectName}
            correspondenceTypes={correspondenceTypes}
            disciplines={disciplines}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </TabsContent>

        <TabsContent value="sequences" className="mt-4">
          <SequenceViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
