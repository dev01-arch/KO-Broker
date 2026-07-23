import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError, isPrismaUniqueConflict } from '@/lib/api/prisma-errors';
import { sendAdviserClientAssignedEmail, sendClientWelcomeEmail, type EmailDeliveryStatus } from '@/lib/notifications/client-emails';
import { generateReference } from '@ko/utils';
import type { ClientType, ClientStatus, ClientCategoryFilter, EmploymentStatus } from '@ko/types';
import { clientAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

async function nextClientReferenceSequence(orgId: string): Promise<number> {
  const year = new Date().getFullYear();
  const prefix = `KOC-${year}-`;

  const latest = await prisma.client.findFirst({
    where: {
      orgId,
      referenceNumber: { startsWith: prefix },
    },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });

  if (!latest?.referenceNumber) return 1;

  const parsed = Number.parseInt(latest.referenceNumber.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
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
    if (!shouldUseDevStore(error)) throw error;
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
    if (!shouldUseDevStore(error)) throw error;
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
    if (!shouldUseDevStore(error)) throw error;
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
    clientType?: ClientType;
    isReferred?: boolean;
    clientCategory?: ClientCategoryFilter;
    status?: ClientStatus;
    assignedMemberId?: string;
    /** When set, only clients assigned to this User (via cases or OrganisationMember). */
    restrictToAdviserUserId?: string;
  },
) {
  try {
    const categoryWhere =
      params.clientCategory === 'REFERRAL'
        ? { isReferred: true }
        : params.clientCategory === 'INDIVIDUAL'
          ? { clientType: 'INDIVIDUAL' as const, isReferred: false }
          : params.clientCategory === 'COMPANY'
            ? { clientType: 'COMPANY' as const }
            : {};

    const searchOr = params.search
      ? [
          { firstName: { contains: params.search, mode: 'insensitive' as const } },
          { lastName: { contains: params.search, mode: 'insensitive' as const } },
          { companyName: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { referenceNumber: { contains: params.search, mode: 'insensitive' as const } },
          { referredToCompany: { contains: params.search, mode: 'insensitive' as const } },
        ]
      : null;

    const assignedOr = params.restrictToAdviserUserId
      ? clientAssignedToAdviserWhere(params.restrictToAdviserUserId).OR
      : null;

    const andFilters = [
      ...(assignedOr ? [{ OR: assignedOr }] : []),
      ...(!assignedOr && params.assignedMemberId
        ? [{ assignedMemberId: params.assignedMemberId }]
        : []),
      ...(searchOr ? [{ OR: searchOr }] : []),
    ];

    const where = {
      orgId,
      ...categoryWhere,
      ...(params.employmentStatus ? { employmentStatus: params.employmentStatus } : {}),
      ...(params.clientType && !params.clientCategory
        ? { clientType: params.clientType }
        : {}),
      ...(params.isReferred !== undefined && !params.clientCategory
        ? { isReferred: params.isReferred }
        : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
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
          isReferred: true,
          referredToCompany: true,
          status: true,
          insurerName: true,
          isVulnerable: true,
          assignedMember: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { cases: true, messages: true } },
        },
      }),
    ]);

    return { total, clients };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
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
    isReferred?: boolean;
    referredToCompany?: string;
    assignedMemberId?: string;
    insurerName?: string;
  },
) {
  const clientType = input.clientType ?? 'INDIVIDUAL';
  const isCompany = clientType === 'COMPANY';
  const companyName = input.companyName?.trim();
  const firstName = isCompany ? companyName! : input.firstName!.trim();
  const lastName = isCompany ? '—' : input.lastName!.trim();
  const isReferred = !isCompany && input.isReferred === true;
  const referredToCompany = isReferred ? input.referredToCompany?.trim() : undefined;
  const insurerName =
    !isCompany && !isReferred && input.insurerName?.trim()
      ? input.insurerName.trim()
      : undefined;

  let assignedMember: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null = null;

  if (input.assignedMemberId) {
    try {
      const member = await prisma.organisationMember.findFirst({
        where: { id: input.assignedMemberId, orgId, isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (!member) {
        return {
          error: 'VALIDATION' as const,
          fields: { assignedMemberId: 'Selected adviser not found' },
        };
      }
      assignedMember = member;
    } catch (error) {
      if (!shouldUseDevStore(error)) throw error;
      const member = devStore.getMember(orgId, input.assignedMemberId);
      if (!member?.isActive) {
        return {
          error: 'VALIDATION' as const,
          fields: { assignedMemberId: 'Selected adviser not found' },
        };
      }
      assignedMember = {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
      };
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const sequence = await nextClientReferenceSequence(orgId);
      const referenceNumber = generateReference('KOC', sequence);

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
          isReferred,
          referredToCompany,
          assignedMemberId: input.assignedMemberId,
          insurerName,
        },
        select: {
          id: true,
          referenceNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
          clientType: true,
        },
      });

      const welcomeEmail = await sendClientWelcomeEmail(created);
      let adviserEmail: EmailDeliveryStatus | undefined;
      if (assignedMember) {
        adviserEmail = await sendAdviserClientAssignedEmail({
          adviser: assignedMember,
          client: created,
        });
      }
      return { client: created, welcomeEmail, adviserEmail };
    } catch (error) {
      if (isPrismaUniqueConflict(error, 'referenceNumber') && attempt < 4) continue;
      if (!shouldUseDevStore(error)) throw error;
      const client = devStore.createClient(orgId, input);
      const welcomeEmail: EmailDeliveryStatus = { sent: false, error: 'Email skipped in offline dev mode' };
      const adviserEmail: EmailDeliveryStatus | undefined = assignedMember
        ? { sent: false, error: 'Email skipped in offline dev mode' }
        : undefined;
      return {
        client: {
          id: client.id,
          referenceNumber: client.referenceNumber,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          companyName: client.companyName,
          clientType: client.clientType,
        },
        welcomeEmail,
        adviserEmail,
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
    if (!shouldUseDevStore(error)) throw error;
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
    if (!shouldUseDevStore(error)) throw error;
    return devStore.updateClient(orgId, id, input);
  }
}

export async function deleteClientForOrg(orgId: string, id: string) {
  try {
    const existing = await prisma.client.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) return { error: 'NOT_FOUND' as const };

    const caseIds = (
      await prisma.case.findMany({
        where: { orgId, clientId: id },
        select: { id: true },
      })
    ).map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      if (caseIds.length > 0) {
        await tx.factFind.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.productConsidered.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.complianceRecord.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.suitabilityReport.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.message.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.document.deleteMany({ where: { caseId: { in: caseIds } } });
        await tx.case.deleteMany({ where: { id: { in: caseIds } } });
      }

      await tx.message.deleteMany({ where: { orgId, clientId: id } });
      await tx.document.deleteMany({ where: { orgId, clientId: id } });
      await tx.client.delete({ where: { id } });
    });

    return { deleted: true as const };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.deleteClient(orgId, id);
  }
}
