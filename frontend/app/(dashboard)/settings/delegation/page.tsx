'use client';

// File: app/(dashboard)/settings/delegation/page.tsx
// หน้าจัดการ Delegation ของตัวเอง (FR-011)
import { useState } from 'react';
import { Plus, ArrowRightLeft, Trash2 } from 'lucide-react';
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
  useMyDelegations,
  useCreateDelegation,
  useRevokeDelegation,
  Delegation,
} from '@/hooks/use-delegation';
import { useUsers } from '@/hooks/use-users';
import { DelegationForm } from '@/components/delegation/DelegationForm';
import { User } from '@/types/user';

export default function DelegationPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: delegations = [], isLoading } = useMyDelegations();
  const { data: users = [] } = useUsers({ limit: 100 });
  const createDelegation = useCreateDelegation();
  const revokeDelegation = useRevokeDelegation();

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delegation Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            มอบหมายหน้าที่ตรวจสอบให้ผู้อื่นในช่วงที่ไม่อยู่
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Delegation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Delegation</DialogTitle>
            </DialogHeader>
            <DelegationForm
              availableUsers={users.map((user: User) => ({
                publicId: user.publicId,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
              }))}
              onSubmit={(dto) =>
                createDelegation.mutate(dto, {
                  onSuccess: () => setCreateOpen(false),
                })
              }
              isLoading={createDelegation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-8">Loading delegations...</div>
      )}

      <div className="space-y-3">
        {(delegations as Delegation[]).map((d: Delegation) => {
          const isActive =
            d.isActive && d.startDate <= today && d.endDate >= today;
          const isPast = d.endDate < today;

          return (
            <Card key={d.publicId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      → {d.delegate?.fullName ?? d.delegate?.email ?? '—'}
                    </CardTitle>
                    {isActive && <Badge variant="default">Active</Badge>}
                    {isPast && <Badge variant="secondary">Expired</Badge>}
                    {!isActive && !isPast && (
                      <Badge variant="outline">Scheduled</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{d.scope}</Badge>
                  </div>
                  {!isPast && d.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeDelegation.mutate(d.publicId)}
                      disabled={revokeDelegation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  {d.startDate} → {d.endDate}
                  {d.reason && ` • ${d.reason}`}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {!isLoading && delegations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No delegations set. Create one when you need a proxy reviewer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
