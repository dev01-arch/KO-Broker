'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsApi,
  requireAuthToken,
  type ApiSuccessResponse,
  type CreateAdviserInput,
  type OrgIntegrations,
  type OrgMessagingSettings,
  type UpdateAdviserInput,
  type UpdateIntegrationsInput,
  type UpdateMessagingSettingsInput,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export const integrationsQueryKey = ['settings', 'integrations'] as const;
export const messagingQueryKey = ['settings', 'messaging'] as const;
export const advisersQueryKey = ['settings', 'advisers'] as const;

const DEFAULT_INTEGRATIONS: ApiSuccessResponse<OrgIntegrations> = {
  success: true,
  data: {
    equifax: { enabled: false },
    twilio: { enabled: false },
  },
};

const DEFAULT_MESSAGING: ApiSuccessResponse<OrgMessagingSettings> = {
  success: true,
  data: {
    inApp: { enabled: true },
    email: { enabled: true },
    sms: { enabled: true },
  },
};

export type IntegrationsDraft = {
  equifax: { enabled: boolean };
  twilio: { enabled: boolean };
};

export type MessagingDraft = {
  inApp: { enabled: boolean };
  email: { enabled: boolean };
  sms: { enabled: boolean };
};

export function useIntegrations() {
  const getToken = useToken();
  return useQuery({
    queryKey: integrationsQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return settingsApi.getIntegrations(token);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: DEFAULT_INTEGRATIONS,
  });
}

export function useUpdateIntegrations() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateIntegrationsInput) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.updateIntegrations(token, input);
    },
    onSuccess: (response) => {
      qc.setQueryData(integrationsQueryKey, response);
    },
  });
}

export function useMessagingSettings() {
  const getToken = useToken();
  return useQuery({
    queryKey: messagingQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return settingsApi.getMessaging(token);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: DEFAULT_MESSAGING,
  });
}

export function useUpdateMessagingSettings() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMessagingSettingsInput) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.updateMessaging(token, input);
    },
    onSuccess: (response) => {
      qc.setQueryData(messagingQueryKey, response);
    },
  });
}

export function useAdvisers(options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: advisersQueryKey,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return settingsApi.listAdvisers(token);
    },
  });
}

export function useCreateAdviser() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAdviserInput) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.createAdviser(token, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
    },
  });
}

export function useUpdateAdviser() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAdviserInput & { id: string }) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.updateAdviser(token, id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
    },
  });
}

export function useDeleteAdviser() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.deleteAdviser(token, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
    },
  });
}

export function useResendAdviserInvite() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.resendAdviserInvite(token, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
    },
  });
}

export function emptyIntegrationsDraft(data?: OrgIntegrations): IntegrationsDraft {
  return {
    equifax: { enabled: data?.equifax?.enabled ?? false },
    twilio: { enabled: data?.twilio?.enabled ?? false },
  };
}

export function emptyMessagingDraft(data?: OrgMessagingSettings): MessagingDraft {
  return {
    inApp: { enabled: data?.inApp?.enabled ?? true },
    email: { enabled: data?.email?.enabled ?? true },
    sms: { enabled: data?.sms?.enabled ?? true },
  };
}
