"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CreateTemplateDto } from "@/types/numbering";

const VARIABLES = [
  { key: "{ORG}", name: "Organization Code", example: "กทท" },
  { key: "{DOCTYPE}", name: "Document Type", example: "CORR" },
  { key: "{DISC}", name: "Discipline", example: "STR" },
  { key: "{YYYY}", name: "Year (4-digit)", example: "2025" },
  { key: "{YY}", name: "Year (2-digit)", example: "25" },
  { key: "{MM}", name: "Month", example: "12" },
  { key: "{SEQ}", name: "Sequence Number", example: "0001" },
  { key: "{CONTRACT}", name: "Contract Code", example: "C01" },
];

interface TemplateEditorProps {
  initialData?: Partial<CreateTemplateDto>;
  onSave: (data: CreateTemplateDto) => void;
}

export function TemplateEditor({ initialData, onSave }: TemplateEditorProps) {
  const [formData, setFormData] = useState<CreateTemplateDto>({
    document_type_id: initialData?.document_type_id || "",
    discipline_code: initialData?.discipline_code || "",
    template_format: initialData?.template_format || "",
    reset_annually: initialData?.reset_annually ?? true,
    padding_length: initialData?.padding_length || 4,
    starting_number: initialData?.starting_number || 1,
  });
  const [preview, setPreview] = useState("");

  useEffect(() => {
    // Generate preview
    let previewText = formData.template_format;
    VARIABLES.forEach((v) => {
      // Escape special characters for regex if needed, but simple replaceAll is safer for fixed strings
      previewText = previewText.split(v.key).join(v.example);
    });
    setPreview(previewText);
  }, [formData.template_format]);

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      template_format: prev.template_format + variable,
    }));
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Template Configuration</h3>

        <div className="grid gap-4">
          <div>
            <Label>Document Type *</Label>
            <Select
              value={formData.document_type_id}
              onValueChange={(value) => setFormData({ ...formData, document_type_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correspondence">Correspondence</SelectItem>
                <SelectItem value="rfa">RFA</SelectItem>
                <SelectItem value="drawing">Drawing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discipline (Optional)</Label>
            <Select
              value={formData.discipline_code}
              onValueChange={(value) => setFormData({ ...formData, discipline_code: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="STR">STR - Structure</SelectItem>
                <SelectItem value="ARC">ARC - Architecture</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Template Format *</Label>
            <div className="space-y-2">
              <Input
                value={formData.template_format}
                onChange={(e) => setFormData({ ...formData, template_format: e.target.value })}
                placeholder="e.g., {ORG}-{DOCTYPE}-{YYYY}-{SEQ}"
                className="font-mono"
              />
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                    type="button"
                  >
                    {v.key}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label>Preview</Label>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Example number:</p>
              <p className="text-2xl font-mono font-bold text-green-700">
                {preview || "Enter format above"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sequence Padding Length</Label>
              <Input
                type="number"
                value={formData.padding_length}
                onChange={(e) => setFormData({ ...formData, padding_length: parseInt(e.target.value) })}
                min={1}
                max={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of digits (e.g., 4 = 0001, 0002)
              </p>
            </div>

            <div>
              <Label>Starting Number</Label>
              <Input
                type="number"
                value={formData.starting_number}
                onChange={(e) => setFormData({ ...formData, starting_number: parseInt(e.target.value) })}
                min={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={formData.reset_annually}
                onCheckedChange={(checked) => setFormData({ ...formData, reset_annually: checked as boolean })}
              />
              <span className="text-sm">Reset annually (on January 1st)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Variable Reference */}
      <div>
        <h4 className="font-semibold mb-3">Available Variables</h4>
        <div className="grid grid-cols-2 gap-3">
          {VARIABLES.map((v) => (
            <div
              key={v.key}
              className="flex items-center justify-between p-2 bg-muted/50 rounded"
            >
              <div>
                <Badge variant="outline" className="font-mono">
                  {v.key}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">{v.name}</p>
              </div>
              <span className="text-sm text-muted-foreground">{v.example}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
        <Button onClick={() => onSave(formData)}>Save Template</Button>
      </div>
    </Card>
  );
}
