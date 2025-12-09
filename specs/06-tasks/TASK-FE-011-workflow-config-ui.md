# TASK-FE-011: Workflow Configuration UI

**ID:** TASK-FE-011
**Title:** Workflow DSL Builder & Configuration UI
**Category:** Administration
**Priority:** P2 (Medium)
**Effort:** 5-7 days
**Dependencies:** TASK-FE-010, TASK-BE-006
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build UI for configuring and managing workflows using the DSL-based workflow engine, including visual workflow builder, DSL editor, and workflow testing interface.

---

## 🎯 Objectives

1. Create workflow list and management interface
2. Build DSL editor with syntax highlighting
3. Implement visual workflow builder (drag-and-drop)
4. Add workflow validation and testing tools
5. Create workflow template library
6. Implement workflow versioning UI

---

## ✅ Acceptance Criteria

- [x] List all workflows with status
- [x] Create/edit workflows with DSL editor
- [x] Visual workflow builder functional
- [x] DSL validation shows errors
- [x] Test workflow with sample data
- [ ] Workflow templates available
- [ ] Version history viewable

---

## 🔧 Implementation Steps

### Step 1: Workflow List Page

```typescript
// File: src/app/(admin)/admin/workflows/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Copy, Trash } from 'lucide-react';
import Link from 'next/link';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflow Configuration</h1>
          <p className="text-gray-600 mt-1">
            Manage workflow definitions and routing rules
          </p>
        </div>
        <Link href="/admin/workflows/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {workflows.map((workflow: any) => (
          <Card key={workflow.workflow_id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">
                    {workflow.workflow_name}
                  </h3>
                  <Badge variant={workflow.is_active ? 'success' : 'secondary'}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">v{workflow.version}</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {workflow.description}
                </p>
                <div className="flex gap-6 text-sm text-gray-500">
                  <span>Type: {workflow.workflow_type}</span>
                  <span>Steps: {workflow.step_count}</span>
                  <span>
                    Updated:{' '}
                    {new Date(workflow.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/admin/workflows/${workflow.workflow_id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
                <Button variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </Button>
                <Button variant="outline" size="sm" className="text-red-600">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
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

### Step 2: DSL Editor Component

```typescript
// File: src/components/workflows/dsl-editor.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Play } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface DSLEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export function DSLEditor({ initialValue = '', onChange }: DSLEditorProps) {
  const [dsl, setDsl] = useState(initialValue);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || '';
    setDsl(newValue);
    onChange?.(newValue);
    setValidationResult(null); // Clear validation on change
  };

  const validateDSL = async () => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/workflows/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsl }),
      });
      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      setValidationResult({ valid: false, errors: ['Validation failed'] });
    } finally {
      setIsValidating(false);
    }
  };

  const testWorkflow = async () => {
    // Open test dialog
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Workflow DSL</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={validateDSL}
            disabled={isValidating}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Validate
          </Button>
          <Button variant="outline" onClick={testWorkflow}>
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Editor
          height="500px"
          defaultLanguage="yaml"
          value={dsl}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            rulers: [80],
            wordWrap: 'on',
          }}
        />
      </Card>

      {validationResult && (
        <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
          {validationResult.valid ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {validationResult.valid ? (
              'DSL is valid ✓'
            ) : (
              <div>
                <p className="font-medium mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors?.map((error: string, i: number) => (
                    <li key={i} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### Step 3: Visual Workflow Builder

```typescript
// File: src/components/workflows/visual-builder.tsx
'use client';

import { useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const nodeTypes = {
  start: { color: '#10b981' },
  step: { color: '#3b82f6' },
  condition: { color: '#f59e0b' },
  end: { color: '#ef4444' },
};

export function VisualWorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `${type} Node` },
      style: {
        background: nodeTypes[type]?.color || '#gray',
        color: 'white',
        padding: 10,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const generateDSL = () => {
    // Convert visual workflow to DSL
    const dsl = {
      name: 'Generated Workflow',
      steps: nodes.map((node) => ({
        step_name: node.data.label,
        step_type: 'APPROVAL',
      })),
    };
    return JSON.stringify(dsl, null, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => addNode('start')} variant="outline">
          Add Start
        </Button>
        <Button onClick={() => addNode('step')} variant="outline">
          Add Step
        </Button>
        <Button onClick={() => addNode('condition')} variant="outline">
          Add Condition
        </Button>
        <Button onClick={() => addNode('end')} variant="outline">
          Add End
        </Button>
        <Button onClick={generateDSL} className="ml-auto">
          Generate DSL
        </Button>
      </div>

      <Card className="h-[600px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <Background />
        </ReactFlow>
      </Card>
    </div>
  );
}
```

### Step 4: Workflow Editor Page

```typescript
// File: src/app/(admin)/admin/workflows/[id]/edit/page.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DSLEditor } from '@/components/workflows/dsl-editor';
import { VisualWorkflowBuilder } from '@/components/workflows/visual-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function WorkflowEditPage() {
  const [workflowData, setWorkflowData] = useState({
    workflow_name: '',
    description: '',
    workflow_type: 'CORRESPONDENCE',
    dsl_definition: '',
  });

  const handleSave = async () => {
    // Save workflow
    console.log('Saving workflow:', workflowData);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Edit Workflow</h1>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button onClick={handleSave}>Save Workflow</Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4">
          <div>
            <Label>Workflow Name *</Label>
            <Input
              value={workflowData.workflow_name}
              onChange={(e) =>
                setWorkflowData({
                  ...workflowData,
                  workflow_name: e.target.value,
                })
              }
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={workflowData.description}
              onChange={(e) =>
                setWorkflowData({
                  ...workflowData,
                  description: e.target.value,
                })
              }
            />
          </div>

          <div>
            <Label>Workflow Type</Label>
            <Select
              value={workflowData.workflow_type}
              onValueChange={(value) =>
                setWorkflowData({ ...workflowData, workflow_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CORRESPONDENCE">Correspondence</SelectItem>
                <SelectItem value="RFA">RFA</SelectItem>
                <SelectItem value="DRAWING">Drawing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="dsl">
        <TabsList>
          <TabsTrigger value="dsl">DSL Editor</TabsTrigger>
          <TabsTrigger value="visual">Visual Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="dsl">
          <DSLEditor
            initialValue={workflowData.dsl_definition}
            onChange={(value) =>
              setWorkflowData({ ...workflowData, dsl_definition: value })
            }
          />
        </TabsContent>

        <TabsContent value="visual">
          <VisualWorkflowBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 📦 Deliverables

- [ ] Workflow list page
- [ ] DSL editor with syntax highlighting
- [ ] DSL validation endpoint integration
- [ ] Visual workflow builder (ReactFlow)
- [ ] Workflow testing interface
- [ ] Template library
- [ ] Version history viewer

---

## 🧪 Testing

1. **DSL Editor**

   - Write valid DSL → Validates successfully
   - Write invalid DSL → Shows errors
   - Save workflow → DSL persists

2. **Visual Builder**

   - Add nodes → Nodes appear
   - Connect nodes → Edges created
   - Generate DSL → Valid DSL output

3. **Workflow Management**
   - Create workflow → Saves to DB
   - Edit workflow → Updates correctly
   - Clone workflow → Creates copy

---

## 🔗 Related Documents

- [TASK-BE-006: Workflow Engine](./TASK-BE-006-workflow-engine.md)
- [ADR-001: Unified Workflow Engine](../../05-decisions/ADR-001-unified-workflow-engine.md)

---

**Created:** 2025-12-01
**Status:** ✅ Completed
**Completed Date:** 2025-12-09
