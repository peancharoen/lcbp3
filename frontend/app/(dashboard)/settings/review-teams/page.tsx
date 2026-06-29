'use client';

// File: app/(dashboard)/settings/review-teams/page.tsx
// หน้าจัดการ Review Teams (FR-001, FR-002)
import { useState } from 'react';
import { Plus, Users, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useReviewTeams, useCreateReviewTeam, useUpdateReviewTeam } from '@/hooks/use-review-teams';
import { ReviewTeamForm } from '@/components/review-team/ReviewTeamForm';
import { TeamMemberManager } from '@/components/review-team/TeamMemberManager';
import { ReviewTeam } from '@/types/review-team';
import { useProjectStore } from '@/lib/stores/project-store';
import { useUsers } from '@/hooks/use-users';
import { useContracts, useDisciplines } from '@/hooks/use-master-data';

export default function ReviewTeamsPage() {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<ReviewTeam | null>(null);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const { data: availableUsers = [] } = useUsers();
  const { data: contracts = [] } = useContracts(selectedProjectId ?? undefined);
  const primaryContractId = contracts[0]?.publicId;
  const { data: availableDisciplines = [] } = useDisciplines(primaryContractId);

  const { data: teams = [], isLoading } = useReviewTeams({
    projectPublicId: selectedProjectId ?? undefined,
  });

  const createTeam = useCreateReviewTeam();
  const updateTeam = useUpdateReviewTeam();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">
            จัดการทีมตรวจสอบแยกตาม Discipline สำหรับ Parallel Review
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Review Team</DialogTitle>
            </DialogHeader>
            <ReviewTeamForm
              projectPublicId={selectedProjectId ?? ''}
              onSubmit={(values) =>
                createTeam.mutate(values, {
                  onSuccess: () => setCreateOpen(false),
                })
              }
              isLoading={createTeam.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-8">Loading teams...</div>
      )}

      <div className="space-y-3">
        {(teams as ReviewTeam[]).map((team) => (
          <Card key={team.publicId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  {!team.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  {(team.defaultForRfaTypes ?? []).map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditTeam(team)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setExpandedTeam(expandedTeam === team.publicId ? null : team.publicId)
                    }
                  >
                    {expandedTeam === team.publicId ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {team.description && (
                <p className="text-xs text-muted-foreground mt-1">{team.description}</p>
              )}
            </CardHeader>

            {expandedTeam === team.publicId && (
              <CardContent>
                <div className="text-sm font-medium mb-3">
                  Members ({(team.members ?? []).length})
                </div>
                <TeamMemberManager
                  teamPublicId={team.publicId}
                  members={team.members ?? []}
                  availableUsers={availableUsers}
                  availableDisciplines={availableDisciplines}
                />
              </CardContent>
            )}
          </Card>
        ))}

        {!isLoading && (teams as ReviewTeam[]).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No Review Teams yet. Create one to enable Parallel Review.</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTeam} onOpenChange={() => setEditTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Review Team</DialogTitle>
          </DialogHeader>
          {editTeam && (
            <ReviewTeamForm
              projectPublicId={selectedProjectId ?? ''}
              defaultValues={editTeam}
              onSubmit={(values) =>
                updateTeam.mutate(
                  { publicId: editTeam.publicId, data: values },
                  { onSuccess: () => setEditTeam(null) },
                )
              }
              isLoading={updateTeam.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
