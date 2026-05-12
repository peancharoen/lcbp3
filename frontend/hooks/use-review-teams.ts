// File: hooks/use-review-teams.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';
import {
  reviewTeamService,
  CreateReviewTeamDto,
  UpdateReviewTeamDto,
  AddTeamMemberDto,
  SearchReviewTeamDto,
} from '@/lib/services/review-team.service';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const reviewTeamKeys = {
  all: ['reviewTeams'] as const,
  lists: () => [...reviewTeamKeys.all, 'list'] as const,
  list: (params: SearchReviewTeamDto) => [...reviewTeamKeys.lists(), params] as const,
  details: () => [...reviewTeamKeys.all, 'detail'] as const,
  detail: (publicId: string) => [...reviewTeamKeys.details(), publicId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useReviewTeams(params?: SearchReviewTeamDto) {
  return useQuery({
    queryKey: reviewTeamKeys.list(params ?? {}),
    queryFn: () => reviewTeamService.getAll(params),
    placeholderData: (prev: unknown) => prev,
  });
}

export function useReviewTeam(publicId: string) {
  return useQuery({
    queryKey: reviewTeamKeys.detail(publicId),
    queryFn: () => reviewTeamService.getByPublicId(publicId),
    enabled: !!publicId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateReviewTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewTeamDto) => reviewTeamService.create(data),
    onSuccess: () => {
      toast.success('Review Team created successfully');
      queryClient.invalidateQueries({ queryKey: reviewTeamKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create Review Team', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useUpdateReviewTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ publicId, data }: { publicId: string; data: UpdateReviewTeamDto }) =>
      reviewTeamService.update(publicId, data),
    onSuccess: (_: unknown, { publicId }: { publicId: string; data: UpdateReviewTeamDto }) => {
      toast.success('Review Team updated');
      queryClient.invalidateQueries({ queryKey: reviewTeamKeys.detail(publicId) });
      queryClient.invalidateQueries({ queryKey: reviewTeamKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update Review Team', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamPublicId, data }: { teamPublicId: string; data: AddTeamMemberDto }) =>
      reviewTeamService.addMember(teamPublicId, data),
    onSuccess: (_: unknown, { teamPublicId }: { teamPublicId: string; data: AddTeamMemberDto }) => {
      toast.success('Member added to team');
      queryClient.invalidateQueries({ queryKey: reviewTeamKeys.detail(teamPublicId) });
    },
    onError: (error: unknown) => {
      toast.error('Failed to add member', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamPublicId,
      memberPublicId,
    }: {
      teamPublicId: string;
      memberPublicId: string;
    }) => reviewTeamService.removeMember(teamPublicId, memberPublicId),
    onSuccess: (_: unknown, { teamPublicId }: { teamPublicId: string; memberPublicId: string }) => {
      toast.success('Member removed from team');
      queryClient.invalidateQueries({ queryKey: reviewTeamKeys.detail(teamPublicId) });
    },
    onError: (error: unknown) => {
      toast.error('Failed to remove member', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}
