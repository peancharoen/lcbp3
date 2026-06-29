import apiClient from '@/lib/api/client';

export interface UploadedAttachment {
  id: number;
  uuid: string;
  tempId: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  isTemporary: boolean;
}

export const filesApi = {
  upload: async (file: File): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadMany: async (files: File[]): Promise<UploadedAttachment[]> => {
    return Promise.all(files.map((f) => filesApi.upload(f)));
  },
};
