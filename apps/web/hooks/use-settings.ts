'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  settingsApi,
  requireAuthToken,
  type AdviserRecord,
  type CreateAdviserInput,
  type OrgIntegrations,
  type OrgMessagingSettings,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagingQueryKey });
    },
  });
}

export function useAdvisers() {
  const getToken = useToken();
  return useQuery({
    queryKey: advisersQueryKey,
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
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: advisersQueryKey });
      return created as AdviserRecord;
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
