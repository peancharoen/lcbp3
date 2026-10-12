'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { NumberingTemplate, SaveTemplateDto } from '@/lib/api/numbering';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CorrespondenceType, Discipline } from '@/types/master-data';

// Aligned with Backend replacement logic
const VARIABLES = [
  { key: '{PROJECT}', name: 'Project Code', example: 'LCBP3' },
  { key: '{ORG}', name: 'Originator Code', example: 'PAT' },
  { key: '{RECIPIENT}', name: 'Recipient Code', example: 'CN' },
  { key: '{TYPE}', name: 'Type Code', example: 'RFA' },
  { key: '{DISCIPLINE}', name: 'Discipline Code', example: 'STR' },
  { key: '{SUBTYPE}', name: 'Sub-Type Code', example: 'GEN' },
  { key: '{SUBTYPE_NUM}', name: 'Sub-Type Number', example: '01' },
  { key: '{YEAR:BE}', name: 'Year (B.E.)', example: '2568' },
  { key: '{YEAR:CE}', name: 'Year (C.E.)', example: '2025' },
  { key: '{SEQ:4}', name: 'Sequence (4-digit)', example: '0001' },
];

export interface TemplateEditorProps {
  template?: NumberingTemplate;
  projectId: number | string;
  projectName: string;
  correspondenceTypes: CorrespondenceType[];
  disciplines: Discipline[];
  onSave: (data: SaveTemplateDto) => void;
  onCancel: () => void;
}

export function TemplateEditor({
  template,
  projectId,
  projectName,
  correspondenceTypes,
  disciplines,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  const [format, setFormat] = useState(template?.formatTemplate || '');
  const [typeId, setTypeId] = useState<string>(
    template?.correspondenceTypeId ? String(template.correspondenceTypeId) : ''
  );
  const [disciplineId, setDisciplineId] = useState<string>(
    template?.disciplineId ? String(template.disciplineId) : '0'
  );
  const [reset, setReset] = useState(template?.resetSequenceYearly ?? true);

  const [preview, setPreview] = useState('');

  useEffect(() => {
    // Generate preview
    let previewText = format || '';
    VARIABLES.forEach((v) => {
      // Simple mock replacement for preview
      let replacement = v.example;
      if (v.key === '{YEAR:BE}') replacement = (new Date().getFullYear() + 543).toString();
      if (v.key === '{YEAR:CE}') replacement = new Date().getFullYear().toString();

      // Dynamic context based on selection (optional visual enhancement)
      if (v.key === '{TYPE}' && typeId) {
        const t = correspondenceTypes.find((ct) => String(ct.publicId) === typeId);
        if (t) replacement = t.typeCode;
      }

      previewText = previewText.replace(new RegExp(v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
    setPreview(previewText);
  }, [format, typeId, correspondenceTypes]);

  const insertVariable = (variable: string) => {
    setFormat((prev: string) => prev + variable);
  };

  const handleSave = () => {
    onSave({
      ...template,
      projectId: projectId,
      correspondenceTypeId: typeId && typeId !== '__default__' ? Number(typeId) : null,
      disciplineId: Number(disciplineId),
      formatTemplate: format,
      resetSequenceYearly: reset,
    });
  };

  const isValid = format.length > 0; // typeId is optional (null = default for all types)

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-lg font-semibold">{template ? 'Edit Template' : 'New Template'}</h3>
          </div>
          <p className="text-sm text-muted-foreground">Define how document numbers are generated for this project.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="bg-muted/50 px-3 py-1 text-base">
            Project: {projectName}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Configuration Column */}
        <div className="space-y-4">
          <div>
            <Label>Document Type (Optional)</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Default (All Types)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default (All Types)</SelectItem>
                {correspondenceTypes.map((type) => {
                  return (
                    <SelectItem key={type.publicId} value={String(type.publicId)}>
                      {type.typeCode} - {type.typeName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty to create a default template for this project.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Discipline (Optional)</Label>
              <Select value={disciplineId} onValueChange={setDisciplineId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Disciplines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Disciplines</SelectItem>
                  {disciplines.map((d) => (
                    <SelectItem key={d.publicId} value={String(d.publicId)}>
                      {d.disciplineCode} - {d.codeNameEn || d.codeNameTh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reset Rule</Label>
              <div className="flex h-10 items-center">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={reset} onCheckedChange={(c) => setReset(!!c)} />
                  <span className="text-sm">Reset Annually</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Format Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-format">Template Format *</Label>
            <Input
              id="template-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="{ORG}-{TYPE}-{SEQ:4}"
              className="mb-2 font-mono text-base"
            />
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <HoverCard key={v.key}>
                  <HoverCardTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.key)}
                      type="button"
                      className="bg-muted/50 font-mono text-xs hover:bg-muted"
                    >
                      {v.key}
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-60 p-3">
                    <p className="text-sm font-semibold">{v.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Example: <span className="font-mono">{v.example}</span>
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-success/30 bg-success/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">Preview Output</p>
            <p className="font-mono text-2xl font-bold tracking-tight text-success">{preview || '...'}</p>
            <p className="mt-2 text-xs text-success">
              * This is an approximation. Actual numbers depend on runtime context.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          Save Template
        </Button>
      </div>
    </Card>
  );
}
