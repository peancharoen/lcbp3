'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Copy, Trash, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useWorkflowDefinitions } from '@/hooks/use-workflows';
import { Workflow } from '@/types/workflow';

export default function WorkflowsPage() {
  const { data: workflows = [], isLoading: loading, error } = useWorkflowDefinitions();
  const workflowList = Array.isArray(workflows) ? workflows : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Configuration</h1>
          <p className="mt-1 text-muted-foreground">Manage workflow definitions and routing rules</p>
        </div>
        <Link href="/admin/doc-control/workflows/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/10 py-12 text-center text-destructive">
          Failed to load workflows. Please try again later.
        </div>
      ) : workflowList.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          No workflow definitions found. Click &quot;New Workflow&quot; to create one.
        </div>
      ) : (
        <div className="grid gap-4">
          {workflowList.map((workflow: Workflow) => (
            <Card key={workflow.publicId} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{workflow.workflowName}</h3>
                    <Badge
                      variant={workflow.isActive ? 'default' : 'secondary'}
                      className={workflow.isActive ? 'bg-success hover:bg-success/90' : ''}
                    >
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">v{workflow.version}</Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{workflow.description}</p>
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>Type: {workflow.workflowType}</span>
                    <span>Steps: {workflow.stepCount}</span>
                    <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/admin/doc-control/workflows/${workflow.publicId}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => alert('Clone functionality mocked')}>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => alert('Delete functionality mocked')}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
