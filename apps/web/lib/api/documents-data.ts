import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import type { DocumentType } from '@ko/types';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

export async function listDocumentsForOrg(
  orgId: string,
  params: { page: number; perPage: number; caseId?: string; clientId?: string; documentType?: DocumentType },
) {
  try {
    const where = {
      orgId,
      ...(params.caseId ? { caseId: params.caseId } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.documentType ? { documentType: params.documentType } : {}),
    };
    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      }),
    ]);
    return { total, documents };
  } catch (error) {
    if (shouldUseDevStore(error)) return devStore.listDocuments(orgId, params);
    throw error;
  }
}

export async function createDocumentForOrg(
  orgId: string,
  input: {
    name: string;
    documentType: DocumentType;
    caseId?: string;
    clientId?: string;
    storageUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedBy?: string;
  },
) {
  try {
    const doc = await prisma.document.create({
      data: { orgId, ...input },
    });
    return { document: doc };
  } catch (error) {
    if (shouldUseDevStore(error)) return { document: devStore.createDocument(orgId, input) };
    throw error;
  }
}

export async function getDocumentForOrg(orgId: string, id: string) {
  try {
    return await prisma.document.findFirst({ where: { id, orgId } });
  } catch (error) {
    if (shouldUseDevStore(error)) return devStore.getDocument(orgId, id);
    throw error;
  }
}

export async function deleteDocumentForOrg(orgId: string, id: string) {
  try {
    const existing = await prisma.document.findFirst({ where: { id, orgId } });
    if (!existing) return false;
    await prisma.document.delete({ where: { id } });
    return true;
  } catch (error) {
    if (shouldUseDevStore(error)) return devStore.deleteDocument(orgId, id);
    throw error;
  }
}
