'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService } from '@/lib/services/session.service';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Trash2, Monitor, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

export default function SessionManagementPage() {
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionService.getActiveSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: sessionService.revokeSession,
    onSuccess: () => {
      toast.success('Session revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      toast.error('Failed to revoke session');
      console.error(error);
    },
  });

  const handleRevoke = (id: number) => {
    if (confirm('Are you sure you want to revoke this session?')) {
      revokeMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Failed to load sessions. Please try again.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Active Sessions</h1>
        <p className="text-sm text-muted-foreground">Monitor and manage active user sessions across all devices.</p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Device Info</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions?.map((session: any) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{session.user.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {session.user.firstName} {session.user.lastName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Monitor className="h-3 w-3" />
                      {session.deviceName || 'Unknown Device'}
                    </div>
                    <span className="text-xs text-muted-foreground">{session.ipAddress || 'Unknown IP'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {session.lastActive ? format(new Date(session.lastActive), 'PP pp') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => handleRevoke(Number(session.id))}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!sessions || sessions.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No active sessions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
