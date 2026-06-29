'use client';

// File: app/(dashboard)/settings/reminder-rules/page.tsx
import { useState } from 'react';
import { Plus, Bell, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case ReminderType.ON_DUE:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case ReminderType.OVERDUE:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case ReminderType.ESCALATION_L1:
        return 'bg-red-100 text-red-800 border-red-200';
      case ReminderType.ESCALATION_L2:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reminder & Escalation Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ตั้งค่าการแจ้งเตือนและการยกระดับ (Escalation) เมื่อเกินกำหนด
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
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

      {isLoading && (
        <div className="text-center text-muted-foreground py-8">
          Loading rules...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <Card key={rule.publicId} className={!rule.isActive ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold ${getReminderTypeColor(
                        rule.reminderType
                      )}`}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingRule(rule)}
                  >
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
                {rule.messageTemplate && (
                  <p className="mt-2 text-xs italic line-clamp-2">
                    "{rule.messageTemplate}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!isLoading && rules.length === 0 && (
          <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No reminder rules defined.</p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => setCreateOpen(true)}
            >
              Create your first rule
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
      >
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
