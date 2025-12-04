"use client";

import { useState, useEffect } from "react";
import { TemplateEditor } from "@/components/numbering/template-editor";
import { SequenceViewer } from "@/components/numbering/sequence-viewer";
import { numberingApi } from "@/lib/api/numbering";
import { CreateTemplateDto } from "@/types/numbering";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<CreateTemplateDto> | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const data = await numberingApi.getTemplate(parseInt(params.id));
        if (data) {
          setInitialData({
            document_type_id: data.document_type_id,
            discipline_code: data.discipline_code,
            template_format: data.template_format,
            reset_annually: data.reset_annually,
            padding_length: data.padding_length,
            starting_number: 1, // Default for edit view as we don't usually reset this
          });
        }
      } catch (error) {
        console.error("Failed to fetch template", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [params.id]);

  const handleSave = async (data: CreateTemplateDto) => {
    try {
      await numberingApi.updateTemplate(parseInt(params.id), data);
      router.push("/admin/numbering");
    } catch (error) {
      console.error("Failed to update template", error);
      alert("Failed to update template");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          {initialData && (
            <TemplateEditor initialData={initialData} onSave={handleSave} />
          )}
        </TabsContent>

        <TabsContent value="sequences" className="mt-4">
          <SequenceViewer templateId={parseInt(params.id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
