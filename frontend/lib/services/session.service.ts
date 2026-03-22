import apiClient from '@/lib/api/client';

export interface Session {
  id: number;
  userId: number;
  user: {
    username: string;
    firstName: string;
    lastName: string;
  };
  deviceName: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

const extractArrayData = <T>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

const transformSession = (session: Session | (Omit<Session, 'id'> & { id: string | number })): Session => ({
  ...session,
  id: typeof session.id === 'number' ? session.id : Number(session.id),
});

export const sessionService = {
  getActiveSessions: async (): Promise<Session[]> => {
    const response = await apiClient.get<Session[] | { data: Session[] } | { data: { data: Session[] } }>(
      '/auth/sessions'
    );
    return extractArrayData<Session | (Omit<Session, 'id'> & { id: string | number })>(response.data).map(
      transformSession
    );
  },

  revokeSession: async (sessionId: number) => {
    const response = await apiClient.delete(`/auth/sessions/${sessionId}`);
    return response.data;
  },
};
