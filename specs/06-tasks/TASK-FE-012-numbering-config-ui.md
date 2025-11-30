# TASK-FE-012: Document Numbering Configuration UI

**ID:** TASK-FE-012
**Title:** Document Numbering Template Management UI
**Category:** Administration
**Priority:** P2 (Medium)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-010, TASK-BE-004
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build UI for configuring and managing document numbering templates including template builder, preview generator, and number sequence management.

---

## 🎯 Objectives

1. Create numbering template list and management
2. Build template editor with format preview
3. Implement template variable selector
4. Add numbering sequence viewer
5. Create template testing interface
6. Implement annual reset configuration

---

## ✅ Acceptance Criteria

- [ ] List all numbering templates by document type
- [ ] Create/edit templates with format preview
- [ ] Template variables easily selectable
- [ ] Preview shows example numbers
- [ ] View current number sequences
- [ ] Annual reset configurable
- [ ] Validation prevents conflicts

---

## 🔧 Implementation Steps

### Step 1: Template List Page

```typescript
// File: src/app/(admin)/admin/numbering/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Eye } from 'lucide-react';

export default function NumberingPage() {
  const [templates, setTemplates] = useState([]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            Document Numbering Configuration
          </h1>
          <p className="text-gray-600 mt-1">
            Manage document numbering templates and sequences
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4">
        {templates.map((template: any) => (
          <Card key={template.template_id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">
                    {template.document_type_name}
                  </h3>
                  <Badge>{template.discipline_code || 'All'}</Badge>
                  <Badge variant={template.is_active ? 'success' : 'secondary'}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="bg-gray-100 rounded px-3 py-2 mb-3 font-mono text-sm">
                  {template.template_format}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Example: </span>
                    <span className="font-medium">
                      {template.example_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Sequence: </span>
                    <span className="font-medium">
                      {template.current_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Annual Reset: </span>
                    <span className="font-medium">
                      {template.reset_annually ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Padding: </span>
                    <span className="font-medium">
                      {template.padding_length} digits
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  View Sequences
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### Step 2: Template Editor Component

```typescript
// File: src/components/numbering/template-editor.tsx
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

const VARIABLES = [
  { key: '{ORG}', name: 'Organization Code', example: 'กทท' },
  { key: '{DOCTYPE}', name: 'Document Type', example: 'CORR' },
  { key: '{DISC}', name: 'Discipline', example: 'STR' },
  { key: '{YYYY}', name: 'Year (4-digit)', example: '2025' },
  { key: '{YY}', name: 'Year (2-digit)', example: '25' },
  { key: '{MM}', name: 'Month', example: '12' },
  { key: '{SEQ}', name: 'Sequence Number', example: '0001' },
  { key: '{CONTRACT}', name: 'Contract Code', example: 'C01' },
];

export function TemplateEditor({ template, onSave }: any) {
  const [format, setFormat] = useState(template?.template_format || '');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    // Generate preview
    let previewText = format;
    VARIABLES.forEach((v) => {
      previewText = previewText.replace(new RegExp(v.key, 'g'), v.example);
    });
    setPreview(previewText);
  }, [format]);

  const insertVariable = (variable: string) => {
    setFormat((prev) => prev + variable);
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Template Configuration</h3>

        <div className="grid gap-4">
          <div>
            <Label>Document Type *</Label>
            <Select>
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
            <Select>
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
                value={format}
                onChange={(e) => setFormat(e.target.value)}
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
              <p className="text-sm text-gray-600 mb-1">Example number:</p>
              <p className="text-2xl font-mono font-bold text-green-700">
                {preview || 'Enter format above'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sequence Padding Length</Label>
              <Input type="number" defaultValue={4} min={1} max={10} />
              <p className="text-xs text-gray-500 mt-1">
                Number of digits (e.g., 4 = 0001, 0002)
              </p>
            </div>

            <div>
              <Label>Starting Number</Label>
              <Input type="number" defaultValue={1} min={1} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Checkbox defaultChecked />
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
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div>
                <Badge variant="outline" className="font-mono">
                  {v.key}
                </Badge>
                <p className="text-xs text-gray-600 mt-1">{v.name}</p>
              </div>
              <span className="text-sm text-gray-500">{v.example}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={onSave}>Save Template</Button>
      </div>
    </Card>
  );
}
```

### Step 3: Number Sequence Viewer

```typescript
// File: src/components/numbering/sequence-viewer.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';

export function SequenceViewer({ templateId }: { templateId: number }) {
  const [sequences, setSequences] = useState([]);
  const [search, setSearch] = useState('');

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Number Sequences</h3>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by year, organization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {sequences.map((seq: any) => (
          <div
            key={seq.sequence_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{seq.year}</span>
                {seq.organization_code && (
                  <Badge>{seq.organization_code}</Badge>
                )}
                {seq.discipline_code && (
                  <Badge variant="outline">{seq.discipline_code}</Badge>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Current: {seq.current_number} | Last Generated:{' '}
                {seq.last_generated_number}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Updated {new Date(seq.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### Step 4: Template Testing Dialog

```typescript
// File: src/components/numbering/template-tester.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export function TemplateTester({ open, onOpenChange, template }: any) {
  const [testData, setTestData] = useState({
    organization_id: 1,
    discipline_id: null,
    year: new Date().getFullYear(),
  });
  const [generatedNumber, setGeneratedNumber] = useState('');

  const handleTest = async () => {
    // Call API to generate test number
    const response = await fetch('/api/numbering/test', {
      method: 'POST',
      body: JSON.stringify({ template_id: template.template_id, ...testData }),
    });
    const result = await response.json();
    setGeneratedNumber(result.number);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Number Generation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Organization</Label>
            <Select value={testData.organization_id.toString()}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">กทท.</SelectItem>
                <SelectItem value="2">สค©.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discipline (Optional)</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">STR</SelectItem>
                <SelectItem value="2">ARC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleTest} className="w-full">
            Generate Test Number
          </Button>

          {generatedNumber && (
            <Card className="p-4 bg-green-50 border-green-200">
              <p className="text-sm text-gray-600 mb-1">Generated Number:</p>
              <p className="text-2xl font-mono font-bold text-green-700">
                {generatedNumber}
              </p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📦 Deliverables

- [ ] Template list page
- [ ] Template editor with variable selector
- [ ] Live preview generator
- [ ] Number sequence viewer
- [ ] Template testing interface
- [ ] Annual reset configuration
- [ ] Validation rules

---

## 🧪 Testing

1. **Template Creation**

   - Create template → Preview updates
   - Insert variables → Format correct
   - Save template → Persists

2. **Number Generation**

   - Test template → Generates number
   - Variables replaced correctly
   - Sequence increments

3. **Sequence Management**
   - View sequences → Shows all active sequences
   - Search sequences → Filters correctly

---

## 🔗 Related Documents

- [TASK-BE-004: Document Numbering](./TASK-BE-004-document-numbering.md)
- [ADR-002: Document Numbering Strategy](../../05-decisions/ADR-002-document-numbering-strategy.md)

---

**Created:** 2025-12-01
**Status:** Ready
