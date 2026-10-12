'use client';

// File: app/(dashboard)/settings/reminder-rules/page.tsx
import { useState } from 'react';
import { Plus, Bell, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  useReminderRules,
  useCreateReminderRule,
  useUpdateReminderRule,
  useDeleteReminderRule,
  ReminderRule,
} from '@/hooks/use-reminder';
import { ReminderRuleForm } from '@/components/reminder/ReminderRuleForm';
import { ReminderType } from '@/types/workflow';

export default function ReminderRulesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);

  const { data: rules = [], isLoading } = useReminderRules();
  const createRule = useCreateReminderRule();
  const updateRule = useUpdateReminderRule();
  const deleteRule = useDeleteReminderRule();

  const getReminderTypeColor = (type: ReminderType) => {
    switch (type) {
      case ReminderType.DUE_SOON:
        return 'bg-info/10 text-info border-info/30';
      case ReminderType.ON_DUE:
        return 'bg-warning/10 text-warning border-warning/30';
      case ReminderType.OVERDUE:
        return 'bg-caution/10 text-caution border-caution/30';
      case ReminderType.ESCALATION_L1:
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case ReminderType.ESCALATION_L2:
        return 'bg-ai/10 text-ai border-ai/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reminder & Escalation Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ตั้งค่าการแจ้งเตือนและการยกระดับ (Escalation) เมื่อเกินกำหนด
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Reminder Rule</DialogTitle>
            </DialogHeader>
            <ReminderRuleForm
              onSubmit={(dto) =>
                createRule.mutate(dto, {
                  onSuccess: () => setCreateOpen(false),
                })
              }
              isLoading={createRule.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="py-8 text-center text-muted-foreground">Loading rules...</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <Card key={rule.publicId} className={!rule.isActive ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${getReminderTypeColor(rule.reminderType)}`}
                    >
                      {rule.reminderType}
                    </Badge>
                    {rule.escalationLevel > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        L{rule.escalationLevel}
                      </Badge>
                    )}
                    {rule.documentTypeCode && (
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.documentTypeCode}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRule(rule)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm('Delete this rule?')) {
                        deleteRule.mutate(rule.publicId);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>
                  Trigger:{' '}
                  <span className="font-medium text-foreground">
                    {rule.daysBeforeDue === 0
                      ? 'On Due Date'
                      : rule.daysBeforeDue > 0
                        ? `${rule.daysBeforeDue} days before`
                        : `${Math.abs(rule.daysBeforeDue)} days after`}
                  </span>
                </p>
                {rule.messageTemplate && <p className="mt-2 line-clamp-2 text-xs italic">"{rule.messageTemplate}"</p>}
              </div>
            </CardContent>
          </Card>
        ))}

        {!isLoading && rules.length === 0 && (
          <div className="col-span-full rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
            <Bell className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>No reminder rules defined.</p>
            <Button variant="link" className="mt-2" onClick={() => setCreateOpen(true)}>
              Create your first rule
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reminder Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <ReminderRuleForm
              defaultValues={editingRule}
              onSubmit={(dto) =>
                updateRule.mutate(
                  { publicId: editingRule.publicId, data: dto },
                  { onSuccess: () => setEditingRule(null) }
                )
              }
              isLoading={updateRule.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
