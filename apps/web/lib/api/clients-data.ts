import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError, isPrismaUniqueConflict } from '@/lib/api/prisma-errors';
import { sendClientWelcomeEmail, type EmailDeliveryStatus } from '@/lib/notifications/client-emails';
import { generateReference } from '@ko/utils';
import type { ClientType, EmploymentStatus } from '@ko/types';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

export async function findUserByClerkId(clerkId: string) {
  try {
    return await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        orgId: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.findUserByClerkId(clerkId);
  }
}

export async function createUserWithOrg(input: {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  orgName: string;
  slug: string;
}) {
  try {
    const org = await prisma.organisation.create({
      data: {
        name: input.orgName,
        slug: input.slug,
        plan: 'STARTER',
      },
    });
    return await prisma.user.create({
      data: {
        clerkId: input.clerkId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        orgId: org.id,
        role: 'ADMIN',
      },
      select: {
        id: true,
        orgId: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.ensureUser(input);
  }
}

/** Clerk user exists in DB but has no org — create one and link (first cross-origin login). */
export async function linkExistingUserToNewOrg(
  userId: string,
  input: { orgName: string; slug: string },
) {
  try {
    const org = await prisma.organisation.create({
      data: {
        name: input.orgName,
        slug: input.slug,
        plan: 'STARTER',
      },
    });
    return await prisma.user.update({
      where: { id: userId },
      data: { orgId: org.id, role: 'ADMIN' },
      select: {
        id: true,
        orgId: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  } catch (error) {
    if (!useDevStore(error)) throw error;
    throw error;
  }
}

export async function listClientsForOrg(
  orgId: string,
  params: {
    page: number;
    perPage: number;
    search?: string;
    employmentStatus?: EmploymentStatus;
  },
) {
  try {
    const where = {
      orgId,
      ...(params.employmentStatus ? { employmentStatus: params.employmentStatus } : {}),
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: 'insensitive' as const } },
              { lastName: { contains: params.search, mode: 'insensitive' as const } },
              { companyName: { contains: params.search, mode: 'insensitive' as const } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { referenceNumber: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        select: {
          id: true,
          referenceNumber: true,
          clientType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          employmentStatus: true,
          annualIncome: true,
          isVulnerable: true,
          _count: { select: { cases: true, messages: true } },
        },
      }),
    ]);

    return { total, clients };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    const result = devStore.listClients(orgId, params);
    return { total: result.total, clients: result.clients };
  }
}

export async function createClientForOrg(
  orgId: string,
  input: {
    clientType?: ClientType;
    title?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    companyNumber?: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    employmentStatus?: EmploymentStatus;
    annualIncome?: number;
  },
) {
  const clientType = input.clientType ?? 'INDIVIDUAL';
  const isCompany = clientType === 'COMPANY';
  const companyName = input.companyName?.trim();
  const firstName = isCompany ? companyName! : input.firstName!.trim();
  const lastName = isCompany ? '—' : input.lastName!.trim();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const year = new Date().getFullYear();
      const count = await prisma.client.count({
        where: {
          orgId,
          createdAt: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
          },
        },
      });
      const referenceNumber = generateReference('KOC', count + 1);

      const created = await prisma.client.create({
        data: {
          orgId,
          referenceNumber,
          clientType,
          companyName: isCompany ? companyName : undefined,
          companyNumber: isCompany ? input.companyNumber?.trim() || undefined : undefined,
          title: isCompany ? undefined : input.title,
          firstName,
          lastName,
          email: input.email,
          phone: input.phone,
          dateOfBirth: !isCompany && input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          employmentStatus: input.employmentStatus ?? 'EMPLOYED',
          annualIncome: input.annualIncome,
        },
        select: {
          id: true,
          referenceNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      const welcomeEmail = await sendClientWelcomeEmail(created);
      return { client: created, welcomeEmail };
    } catch (error) {
      if (isPrismaUniqueConflict(error, 'referenceNumber') && attempt < 2) continue;
      if (!useDevStore(error)) throw error;
      const client = devStore.createClient(orgId, input);
      const welcomeEmail: EmailDeliveryStatus = { sent: false, error: 'Email skipped in offline dev mode' };
      return {
        client: {
          id: client.id,
          referenceNumber: client.referenceNumber,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
        },
        welcomeEmail,
      };
    }
  }

  throw new Error('Failed to generate a unique client reference number');
}

export async function getClientForOrg(orgId: string, id: string) {
  try {
    return await prisma.client.findFirst({
      where: { id, orgId },
      include: {
        cases: {
          select: {
            id: true,
            referenceNumber: true,
            type: true,
            stage: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { messages: true, documents: true } },
      },
    });
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.getClient(orgId, id);
  }
}

export async function updateClientForOrg(
  orgId: string,
  id: string,
  input: Record<string, unknown>,
) {
  try {
    const existing = await prisma.client.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) return null;

    return await prisma.client.update({
      where: { id },
      data: input,
      select: {
        id: true,
        firstName: true,
        isVulnerable: true,
      },
    });
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.updateClient(orgId, id, input);
  }
}
