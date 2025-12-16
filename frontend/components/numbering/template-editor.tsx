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
import { cn } from '@/lib/utils';
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
  { key: '{YEAR}', name: 'Year (B.E.)', example: '2568' },
  { key: '{YEAR_SHORT}', name: 'Year Short (68)', example: '68' },
  { key: '{SEQ:4}', name: 'Sequence (4-digit)', example: '0001' },
];

export interface TemplateEditorProps {
    template?: NumberingTemplate;
    projectId: number;
    projectName: string;
    correspondenceTypes: any[];
    disciplines: any[];
    onSave: (data: Partial<NumberingTemplate>) => void;
    onCancel: () => void;
}

export function TemplateEditor({
  template,
  projectId,
  projectName,
  correspondenceTypes,
  disciplines,
  onSave,
  onCancel
}: TemplateEditorProps) {
  const [format, setFormat] = useState(template?.formatTemplate || template?.templateFormat || '');
  const [typeId, setTypeId] = useState<string>(template?.correspondenceTypeId?.toString() || '');
  const [disciplineId, setDisciplineId] = useState<string>(template?.disciplineId?.toString() || '0');
  const [padding, setPadding] = useState(template?.paddingLength || 4);
  const [reset, setReset] = useState(template?.resetAnnually ?? true);
  const [isActive, setIsActive] = useState(template?.isActive ?? true);

  const [preview, setPreview] = useState('');

  useEffect(() => {
    // Generate preview
    let previewText = format || '';
    VARIABLES.forEach((v) => {
        // Simple mock replacement for preview
        let replacement = v.example;
        if (v.key === '{YEAR}') replacement = (new Date().getFullYear() + 543).toString();
        if (v.key === '{YEAR_SHORT}') replacement = (new Date().getFullYear() + 543).toString().slice(-2);

        // Dynamic context based on selection (optional visual enhancement)
        if (v.key === '{TYPE}' && typeId) {
             const t = correspondenceTypes.find(ct => ct.id.toString() === typeId);
             if (t) replacement = t.typeCode;
        }
        if (v.key === '{DISCIPLINE}' && disciplineId !== '0') {
             const d = disciplines.find(di => di.id.toString() === disciplineId);
             if (d) replacement = d.disciplineCode;
        }

        previewText = previewText.replace(new RegExp(v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
    setPreview(previewText);
  }, [format, typeId, disciplineId, correspondenceTypes, disciplines]);

  const insertVariable = (variable: string) => {
    setFormat((prev) => prev + variable);
  };

  const handleSave = () => {
      onSave({
          ...template,
          projectId: projectId,
          correspondenceTypeId: typeId && typeId !== '__default__' ? Number(typeId) : null,
          disciplineId: Number(disciplineId),
          formatTemplate: format,
          templateFormat: format, // Legacy support
          paddingLength: padding,
          resetAnnually: reset,
          isActive: isActive,
          exampleNumber: preview
      });
  };

  const isValid = format.length > 0; // typeId is optional (null = default for all types)

  return (
    <Card className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <h3 className="text-lg font-semibold">{template ? 'Edit Template' : 'New Template'}</h3>
             <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? 'Active' : 'Inactive'}
             </Badge>
           </div>
           <p className="text-sm text-muted-foreground">Define how document numbers are generated for this project.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
             <Badge variant="outline" className="text-base px-3 py-1 bg-slate-50">
                Project: {projectName}
            </Badge>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
               <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
               Active
            </label>
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
                    {correspondenceTypes.map((type) => (
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

              <div>
                <Label>Discipline (Optional)</Label>
                <Select value={disciplineId} onValueChange={setDisciplineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All/None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Disciplines (Default)</SelectItem>
                    {disciplines.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.disciplineCode} - {d.disciplineName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                   Specific discipline templates take precedence over 'All'.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Padding Length</Label>
                  <Input
                    type="number"
                    value={padding}
                    onChange={e => setPadding(Number(e.target.value))}
                    min={1} max={10}
                  />
                </div>
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
