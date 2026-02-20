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
import { useWorkflowDefinition, useCreateWorkflowDefinition, useUpdateWorkflowDefinition } from '@/hooks/use-workflows';
import { Workflow } from '@/types/workflow';
import { CreateWorkflowDefinitionDto } from '@/types/dto/workflow-engine/workflow-engine.dto';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function WorkflowEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id === 'new' ? null : Number(params?.id);

  const [workflowData, setWorkflowData] = useState<Partial<Workflow>>({
    workflowName: '',
    description: '',
    workflowType: 'CORRESPONDENCE',
    dslDefinition: 'name: New Workflow\nversion: 1.0\nsteps: []',
    isActive: true,
  });

  const { data: fetchedWorkflow, isLoading: loadingWorkflow } = useWorkflowDefinition(id as number);
  const createMutation = useCreateWorkflowDefinition();
  const updateMutation = useUpdateWorkflowDefinition();

  useEffect(() => {
    if (fetchedWorkflow) {
      setWorkflowData(fetchedWorkflow);
    }
  }, [fetchedWorkflow]);

  const loading = (!!id && loadingWorkflow) || createMutation.isPending || updateMutation.isPending;
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!workflowData.workflowName) {
      toast.error('Workflow name is required');
      return;
    }

    try {
      const dto: CreateWorkflowDefinitionDto = {
        workflow_code: workflowData.workflowType || 'CORRESPONDENCE',
        dsl: {
          workflowName: workflowData.workflowName,
          description: workflowData.description,
          dslDefinition: workflowData.dslDefinition,
        },
        is_active: workflowData.isActive,
      };

      if (id) {
        await updateMutation.mutateAsync({ id, data: dto });
        toast.success('Workflow updated successfully');
      } else {
        await createMutation.mutateAsync(dto);
        toast.success('Workflow created successfully');
        router.push('/admin/doc-control/workflows');
      }
    } catch (error) {
      toast.error('Failed to save workflow');
      console.error(error);
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
          <Link href="/admin/doc-control/workflows">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{id ? 'Edit Workflow' : 'New Workflow'}</h1>
            <p className="text-muted-foreground">
              {id ? `Version ${workflowData.version}` : 'Create a new workflow definition'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/doc-control/workflows">
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
                  value={workflowData.workflowName}
                  onChange={(e) =>
                    setWorkflowData({
                      ...workflowData,
                      workflowName: e.target.value,
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
                  value={workflowData.workflowType}
                  onValueChange={(value: Workflow['workflowType']) =>
                    setWorkflowData({ ...workflowData, workflowType: value })
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
                initialValue={workflowData.dslDefinition}
                onChange={(value) => setWorkflowData({ ...workflowData, dslDefinition: value })}
              />
            </TabsContent>

            <TabsContent value="visual" className="mt-4 h-[600px]">
              <VisualWorkflowBuilder
                dslString={workflowData.dslDefinition}
                onDslChange={(newDsl) => setWorkflowData({ ...workflowData, dslDefinition: newDsl })}
                onSave={() => toast.info('Visual state saving not implemented in this demo')}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
