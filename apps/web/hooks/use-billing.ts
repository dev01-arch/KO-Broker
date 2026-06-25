'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { billingApi, requireAuthToken } from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function useCreateCheckout() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async (plan: 'PROFESSIONAL' | 'ENTERPRISE') => {
      const token = await requireAuthToken(getToken);
      const response = await billingApi.createCheckout(token, { plan });
      const checkoutUrl = response.data.url ?? response.data.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('Checkout URL missing from server response');
      }
      return checkoutUrl;
    },
  });
}
