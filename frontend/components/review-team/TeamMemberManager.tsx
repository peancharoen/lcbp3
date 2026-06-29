'use client';

// File: components/review-team/TeamMemberManager.tsx
// จัดการสมาชิกของ Review Team แยกตาม Discipline (FR-001)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, UserPlus } from 'lucide-react';
import { useAddTeamMember, useRemoveTeamMember } from '@/hooks/use-review-teams';
import { ReviewTeamMemberRole } from '@/types/review-team';

interface Member {
  publicId: string;
  role: ReviewTeamMemberRole;
  user?: { publicId: string; fullName?: string; email?: string };
  discipline?: { publicId: string; disciplineCode: string; codeNameEn?: string };
}

interface User {
  publicId: string;
  fullName?: string;
  email?: string;
}

interface Discipline {
  id?: number;
  disciplineCode: string;
  codeNameEn?: string;
}

interface TeamMemberManagerProps {
  teamPublicId: string;
  members: Member[];
  availableUsers: User[];
  availableDisciplines: Discipline[];
}

const ROLE_LABELS: Record<ReviewTeamMemberRole, string> = {
  REVIEWER: 'Reviewer',
  LEAD: 'Lead',
  MANAGER: 'Manager',
};

const ROLE_BADGE_VARIANT: Record<ReviewTeamMemberRole, 'default' | 'secondary' | 'outline'> = {
  LEAD: 'default',
  MANAGER: 'secondary',
  REVIEWER: 'outline',
};

export function TeamMemberManager({
  teamPublicId,
  members,
  availableUsers,
  availableDisciplines,
}: TeamMemberManagerProps) {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [selectedRole, setSelectedRole] = useState<ReviewTeamMemberRole>('REVIEWER');

  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const handleAdd = () => {
    const disciplineId = Number(selectedDiscipline);

    if (!selectedUser || Number.isNaN(disciplineId)) return;

    addMember.mutate(
      {
        teamPublicId,
        data: {
          userPublicId: selectedUser,
          disciplineId,
          role: selectedRole,
        },
      },
      {
        onSuccess: () => {
          setSelectedUser('');
          setSelectedDiscipline('');
          setSelectedRole('REVIEWER');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Member List */}
      <div className="space-y-2">
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground">No members assigned yet.</p>
        )}
        {members.map((member) => (
          <div
            key={member.publicId}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium">
                  {member.user?.fullName ?? member.user?.email ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.discipline?.disciplineCode} — {member.discipline?.codeNameEn}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={ROLE_BADGE_VARIANT[member.role]}>
                {ROLE_LABELS[member.role]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  removeMember.mutate({ teamPublicId, memberPublicId: member.publicId })
                }
                disabled={removeMember.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Member Form */}
      <div className="flex gap-2 pt-2 border-t">
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.publicId} value={u.publicId}>
                {u.fullName ?? u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Discipline..." />
          </SelectTrigger>
          <SelectContent>
            {availableDisciplines.map((d) => (
              <SelectItem key={String(d.id)} value={String(d.id)}>
                {d.disciplineCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedRole}
          onValueChange={(v: string) => setSelectedRole(v as ReviewTeamMemberRole)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as ReviewTeamMemberRole[]).map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAdd} disabled={!selectedUser || !selectedDiscipline || addMember.isPending}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
