import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/lib/services/user.service';
import { CreateUserDto, UpdateUserDto, SearchUserDto, Role } from '@/types/user';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

export const userKeys = {
  all: ['users'] as const,
  list: (params?: SearchUserDto) => [...userKeys.all, 'list', params] as const,
  detail: (uuid: string) => [...userKeys.all, 'detail', uuid] as const,
};

export function useUsers(params?: SearchUserDto) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => userService.getAll(params),
  });
}

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => userService.getRoles(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserDto) => userService.create(data),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create user', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateUserDto }) => userService.update(uuid, data),
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update user', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => userService.delete(uuid),
    onSuccess: () => {
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete user', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}
