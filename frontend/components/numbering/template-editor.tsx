'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { NumberingTemplate } from '@/lib/api/numbering';

const DOCUMENT_TYPES = [
  { value: 'RFA', label: 'Request for Approval (RFA)' },
  { value: 'RFI', label: 'Request for Information (RFI)' },
  { value: 'TRANSMITTAL', label: 'Transmittal' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'INSTRUCTION', label: 'Instruction' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'MEMO', label: 'Memorandum' },
  { value: 'MOM', label: 'Minutes of Meeting' },
  { value: 'NOTICE', label: 'Notice' },
  { value: 'OTHER', label: 'Other' },
];

const VARIABLES = [
  { key: '{PROJECT}', name: 'Project Code', example: 'LCBP3' },
  { key: '{ORIGINATOR}', name: 'Originator Code', example: 'PAT' },
  { key: '{RECIPIENT}', name: 'Recipient Code', example: 'CN' },
  { key: '{CORR_TYPE}', name: 'Correspondence Type', example: 'RFA' },
  { key: '{SUB_TYPE}', name: 'Sub Type', example: '21' },
  { key: '{DISCIPLINE}', name: 'Discipline', example: 'STR' },
  { key: '{RFA_TYPE}', name: 'RFA Type', example: 'SDW' },
  { key: '{YEAR:B.E.}', name: 'Year (B.E.)', example: '2568' },
  { key: '{YEAR:A.D.}', name: 'Year (A.D.)', example: '2025' },
  { key: '{SEQ:4}', name: 'Sequence (4-digit)', example: '0001' },
  { key: '{REV}', name: 'Revision', example: 'A' },
];

export interface TemplateEditorProps {
    template?: NumberingTemplate;
    projectId: number;
    projectName: string;
    onSave: (data: Partial<NumberingTemplate>) => void;
    onCancel: () => void;
}

export function TemplateEditor({ template, projectId, projectName, onSave, onCancel }: TemplateEditorProps) {
  const [format, setFormat] = useState(template?.templateFormat || '');
  const [docType, setDocType] = useState(template?.documentTypeName || '');
  const [discipline, setDiscipline] = useState(template?.disciplineCode || '');
  const [padding, setPadding] = useState(template?.paddingLength || 4);
  const [reset, setReset] = useState(template?.resetAnnually ?? true);

  const [preview, setPreview] = useState('');

  useEffect(() => {
    // Generate preview
    let previewText = format || '';
    VARIABLES.forEach((v) => {
        let replacement = v.example;
        // Dynamic preview for dates to be more realistic
        if (v.key === '{YYYY}') replacement = new Date().getFullYear().toString();
        if (v.key === '{YY}') replacement = new Date().getFullYear().toString().slice(-2);
        if (v.key === '{THXXXX}') replacement = (new Date().getFullYear() + 543).toString();
        if (v.key === '{THXX}') replacement = (new Date().getFullYear() + 543).toString().slice(-2);

        previewText = previewText.replace(new RegExp(v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
    setPreview(previewText);
  }, [format]);

  const insertVariable = (variable: string) => {
    setFormat((prev) => prev + variable);
  };

  const handleSave = () => {
      onSave({
          ...template,
          projectId: projectId,
          templateFormat: format,
          documentTypeName: docType,
          disciplineCode: discipline || undefined,
          paddingLength: padding,
          resetAnnually: reset,
          exampleNumber: preview
      });
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{template ? 'Edit Template' : 'New Template'}</h3>
            <Badge variant="outline" className="text-base px-3 py-1">
                Project: {projectName}
            </Badge>
        </div>

        <div className="grid gap-4">
          <div>
            <Label>Document Type *</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discipline (Optional)</Label>
            <Select value={discipline || "ALL"} onValueChange={(val) => setDiscipline(val === "ALL" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="All disciplines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="STR">STR - Structure</SelectItem>
                <SelectItem value="ARC">ARC - Architecture</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Template Format *</Label>
            <div className="space-y-2">
              <Input
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="e.g., {ORIGINATOR}-{RECIPIENT}-{DOCTYPE}-{YYYY}-{SEQ}"
                className="font-mono text-base"
              />
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                    type="button"
                    className="font-mono text-xs"
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
              <p className="text-sm text-gray-600 mb-1">Example number:</p>
              <p className="text-2xl font-mono font-bold text-green-700">
                {preview || 'Enter format above'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sequence Padding Length</Label>
              <Input
                type="number"
                value={padding}
                onChange={e => setPadding(Number(e.target.value))}
                min={1} max={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of digits (e.g., 4 = 0001)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={reset} onCheckedChange={(checked) => setReset(!!checked)} />
              <span className="text-sm select-none">Reset annually (on January 1st)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Variable Reference */}
      <div>
        <h4 className="font-semibold mb-3">Available Variables</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VARIABLES.map((v) => (
            <div
              key={v.key}
              className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded border"
            >
              <div>
                <Badge variant="outline" className="font-mono bg-white dark:bg-black">
                  {v.key}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">{v.name}</p>
              </div>
              <span className="text-sm text-foreground">{v.example}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save Template</Button>
      </div>
    </Card>
  );
}
