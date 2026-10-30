'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  billingApi,
  requireAuthToken,
  type BillingInterval,
  type BillingPlanId,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export const billingSubscriptionQueryKey = ['billing', 'subscription'] as const;

type CheckoutRequest = {
  plan: BillingPlanId;
  interval?: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
};

export function useCreateCheckout() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async (request: BillingPlanId | CheckoutRequest) => {
      const token = await requireAuthToken(getToken);
      const input = typeof request === 'string' ? { plan: request } : request;
      const response = await billingApi.createCheckout(token, input);
      const checkoutUrl = response.data.url ?? response.data.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('Checkout URL missing from server response');
      }
      return checkoutUrl;
    },
  });
}

export function useBillingSubscription(enabled = true) {
  const getToken = useToken();
  return useQuery({
    queryKey: billingSubscriptionQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      const response = await billingApi.getSubscription(token);
      return response.data;
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useBillingPortal() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async () => {
      const token = await requireAuthToken(getToken);
      const response = await billingApi.createPortalSession(token);
      if (!response.data.url) {
        throw new Error('Billing portal URL missing from server response');
      }
      return response.data.url;
    },
  });
}
