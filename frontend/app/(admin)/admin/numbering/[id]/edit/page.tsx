"use client";

import { useState, useEffect } from "react";
import { TemplateEditor } from "@/components/numbering/template-editor";
import { SequenceViewer } from "@/components/numbering/sequence-viewer";
import { numberingApi } from "@/lib/api/numbering";
import { NumberingTemplate } from "@/lib/api/numbering"; // Correct import
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCorrespondenceTypes, useContracts, useDisciplines } from "@/hooks/use-master-data";
import { useProjects } from "@/hooks/use-projects";

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<NumberingTemplate | null>(null);

  // Master Data
  const { data: correspondenceTypes = [] } = useCorrespondenceTypes();
  const { data: projects = [] } = useProjects();
  const projectId = template?.projectId || 1;
  const { data: contracts = [] } = useContracts(projectId);
  const contractId = contracts[0]?.id;
  const { data: disciplines = [] } = useDisciplines(contractId);

  const selectedProjectName = projects.find((p: { id: number; projectName: string }) => p.id === projectId)?.projectName || 'LCBP3';

  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const data = await numberingApi.getTemplate(parseInt(params.id));
        if (data) {
          setTemplate(data);
        }
      } catch (error) {
        console.error("Failed to fetch template", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [params.id]);

  const handleSave = async (data: Partial<NumberingTemplate>) => {
    try {
      await numberingApi.saveTemplate({ ...data, id: parseInt(params.id) });
      router.push("/admin/numbering");
    } catch (error) {
      console.error("Failed to update template", error);
      alert("Failed to update template");
    }
  };

  const handleCancel = () => {
    router.push("/admin/numbering");
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
