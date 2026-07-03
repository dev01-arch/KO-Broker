import { NextRequest } from 'next/server';
import { DocumentTypeSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { createDocumentForOrg, listDocumentsForOrg } from '@/lib/api/documents-data';
import { uploadToR2 } from '@/lib/storage/r2';
import { logAuditEvent } from '@/lib/compliance/audit';
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

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
    const caseId = searchParams.get('caseId')?.trim();
    const clientId = searchParams.get('clientId')?.trim();
    const documentType = searchParams.get('documentType')?.trim();

    const { total, documents } = await listDocumentsForOrg(orgId, {
      page,
      perPage,
      caseId,
      clientId,
      documentType: documentType as import('@ko/types').DocumentType | undefined,
    });

    return apiSuccess(documents, { meta: { total, page, perPage } });
  } catch (error) {
    console.error('[GET /api/documents]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return apiError('VALIDATION_ERROR', 'Failed to parse form data', 422);
      }

      const file = formData.get('file') as File | null;
      const name = (formData.get('name') as string | null)?.trim() ?? file?.name ?? null;
      const rawType = formData.get('documentType') as string | null;
      const caseId = (formData.get('caseId') as string | null) || undefined;
      const clientId = (formData.get('clientId') as string | null) || undefined;

      if (!name) return apiError('VALIDATION_ERROR', 'name is required', 422);
      if (!caseId && !clientId)
        return apiError('VALIDATION_ERROR', 'caseId or clientId is required', 422);

      const docTypeParsed = DocumentTypeSchema.safeParse(rawType ?? 'OTHER');
      if (!docTypeParsed.success) {
        return apiError('VALIDATION_ERROR', 'Invalid documentType', 422);
      }

      if (!file || typeof file.arrayBuffer !== 'function') {
        return apiError('VALIDATION_ERROR', 'A file must be attached to the upload', 422);
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return apiError(
          'VALIDATION_ERROR',
          `File type '${file.type}' is not allowed. Accepted: PDF, Word, Excel, images, plain text.`,
          422,
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return apiError('VALIDATION_ERROR', 'File exceeds the maximum allowed size of 50 MB.', 422);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const scope = caseId ? `cases/${caseId}` : `clients/${clientId}`;
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `documents/${orgId}/${scope}/${Date.now()}_${safeName}`;
      const storageUrl = await uploadToR2(buffer, r2Key, file.type);

      const result = await createDocumentForOrg(orgId, {
        name,
        documentType: docTypeParsed.data,
        caseId,
        clientId,
        storageUrl,
        mimeType: file.type || undefined,
        sizeBytes: file.size || undefined,
        uploadedBy: user.id,
      });

      await logAuditEvent({
        orgId,
        userId: user.id,
        entityType: 'Document',
        entityId: caseId ?? clientId ?? result.document.id,
        action: 'DOCUMENT_UPLOADED',
        diff: {
          after: {
            documentId: result.document.id,
            name,
            documentType: docTypeParsed.data,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        },
      });

      return apiSuccess(result.document, { status: 201 });
    }

    let body: {
      name?: unknown;
      documentType?: unknown;
      caseId?: unknown;
      clientId?: unknown;
      storageUrl?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    if (!body.storageUrl || typeof body.storageUrl !== 'string')
      return apiError('VALIDATION_ERROR', 'storageUrl is required for JSON uploads', 422);
    if (!body.name || typeof body.name !== 'string')
      return apiError('VALIDATION_ERROR', 'name is required', 422);

    const docTypeParsed = DocumentTypeSchema.safeParse(body.documentType ?? 'OTHER');
    const result = await createDocumentForOrg(orgId, {
      name: body.name,
      documentType: docTypeParsed.success ? docTypeParsed.data : 'OTHER',
      caseId: typeof body.caseId === 'string' ? body.caseId : undefined,
      clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
      storageUrl: body.storageUrl,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
      sizeBytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : undefined,
      uploadedBy: user.id,
    });

    return apiSuccess(result.document, { status: 201 });
  } catch (error) {
    console.error('[POST /api/documents]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
