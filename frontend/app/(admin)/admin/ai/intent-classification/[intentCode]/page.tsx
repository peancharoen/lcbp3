'use client';

// File: app/(admin)/admin/ai/intent-classification/[intentCode]/page.tsx
// Change Log
// - 2026-05-19: สร้างหน้า Intent Detail + Patterns (Admin, ADR-024).

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useIntentDefinition,
  useUpdateIntentDefinition,
  useIntentPatterns,
  useCreateIntentPattern,
  useDeleteIntentPattern,
} from '@/hooks/ai/use-intent-classification';
import { PatternForm } from '@/components/ai/intent-classification/pattern-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { PatternType, PatternLanguage } from '@/lib/services/ai-intent.service';

export default function IntentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const intentCode = params.intentCode as string;

  const [showPatternForm, setShowPatternForm] = useState(false);

  const { data: definition, isLoading: defLoading } = useIntentDefinition(intentCode);
  const updateMutation = useUpdateIntentDefinition(intentCode);
  const { data: patterns, isLoading: patternsLoading } = useIntentPatterns(intentCode);
  const createPatternMutation = useCreateIntentPattern(intentCode);
  const deletePatternMutation = useDeleteIntentPattern(intentCode);

  const handleToggleActive = async (isActive: boolean) => {
    await updateMutation.mutateAsync({ isActive });
  };

  const handleCreatePattern = async (data: {
    patternType: PatternType;
    patternValue: string;
    language?: PatternLanguage;
    priority?: number;
  }) => {
    await createPatternMutation.mutateAsync(data);
    setShowPatternForm(false);
  };

  const handleDeletePattern = async (publicId: string) => {
    if (!confirm('ต้องการลบ Pattern นี้?')) return;
    await deletePatternMutation.mutateAsync(publicId);
  };

  if (defLoading) {
    return <p className="text-center py-8 text-muted-foreground">กำลังโหลด...</p>;
  }

  if (!definition) {
    return <p className="text-center py-8 text-destructive">ไม่พบ Intent: {intentCode}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/ai/intent-classification')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono">{definition.intentCode}</h1>
          <p className="text-muted-foreground">{definition.descriptionTh}</p>
          <p className="text-sm text-muted-foreground">{definition.descriptionEn}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active</span>
          <Switch
            checked={definition.isActive}
            onCheckedChange={handleToggleActive}
          />
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-4 flex gap-4">
          <Badge variant="secondary">{definition.category}</Badge>
          <span className="text-sm text-muted-foreground">
            สร้างเมื่อ: {new Date(definition.createdAt).toLocaleString('th-TH')}
          </span>
        </CardContent>
      </Card>

      {/* Patterns Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Patterns ({patterns?.length || 0})</CardTitle>
          <Button size="sm" onClick={() => setShowPatternForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            เพิ่ม Pattern
          </Button>
        </CardHeader>
        <CardContent>
          {patternsLoading ? (
            <p className="text-center text-muted-foreground py-4">กำลังโหลด...</p>
          ) : patterns && patterns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Pattern Value</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((p) => (
                  <TableRow key={p.publicId}>
                    <TableCell>
                      <Badge variant="outline">{p.patternType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {p.patternValue}
                    </TableCell>
                    <TableCell>{p.language}</TableCell>
                    <TableCell>{p.priority}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? 'default' : 'destructive'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePattern(p.publicId)}
                        disabled={deletePatternMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              ยังไม่มี Pattern — เพิ่มเพื่อให้ Pattern Matching ทำงาน
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create Pattern Form Dialog */}
      <PatternForm
        open={showPatternForm}
        onClose={() => setShowPatternForm(false)}
        onSubmit={handleCreatePattern}
        isLoading={createPatternMutation.isPending}
      />
    </div>
  );
}
