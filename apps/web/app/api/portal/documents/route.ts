import { NextRequest } from 'next/server';
import { DocumentTypeSchema } from '@ko/types';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { prisma } from '@/lib/db';
import { uploadToR2 } from '@/lib/storage/r2';
import { logAuditEvent } from '@/lib/compliance/audit';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const { session } = authResult;

    const caseRecord = await prisma.case.findFirst({
      where: {
        id: session.caseId,
        orgId: session.orgId,
        clientId: session.clientId,
      },
      select: { id: true },
    });

    if (!caseRecord) {
      return applyCorsHeaders(req, apiError('NOT_FOUND', 'No active case found', 404));
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return applyCorsHeaders(
        req,
        apiError('VALIDATION_ERROR', 'Request must be multipart/form-data', 422),
      );
    }

    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string | null)?.trim();
    const documentType = formData.get('documentType') as string | null;

    if (!name) {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Document name is required', 422));
    }

    const parsedType = DocumentTypeSchema.safeParse(documentType ?? 'OTHER');
    if (!parsedType.success) {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid documentType', 422));
    }

    if (!file || typeof file.arrayBuffer !== 'function') {
      return applyCorsHeaders(
        req,
        apiError('VALIDATION_ERROR', 'A file must be attached to the upload', 422),
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return applyCorsHeaders(
        req,
        apiError('VALIDATION_ERROR', `File type '${file.type}' is not allowed.`, 422),
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return applyCorsHeaders(
        req,
        apiError('VALIDATION_ERROR', 'File exceeds the maximum allowed size of 50 MB.', 422),
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `documents/${session.orgId}/portal-cases/${caseRecord.id}/${Date.now()}_${safeName}`;
    const storageUrl = await uploadToR2(buffer, r2Key, file.type);

    const document = await prisma.document.create({
      data: {
        orgId: session.orgId,
        caseId: caseRecord.id,
        clientId: session.clientId,
        name,
        documentType: parsedType.data,
        storageUrl,
        mimeType: file.type || null,
        sizeBytes: file.size || null,
        uploadedBy: null,
      },
    });

    await logAuditEvent({
      orgId: session.orgId,
      entityType: 'Document',
      entityId: caseRecord.id,
      action: 'DOCUMENT_UPLOADED',
      diff: {
        after: {
          documentId: document.id,
          name,
          documentType: parsedType.data,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      },
    });

    return applyCorsHeaders(req, apiSuccess(document, { status: 201 }));
  } catch (error) {
    console.error('[POST /api/portal/documents]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
