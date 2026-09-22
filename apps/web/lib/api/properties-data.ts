/**
 * Property data layer — PRD-16 W3
 *
 * Properties are org-scoped and owned by a Client.
 * A Property is reused across multiple cases on the same home.
 * No global property list — exposed only via client detail and case header.
 */

import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import type { CreatePropertyInput } from '@ko/types';

export function serializeProperty(property: {
  id: string;
  orgId: string;
  clientId: string;
  address: unknown;
  postcode: string;
  tenure: string | null;
  type: string;
  currentValue: number | null;
  monthlyRent: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: property.id,
    clientId: property.clientId,
    address: property.address ?? undefined,
    postcode: property.postcode,
    tenure: property.tenure ?? undefined,
    type: property.type,
    currentValue: property.currentValue ?? undefined,
    monthlyRent: property.monthlyRent ?? undefined,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

export async function listPropertiesForClient(orgId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });
  if (!client) return { error: 'NOT_FOUND' as const };

  const properties = await prisma.property.findMany({
    where: { clientId, orgId },
    orderBy: { createdAt: 'desc' },
  });

  return { properties };
}

export async function createPropertyForClient(
  orgId: string,
  clientId: string,
  input: CreatePropertyInput,
  userId?: string,
) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });
  if (!client) return { error: 'NOT_FOUND' as const };

  const property = await prisma.property.create({
    data: {
      orgId,
      clientId,
      postcode: input.postcode,
      address: (input.address as object) ?? undefined,
      tenure: input.tenure ?? null,
      type: input.type ?? 'RESIDENTIAL',
      currentValue: input.currentValue ?? null,
      monthlyRent: input.monthlyRent ?? null,
    },
  });

  await logAuditEvent({
    orgId,
    userId,
    entityType: 'Client',
    entityId: clientId,
    action: 'PROPERTY_CREATED',
    diff: {
      after: {
        propertyId: property.id,
        postcode: property.postcode,
        type: property.type,
        currentValue: property.currentValue,
      },
    },
  });

  return { property };
}

export async function getPropertyById(orgId: string, propertyId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, orgId },
  });
}
