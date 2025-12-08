'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DSLEditor } from '@/components/workflows/dsl-editor';
import { VisualWorkflowBuilder } from '@/components/workflows/visual-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { workflowApi } from '@/lib/api/workflows';
import { Workflow, CreateWorkflowDto } from '@/types/workflow';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id === 'new' ? null : Number(params?.id);

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [workflowData, setWorkflowData] = useState<Partial<Workflow>>({
    workflow_name: '',
    description: '',
    workflow_type: 'CORRESPONDENCE',
    dsl_definition: 'name: New Workflow\nversion: 1.0\nsteps: []',
    is_active: true,
  });

  useEffect(() => {
    if (id) {
        const fetchWorkflow = async () => {
            try {
                const data = await workflowApi.getWorkflow(id);
                if (data) {
                    setWorkflowData(data);
                } else {
                    toast.error("Workflow not found");
                    router.push('/admin/workflows');
                }
            } catch (error) {
                toast.error("Failed to load workflow");
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflow();
    }
  }, [id, router]);

  const handleSave = async () => {
    if (!workflowData.workflow_name) {
        toast.error("Workflow name is required");
        return;
    }

    setSaving(true);
    try {
        const dto: CreateWorkflowDto = {
            workflow_name: workflowData.workflow_name || '',
            description: workflowData.description || '',
            workflow_type: workflowData.workflow_type || 'CORRESPONDENCE',
            dsl_definition: workflowData.dsl_definition || '',
        };

        if (id) {
            await workflowApi.updateWorkflow(id, dto);
            toast.success("Workflow updated successfully");
        } else {
            await workflowApi.createWorkflow(dto);
            toast.success("Workflow created successfully");
            router.push('/admin/workflows');
        }
    } catch (error) {
        toast.error("Failed to save workflow");
        console.error(error);
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-screen">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
             <Link href="/admin/workflows">
                <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
            <div>
                <h1 className="text-3xl font-bold">{id ? 'Edit Workflow' : 'New Workflow'}</h1>
                <p className="text-muted-foreground">{id ? `Version ${workflowData.version}` : 'Create a new workflow definition'}</p>
            </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/workflows">
             <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {id ? 'Save Changes' : 'Create Workflow'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
                <div className="grid gap-4">
                <div>
                    <Label htmlFor="name">Workflow Name *</Label>
                    <Input
                    id="name"
                    value={workflowData.workflow_name}
                    onChange={(e) =>
                        setWorkflowData({
                        ...workflowData,
                        workflow_name: e.target.value,
                        })
                    }
                    placeholder="e.g. Standard RFA Workflow"
                    />
                </div>

                <div>
                    <Label htmlFor="desc">Description</Label>
                    <Textarea
                    id="desc"
                    value={workflowData.description}
                    onChange={(e) =>
                        setWorkflowData({
                        ...workflowData,
                        description: e.target.value,
                        })
                    }
                    placeholder="Describe the purpose of this workflow"
                    />
                </div>

                <div>
                    <Label htmlFor="type">Workflow Type</Label>
                    <Select
                    value={workflowData.workflow_type}
                    onValueChange={(value: Workflow['workflow_type']) =>
                        setWorkflowData({ ...workflowData, workflow_type: value })
                    }
                    >
                    <SelectTrigger>
                        <SelectValue placeholder="Select type" />
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
        </div>

        <div className="lg:col-span-2">
             <Tabs defaultValue="dsl" className="w-full">
                <TabsList className="w-full justify-start">
                <TabsTrigger value="dsl">DSL Editor</TabsTrigger>
                <TabsTrigger value="visual">Visual Builder</TabsTrigger>
                </TabsList>

                <TabsContent value="dsl" className="mt-4">
                <DSLEditor
                    initialValue={workflowData.dsl_definition}
                    onChange={(value) =>
                       setWorkflowData({ ...workflowData, dsl_definition: value })
                    }
                />
                </TabsContent>

                <TabsContent value="visual" className="mt-4 h-[600px]">
                <VisualWorkflowBuilder
                   dslString={workflowData.dsl_definition}
                   onDslChange={(newDsl) => setWorkflowData({ ...workflowData, dsl_definition: newDsl })}
                   onSave={() => toast.info("Visual state saving not implemented in this demo")}
                />
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
}
