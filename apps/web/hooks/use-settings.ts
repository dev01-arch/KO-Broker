'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsApi,
  requireAuthToken,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationsQueryKey });
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
      qc.invalidateQueries({ queryKey: messagingQueryKey });
    },
  });
}

export function useAdvisers(options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: advisersQueryKey,
    enabled: options?.enabled ?? true,
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

export function useAdviser(id: string, options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: [...advisersQueryKey, id],
    enabled: (options?.enabled ?? true) && Boolean(id),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return settingsApi.getAdviser(token, id);
    },
  });
}

export function useUpdateAdviser(id: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAdviserInput) => {
      const token = await requireAuthToken(getToken);
      return settingsApi.updateAdviser(token, id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
      qc.invalidateQueries({ queryKey: [...advisersQueryKey, id] });
    },
  });
}

export function useResendAdviserInvite(id: string) {
  const getToken = useToken();
  return useMutation({
    mutationFn: async () => {
      const token = await requireAuthToken(getToken);
      return settingsApi.resendAdviserInvite(token, id);
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
