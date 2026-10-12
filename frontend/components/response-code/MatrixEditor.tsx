'use client';

// File: components/response-code/MatrixEditor.tsx
// Visual editor สำหรับ Master Approval Matrix (T064, FR-022)
import React, { useState } from 'react';
import { Check, X, AlertTriangle, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MatrixRule {
  publicId: string;
  responseCode: {
    publicId: string;
    code: string;
    descriptionEn: string;
    category: string;
  };
  isEnabled: boolean;
  requiresComments: boolean;
  triggersNotification: boolean;
  isOverridden: boolean;
  isSystem?: boolean;
}

interface MatrixEditorProps {
  documentTypeCode: string;
  rules: MatrixRule[];
  isProjectLevel?: boolean;
  onToggleEnabled: (rulePublicId: string, enabled: boolean) => void;
  onToggleRequiresComments: (rulePublicId: string, value: boolean) => void;
  onToggleNotification: (rulePublicId: string, value: boolean) => void;
  isLoading?: boolean;
}

const CATEGORY_ORDER = ['ENGINEERING', 'MATERIAL', 'CONTRACT', 'TESTING', 'ESG'];

export function MatrixEditor({
  documentTypeCode,
  rules,
  isProjectLevel = false,
  onToggleEnabled,
  onToggleRequiresComments,
  onToggleNotification,
  isLoading,
}: MatrixEditorProps) {
  const [filter, setFilter] = useState<string>('ALL');

  const grouped = CATEGORY_ORDER.reduce<Record<string, MatrixRule[]>>((acc, cat) => {
    const catRules = rules.filter(
      (r) => r.responseCode.category === cat && (filter === 'ALL' || r.responseCode.category === filter)
    );
    if (catRules.length > 0) acc[cat] = catRules;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Matrix: {documentTypeCode}
            {isProjectLevel && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Project Override
              </Badge>
            )}
          </CardTitle>
          <select
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="ALL">All Categories</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24 text-center">Enabled</TableHead>
              <TableHead className="w-28 text-center">Req. Comments</TableHead>
              <TableHead className="w-28 text-center">Notify</TableHead>
              <TableHead className="w-20 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([cat, catRules]) => (
              <React.Fragment key={cat}>
                <TableRow className="bg-muted/30">
                  <TableCell
                    colSpan={6}
                    className="py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {cat}
                  </TableCell>
                </TableRow>
                {catRules.map((rule) => (
                  <TableRow key={rule.publicId} className={!rule.isEnabled ? 'opacity-50' : ''}>
                    <TableCell>
                      <span className="font-mono text-sm font-bold">{rule.responseCode.code}</span>
                    </TableCell>
                    <TableCell className="text-sm">{rule.responseCode.descriptionEn}</TableCell>
                    <TableCell className="text-center">
                      {rule.isSystem ? (
                        <Lock className="mx-auto h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={rule.isEnabled}
                          onCheckedChange={(v: boolean) => onToggleEnabled(rule.publicId, v)}
                          disabled={isLoading}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.requiresComments}
                        onCheckedChange={(v: boolean) => onToggleRequiresComments(rule.publicId, v)}
                        disabled={isLoading || !rule.isEnabled}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.triggersNotification}
                        onCheckedChange={(v: boolean) => onToggleNotification(rule.publicId, v)}
                        disabled={isLoading || !rule.isEnabled}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {rule.isOverridden ? (
                        <AlertTriangle className="mx-auto h-4 w-4 text-warning" />
                      ) : rule.isEnabled ? (
                        <Check className="mx-auto h-4 w-4 text-success" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
            {Object.keys(grouped).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No rules configured for this document type.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
