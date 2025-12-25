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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

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
    projectId: number;
    projectName: string;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    correspondenceTypes: any[];
    disciplines: any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
    onSave: (data: Partial<NumberingTemplate>) => void;
    onCancel: () => void;
}

export function TemplateEditor({
  template,
  projectId,
  projectName,
  correspondenceTypes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disciplines,
  onSave,
  onCancel
}: TemplateEditorProps) {
  const [format, setFormat] = useState(template?.formatTemplate || '');
  const [typeId, setTypeId] = useState<string>(template?.correspondenceTypeId?.toString() || '');
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
             const t = correspondenceTypes.find(ct => ct.id.toString() === typeId);
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
          formatTemplate: format,
          resetSequenceYearly: reset,
      });
  };

  const isValid = format.length > 0; // typeId is optional (null = default for all types)

  return (
    <Card className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <h3 className="text-lg font-semibold">{template ? 'Edit Template' : 'New Template'}</h3>
           </div>
           <p className="text-sm text-muted-foreground">Define how document numbers are generated for this project.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
             <Badge variant="outline" className="text-base px-3 py-1 bg-slate-50">
                Project: {projectName}
            </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {correspondenceTypes.map((type: any) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.typeCode} - {type.typeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                   Leave empty to create a default template for this project.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <Label>Reset Rule</Label>
                   <div className="flex items-center h-10">
                      <label className="flex items-center gap-2 cursor-pointer">
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
                <Label>Template Format *</Label>
                <Input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="{ORG}-{TYPE}-{SEQ:4}"
                  className="font-mono text-base mb-2"
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
                            className="font-mono text-xs bg-slate-50 hover:bg-slate-100"
                          >
                            {v.key}
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-60 p-3">
                           <p className="font-semibold text-sm">{v.name}</p>
                           <p className="text-xs text-muted-foreground mt-1">Example: <span className="font-mono">{v.example}</span></p>
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
              </div>

              <div className="bg-green-50/50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-2">Preview Output</p>
                  <p className="text-2xl font-mono font-bold text-green-800 tracking-tight">
                    {preview || '...'}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                     * This is an approximation. Actual numbers depend on runtime context.
                  </p>
              </div>
          </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={!isValid}>Save Template</Button>
      </div>
    </Card>
  );
}
