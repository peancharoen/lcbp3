import apiClient from '@/lib/api/client';

export interface Session {
  id: string; // tokenId
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

export const sessionService = {
  getActiveSessions: async () => {
    const response = await apiClient.get<any>('/auth/sessions');
    return response.data.data || response.data;
  },

  revokeSession: async (sessionId: number) => {
    const response = await apiClient.delete(`/auth/sessions/${sessionId}`);
    return response.data;
  },
};
