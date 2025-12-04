"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { NumberingTemplate } from "@/types/numbering";
import { numberingApi } from "@/lib/api/numbering";
import { TemplateTester } from "@/components/numbering/template-tester";

export default function NumberingPage() {
  const [templates, setTemplates] = useState<NumberingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [testerOpen, setTesterOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NumberingTemplate | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const data = await numberingApi.getTemplates();
        setTemplates(data);
      } catch (error) {
        console.error("Failed to fetch templates", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleTest = (template: NumberingTemplate) => {
    setSelectedTemplate(template);
    setTesterOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            Document Numbering Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage document numbering templates and sequences
          </p>
        </div>
        <Link href="/admin/numbering/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.template_id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {template.document_type_name}
                    </h3>
                    <Badge variant="outline">{template.discipline_code || "All"}</Badge>
                    <Badge variant={template.is_active ? "default" : "secondary"} className={template.is_active ? "bg-green-600 hover:bg-green-700" : ""}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="bg-muted rounded px-3 py-2 mb-3 font-mono text-sm">
                    {template.template_format}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Example: </span>
                      <span className="font-medium">
                        {template.example_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Sequence: </span>
                      <span className="font-medium">
                        {template.current_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Annual Reset: </span>
                      <span className="font-medium">
                        {template.reset_annually ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Padding: </span>
                      <span className="font-medium">
                        {template.padding_length} digits
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/admin/numbering/${template.template_id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => handleTest(template)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Test & View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateTester
        open={testerOpen}
        onOpenChange={setTesterOpen}
        template={selectedTemplate}
      />
    </div>
  );
}
