"use client";

import { TemplateEditor } from "@/components/numbering/template-editor";
import { numberingApi, NumberingTemplate } from "@/lib/api/numbering";
import { useRouter } from "next/navigation";
import { useCorrespondenceTypes, useContracts, useDisciplines } from "@/hooks/use-master-data";
import { useProjects } from "@/hooks/use-projects";
import { toast } from 'sonner';

export default function NewTemplatePage() {
  const router = useRouter();

  // Master Data
  const { data: correspondenceTypes = [] } = useCorrespondenceTypes();
  const { data: projects = [] } = useProjects();
  const projectId = 1; // Default or sync with selection
  const { data: contracts = [] } = useContracts(projectId);
  const contractId = contracts[0]?.id;
  const { data: disciplines = [] } = useDisciplines(contractId);

  const selectedProjectName =
    projects.find((p: { id: number; projectName: string }) => p.id === projectId)?.projectName || 'LCBP3';

  const handleSave = async (data: Partial<NumberingTemplate>) => {
    try {
      await numberingApi.saveTemplate(data);
      router.push("/admin/numbering");
    } catch (error) {
      toast.error('Failed to create template');
      console.error('[NewTemplatePage]', error);
    }
  };

  const handleCancel = () => {
    router.push('/admin/doc-control/numbering');
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">New Numbering Template</h1>
      <TemplateEditor
        projectId={projectId}
        projectName={selectedProjectName}
        correspondenceTypes={correspondenceTypes}
        disciplines={disciplines}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
