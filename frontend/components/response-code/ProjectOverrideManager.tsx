'use client';

// File: components/response-code/ProjectOverrideManager.tsx
// จัดการ project-specific overrides ของ Master Approval Matrix (T065)
import React, { useState } from 'react';
import { Plus, Trash2, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface OverrideRule {
  publicId: string;
  responseCode: {
    code: string;
    descriptionEn: string;
    category: string;
  };
  documentTypeCode: string;
  isEnabled: boolean;
  requiresComments: boolean;
  triggersNotification: boolean;
}

interface ProjectOverrideManagerProps {
  projectPublicId: string;
  projectName: string;
  overrides: OverrideRule[];
  onDeleteOverride: (rulePublicId: string) => void;
  onAddOverride: () => void;
  isLoading?: boolean;
}

export function ProjectOverrideManager({
  projectPublicId: _projectPublicId,
  projectName,
  overrides,
  onDeleteOverride,
  onAddOverride,
  isLoading,
}: ProjectOverrideManagerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const grouped = overrides.reduce<Record<string, OverrideRule[]>>((acc, rule) => {
    const key = rule.documentTypeCode;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{projectName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overrides.length} project-specific override(s)
            </p>
          </div>
          <Button size="sm" onClick={onAddOverride} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-1" />
            Add Override
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {overrides.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <ArrowDownToLine className="h-4 w-4" />
            <span>Inheriting all rules from global defaults</span>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([docType, rules]) => (
              <div key={docType}>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  {docType}
                </p>
                <div className="space-y-1.5">
                  {rules.map((rule) => (
                    <div
                      key={rule.publicId}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold">
                          {rule.responseCode.code}
                        </span>
                        <span className="text-sm">{rule.responseCode.descriptionEn}</span>
                        <Badge variant={rule.isEnabled ? 'default' : 'outline'} className="text-xs">
                          {rule.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {rule.requiresComments && (
                          <Badge variant="secondary" className="text-xs">Req. Comments</Badge>
                        )}
                      </div>

                      <AlertDialog
                        open={confirmDelete === rule.publicId}
                        onOpenChange={(open: boolean) => !open && setConfirmDelete(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmDelete(rule.publicId)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Override?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revert code <strong>{rule.responseCode.code}</strong> to the
                              global default settings for this project.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                onDeleteOverride(rule.publicId);
                                setConfirmDelete(null);
                              }}
                            >
                              Remove Override
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
