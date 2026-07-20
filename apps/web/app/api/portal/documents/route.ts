import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { requirePortalAuth } from '@/lib/auth/portalAuth';
import { uploadToR2 } from '@/lib/storage/r2';
import { DocumentTypeSchema } from '@ko/types';
import { logAuditEvent } from '@/lib/compliance/audit';

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

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  handler: async (req: NextRequest) => {
    const client = await requirePortalAuth();
    const activeCase = client.cases[0];

    if (!activeCase) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request must be multipart/form-data' } },
        { status: 422 }
      );
    }

    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string | null)?.trim();
    const documentType = formData.get('documentType') as string | null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document name is required' } },
        { status: 422 }
      );
    }

    const parsedType = DocumentTypeSchema.safeParse(documentType ?? 'OTHER');
    if (!parsedType.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid documentType' } },
        { status: 422 }
      );
    }

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A file must be attached to the upload' } },
        { status: 422 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `File type '${file.type}' is not allowed.` } },
        { status: 422 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File exceeds the maximum allowed size of 50 MB.' } },
        { status: 422 }
      );
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build namespaced key: documents/{orgId}/portal-upload/{timestamp}_{sanitisedName}
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `documents/${client.orgId}/portal-cases/${activeCase.id}/${Date.now()}_${safeName}`;
    const storageUrl = await uploadToR2(buffer, r2Key, file.type);

    // Create Document database record
    const document = await prisma.document.create({
      data: {
        orgId: client.orgId,
        caseId: activeCase.id,
        clientId: client.id,
        name,
        documentType: parsedType.data,
        storageUrl,
        mimeType: file.type || null,
        sizeBytes: file.size || null,
        uploadedBy: null, // Uploaded by Client
      },
    });

    // Log audit event for compliance
    await logAuditEvent({
      orgId: client.orgId,
      entityType: 'Document',
      entityId: activeCase.id,
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

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  },
});
