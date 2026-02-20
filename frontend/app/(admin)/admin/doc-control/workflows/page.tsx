'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Copy, Trash, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Workflow } from '@/types/workflow';
import { workflowApi } from '@/lib/api/workflows';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true);
      try {
        const data = await workflowApi.getWorkflows();
        setWorkflows(data);
      } catch (error) {
        console.error('Failed to fetch workflows', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflow Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage workflow definitions and routing rules</p>
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
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.workflowId} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{workflow.workflowName}</h3>
                    <Badge
                      variant={workflow.isActive ? 'default' : 'secondary'}
                      className={workflow.isActive ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">v{workflow.version}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>Type: {workflow.workflowType}</span>
                    <span>Steps: {workflow.stepCount}</span>
                    <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/admin/doc-control/workflows/${workflow.workflowId}/edit`}>
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
