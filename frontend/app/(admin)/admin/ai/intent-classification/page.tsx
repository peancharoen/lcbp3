'use client';

// File: app/(admin)/admin/ai/intent-classification/page.tsx
// Change Log
// - 2026-05-19: สร้างหน้า Intent Definitions List (Admin, ADR-024).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useIntentDefinitions,
  useCreateIntentDefinition,
} from '@/hooks/ai/use-intent-classification';
import { IntentForm } from '@/components/ai/intent-classification/intent-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Brain, TestTube } from 'lucide-react';
import type { IntentCategory } from '@/lib/services/ai-intent.service';

/** สีของ category badge */
const CATEGORY_COLORS: Record<IntentCategory, string> = {
  read: 'bg-blue-100 text-blue-800',
  suggest: 'bg-purple-100 text-purple-800',
  utility: 'bg-gray-100 text-gray-800',
};

export default function IntentClassificationPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const { data: definitions, isLoading } = useIntentDefinitions();
  const createMutation = useCreateIntentDefinition();

  const handleCreate = async (data: {
    intentCode: string;
    descriptionTh: string;
    descriptionEn: string;
    category: IntentCategory;
  }) => {
    await createMutation.mutateAsync(data);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Intent Classification
          </h1>
          <p className="text-muted-foreground mt-1">
            จัดการ Intent Definitions และ Patterns สำหรับ AI Chat
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/ai/intent-classification/test-console')}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test Console
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            สร้าง Intent
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Intent Definitions ({definitions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intent Code</TableHead>
                  <TableHead>คำอธิบาย</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>Patterns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions?.map((def) => (
                  <TableRow
                    key={def.publicId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        `/admin/ai/intent-classification/${def.intentCode}`
                      )
                    }
                  >
                    <TableCell className="font-mono font-medium">
                      {def.intentCode}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{def.descriptionTh}</div>
                      <div className="text-xs text-muted-foreground">
                        {def.descriptionEn}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={CATEGORY_COLORS[def.category]}
                      >
                        {def.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={def.isActive ? 'default' : 'destructive'}>
                        {def.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {def.patterns?.length || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Form Dialog */}
      <IntentForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
