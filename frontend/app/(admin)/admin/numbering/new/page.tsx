"use client";

import { TemplateEditor } from "@/components/numbering/template-editor";
import { numberingApi, NumberingTemplate } from "@/lib/api/numbering";
import { useRouter } from "next/navigation";

export default function NewTemplatePage() {
  const router = useRouter();

  const handleSave = async (data: Partial<NumberingTemplate>) => {
    try {
      await numberingApi.saveTemplate(data);
      router.push("/admin/numbering");
    } catch (error) {
      console.error("Failed to create template", error);
      alert("Failed to create template");
    }
  };

  const handleCancel = () => {
    router.push("/admin/numbering");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">New Numbering Template</h1>
      <TemplateEditor
        projectId={1}
        projectName="LCBP3"
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
