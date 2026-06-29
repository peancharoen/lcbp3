// File: hooks/use-reminder.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { getApiErrorMessage } from '@/types/api-error';
import { ReminderType } from '@/types/workflow';

export interface ReminderRule {
  publicId: string;
  projectId?: number;
  name: string;
  documentTypeCode?: string;
  reminderType: ReminderType;
  daysBeforeDue: number;
  escalationLevel: number;
  notifyRoles?: string[];
  messageTemplate?: string;
  isActive: boolean;
}

export interface ReminderHistory {
  publicId: string;
  taskId: number;
  userId: number;
  reminderType: ReminderType;
  escalationLevel: number;
  sentAt: string;
  user?: {
    fullName: string;
    email: string;
  };
}

export interface CreateReminderRuleDto {
  projectId?: number;
  name: string;
  documentTypeCode?: string;
  reminderType: ReminderType;
  daysBeforeDue: number;
  escalationLevel?: number;
  notifyRoles?: string[];
  messageTemplate?: string;
}

export const reminderKeys = {
  all: ['reminder-rules'] as const,
  byProject: (projectId?: string) => [...reminderKeys.all, { projectId }] as const,
  history: (taskPublicId: string) => ['reminder-history', taskPublicId] as const,
};

export function useReminderRules(projectPublicId?: string) {
  return useQuery({
    queryKey: reminderKeys.byProject(projectPublicId),
    queryFn: async (): Promise<ReminderRule[]> => {
      const res = await apiClient.get('/admin/reminder-rules', {
        params: { projectPublicId },
      });
      return res.data;
    },
  });
}

export function useReminderHistory(taskPublicId: string) {
  return useQuery({
    queryKey: reminderKeys.history(taskPublicId),
    queryFn: async (): Promise<ReminderHistory[]> => {
      const res = await apiClient.get(`/admin/reminder-rules/history/${taskPublicId}`);
      return res.data;
    },
    enabled: !!taskPublicId,
  });
}

export function useCreateReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReminderRuleDto) =>
      apiClient.post('/admin/reminder-rules', data),
    onSuccess: () => {
      toast.success('Reminder rule created successfully');
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create reminder rule', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useUpdateReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      publicId,
      data,
    }: {
      publicId: string;
      data: Partial<CreateReminderRuleDto>;
    }) => apiClient.patch(`/admin/reminder-rules/${publicId}`, data),
    onSuccess: () => {
      toast.success('Reminder rule updated');
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update reminder rule', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useDeleteReminderRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (publicId: string) =>
      apiClient.delete(`/admin/reminder-rules/${publicId}`),
    onSuccess: () => {
      toast.success('Reminder rule deleted');
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete reminder rule', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}
