'use client';

// File: components/review-team/ReviewTeamSelector.tsx
// Selector component สำหรับเลือก Review Team ตอน Submit RFA (T023)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useReviewTeams } from '@/hooks/use-review-teams';
import { ReviewTeam } from '@/types/review-team';

interface ReviewTeamSelectorProps {
  projectPublicId: string;
  rfaTypeCode?: string;
  value?: string;
  onChange: (publicId: string | undefined) => void;
  disabled?: boolean;
}

export function ReviewTeamSelector({
  projectPublicId,
  rfaTypeCode,
  value,
  onChange,
  disabled,
}: ReviewTeamSelectorProps) {
  const { data: teams = [], isLoading } = useReviewTeams({
    projectPublicId,
    isActive: true,
  });

  // กรอง teams ที่ match กับ rfaTypeCode (ถ้ากำหนด)
  const filteredTeams = rfaTypeCode
    ? (teams as ReviewTeam[]).filter(
        (t) => !t.defaultForRfaTypes?.length || t.defaultForRfaTypes.includes(rfaTypeCode),
      )
    : (teams as ReviewTeam[]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" />
        <span>Review Team (Parallel Review)</span>
        <Badge variant="outline" className="text-xs">Optional</Badge>
      </div>

      <Select
        value={value ?? ''}
        onValueChange={(v: string) => onChange(v || undefined)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Loading teams...' : 'Skip — no parallel review'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Skip — no parallel review</SelectItem>
          {filteredTeams.map((team) => (
            <SelectItem key={team.publicId} value={team.publicId}>
              <div className="flex items-center gap-2">
                <span>{team.name}</span>
                {(team.members ?? []).length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({team.members?.length} members)
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value && (
        <p className="text-xs text-muted-foreground">
          Parallel review tasks will be created for each discipline in the selected team.
        </p>
      )}
    </div>
  );
}
