'use client';

// File: app/(dashboard)/distribution-matrices/page.tsx
// Change Log
// - 2026-05-14: Add admin UI for Distribution Matrix management.
import { useState } from 'react';
import { Network, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  useCreateDistributionMatrix,
  useDeleteDistributionMatrix,
  useDistributionMatrices,
} from '@/hooks/use-distribution-matrices';
import { useProjectStore } from '@/lib/stores/project-store';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  documentTypeId: z.coerce.number().int().positive(),
  codes: z.string().optional(),
  excludeCodes: z.string().optional(),
});

type DistributionMatrixForm = z.infer<typeof formSchema>;

const splitCodes = (value?: string): string[] | undefined => {
  const codes = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return codes && codes.length > 0 ? codes : undefined;
};

export default function DistributionMatricesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const { data: matrices = [], isLoading } = useDistributionMatrices(selectedProjectId ?? undefined);
  const createMatrix = useCreateDistributionMatrix();
  const deleteMatrix = useDeleteDistributionMatrix();

  const form = useForm<DistributionMatrixForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      documentTypeId: 1,
      codes: '',
      excludeCodes: '3,4',
    },
  });

  const onSubmit = (values: DistributionMatrixForm) => {
    createMatrix.mutate(
      {
        name: values.name,
        projectPublicId: selectedProjectId ?? undefined,
        documentTypeId: values.documentTypeId,
        conditions: {
          codes: splitCodes(values.codes),
          excludeCodes: splitCodes(values.excludeCodes),
        },
      },
      {
        onSuccess: () => {
          form.reset();
          setCreateOpen(false);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Distribution Matrix</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ตั้งค่าการกระจาย RFA หลังอนุมัติผ่าน BullMQ และ Transmittal
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Matrix
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Distribution Matrix</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Shop Drawing Distribution" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type ID</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="codes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Included Codes</FormLabel>
                        <FormControl>
                          <Input placeholder="1A,1B,2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="excludeCodes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excluded Codes</FormLabel>
                        <FormControl>
                          <Input placeholder="3,4" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMatrix.isPending}>
                  {createMatrix.isPending ? 'Saving...' : 'Save Matrix'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-center text-muted-foreground py-8">Loading distribution matrices...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {matrices.map((matrix) => (
          <Card key={matrix.publicId}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{matrix.name}</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Type {matrix.documentTypeId}</Badge>
                    {(matrix.conditions?.codes ?? []).map((code) => (
                      <Badge key={code} variant="outline">
                        {code}
                      </Badge>
                    ))}
                    {(matrix.conditions?.excludeCodes ?? []).map((code) => (
                      <Badge key={code} variant="destructive">
                        Exclude {code}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMatrix.mutate(matrix.publicId)}
                  title="Deactivate matrix"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Recipients: {(matrix.recipients ?? []).length}</div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && matrices.length === 0 && (
          <div className="lg:col-span-2 text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
            <Network className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No Distribution Matrix configured.</p>
          </div>
        )}
      </div>
    </div>
  );
}
