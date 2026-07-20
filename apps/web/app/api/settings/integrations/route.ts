import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';

const IntegrationSchema = z.object({
  onfido: z.object({
    apiKey: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
  experian: z.object({
    apiKey: z.string().optional(),
    clientId: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
  twentyci: z.object({
    apiKey: z.string().optional(),
    enabled: z.boolean().default(false),
  }).optional(),
});

type IntegrationSettings = z.infer<typeof IntegrationSchema>;

interface OrgSettings {
  integrations?: {
    onfido?: {
      apiKey?: string;
      enabled?: boolean;
    };
    experian?: {
      apiKey?: string;
      clientId?: string;
      enabled?: boolean;
    };
    twentyci?: {
      apiKey?: string;
      enabled?: boolean;
    };
  };
}

// Helper to mask a string to protect secrets
function maskSecret(val?: string): string | undefined {
  if (!val) return undefined;
  if (val.length <= 8) return '••••••••';
  return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
}

// Check if a value is masked
function isMasked(val?: string): boolean {
  if (!val) return false;
  return val.includes('••••');
}

/**
 * GET /api/settings/integrations
 * 
 * Fetches the organization's integrations settings, returning masked API keys/tokens.
 * Integrations per PRD-12: Onfido (ID/KYC), Experian (credit), TwentyCI (sourcing).
 */
export const GET = createHandler({
  method: 'GET',
  handler: async (req: NextRequest, { orgId }) => {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId! },
      select: { settings: true },
    });

    const settings = (org?.settings as unknown as OrgSettings) || {};
    const integrations = settings.integrations || {};

    const responseData: IntegrationSettings = {
      onfido: {
        apiKey: integrations.onfido?.apiKey ? maskSecret(integrations.onfido.apiKey) : undefined,
        enabled: !!integrations.onfido?.enabled,
      },
      experian: {
        apiKey: integrations.experian?.apiKey ? maskSecret(integrations.experian.apiKey) : undefined,
        clientId: integrations.experian?.clientId,
        enabled: !!integrations.experian?.enabled,
      },
      twentyci: {
        apiKey: integrations.twentyci?.apiKey ? maskSecret(integrations.twentyci.apiKey) : undefined,
        enabled: !!integrations.twentyci?.enabled,
      },
    };

    return NextResponse.json({ success: true, data: responseData }, { status: 200 });
  },
});

/**
 * PUT /api/settings/integrations
 * 
 * Updates the organization's integrations settings. Enforces admin role.
 * Preserves existing secrets if they are passed back masked.
 * Integrations per PRD-12: Onfido (ID/KYC), Experian (credit), TwentyCI (sourcing).
 */
export const PUT = createHandler({
  method: 'PUT',
  schema: IntegrationSchema,
  requiredRole: 'ADMIN',
  handler: async (req: NextRequest, { body, user, orgId }) => {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId! },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organisation not found' } },
        { status: 404 }
      );
    }

    const currentSettings = (org.settings as unknown as OrgSettings) || {};
    const currentIntegrations = currentSettings.integrations || {};

    // Build the updated integrations block, resolving masked fields
    const updatedIntegrations: OrgSettings['integrations'] = {};

    if (body.onfido) {
      let apiKey = body.onfido.apiKey;
      // If client passed back a masked placeholder, keep the original database secret
      if (isMasked(apiKey)) {
        apiKey = currentIntegrations.onfido?.apiKey;
      }
      updatedIntegrations.onfido = {
        apiKey,
        enabled: body.onfido.enabled,
      };
    }

    if (body.experian) {
      let apiKey = body.experian.apiKey;
      // Resolve masked apiKey
      if (isMasked(apiKey)) {
        apiKey = currentIntegrations.experian?.apiKey;
      }
      updatedIntegrations.experian = {
        apiKey,
        clientId: body.experian.clientId,
        enabled: body.experian.enabled,
      };
    }

    if (body.twentyci) {
      let apiKey = body.twentyci.apiKey;
      // Resolve masked apiKey
      if (isMasked(apiKey)) {
        apiKey = currentIntegrations.twentyci?.apiKey;
      }
      updatedIntegrations.twentyci = {
        apiKey,
        enabled: body.twentyci.enabled,
      };
    }

    const newSettings = {
      ...currentSettings,
      integrations: {
        ...currentIntegrations,
        ...updatedIntegrations,
      },
    };

    // Update database
    await prisma.organisation.update({
      where: { id: org.id },
      data: { settings: newSettings },
    });

    // Log audit trail event
    await logAuditEvent({
      orgId: org.id,
      userId: user?.id,
      entityType: 'Organisation',
      entityId: org.id,
      action: 'INTEGRATION_SETTINGS_UPDATED',
      diff: {
        before: {
          onfidoEnabled: !!currentIntegrations.onfido?.enabled,
          experianEnabled: !!currentIntegrations.experian?.enabled,
          twentyciEnabled: !!currentIntegrations.twentyci?.enabled,
        },
        after: {
          onfidoEnabled: !!updatedIntegrations.onfido?.enabled,
          experianEnabled: !!updatedIntegrations.experian?.enabled,
          twentyciEnabled: !!updatedIntegrations.twentyci?.enabled,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Integration settings updated successfully' }, { status: 200 });
  },
});
