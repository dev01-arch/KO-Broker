'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  documentsApi,
  requireAuthToken,
  type DocumentType,
  type ListDocumentsParams,
} from '@/lib/api/client';

export interface UploadFileInput {
  file: File;
  documentType?: DocumentType;
  caseId?: string;
  clientId?: string;
}

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function documentsQueryKey(params: ListDocumentsParams = {}) {
  return [
    'documents',
    params.page ?? 1,
    params.perPage ?? 25,
    params.caseId ?? '',
    params.clientId ?? '',
  ] as const;
}

export function useDocuments(params: ListDocumentsParams = {}, options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: documentsQueryKey(params),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return documentsApi.list(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useUploadDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadFileInput) => {
      const token = await requireAuthToken(getToken);
      return documentsApi.upload(token, {
        file: input.file,
        documentType: input.documentType,
        caseId: input.caseId,
        clientId: input.clientId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return documentsApi.delete(token, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
