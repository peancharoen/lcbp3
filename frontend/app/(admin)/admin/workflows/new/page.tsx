"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DSLEditor } from "@/components/workflows/dsl-editor";
import { VisualWorkflowBuilder } from "@/components/workflows/visual-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workflowApi } from "@/lib/api/workflows";
import { WorkflowType } from "@/types/workflow";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [workflowData, setWorkflowData] = useState({
    workflowName: "",
    description: "",
    workflowType: "CORRESPONDENCE" as WorkflowType,
    dslDefinition: 'name: New Workflow\nversion: 1.0\nsteps: []',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await workflowApi.createWorkflow(workflowData);
      router.push("/admin/workflows");
    } catch (error) {
      console.error("Failed to create workflow", error);
      alert("Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">New Workflow</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Workflow
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="workflow_name">Workflow Name *</Label>
            <Input
              id="workflow_name"
              value={workflowData.workflowName}
              onChange={(e) =>
                setWorkflowData({
                  ...workflowData,
                  workflowName: e.target.value,
                })
              }
              placeholder="e.g., Special RFA Approval"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
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
            <Label htmlFor="workflow_type">Workflow Type</Label>
            <Select
              value={workflowData.workflowType}
              onValueChange={(value) =>
                setWorkflowData({ ...workflowData, workflowType: value as WorkflowType })
              }
            >
              <SelectTrigger id="workflow_type">
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

        <TabsContent value="dsl" className="mt-4">
          <DSLEditor
            initialValue={workflowData.dslDefinition}
            onChange={(value) =>
              setWorkflowData({ ...workflowData, dslDefinition: value })
            }
          />
        </TabsContent>

        <TabsContent value="visual" className="mt-4">
          <VisualWorkflowBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
