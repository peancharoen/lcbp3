"use client";

import { TemplateEditor } from "@/components/numbering/template-editor";
import { numberingApi } from "@/lib/api/numbering";
import { CreateTemplateDto } from "@/types/numbering";
import { useRouter } from "next/navigation";

export default function NewTemplatePage() {
  const router = useRouter();

  const handleSave = async (data: CreateTemplateDto) => {
    try {
      await numberingApi.createTemplate(data);
      router.push("/admin/numbering");
    } catch (error) {
      console.error("Failed to create template", error);
      alert("Failed to create template");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">New Numbering Template</h1>
      <TemplateEditor onSave={handleSave} />
    </div>
  );
}
