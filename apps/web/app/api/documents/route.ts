/**
 * GET  /api/documents  — list documents for the org (filterable by caseId / clientId)
 * POST /api/documents  — upload a document file to R2 and create a Document record
 *
 * Upload flow:
 *   1. Frontend sends multipart/form-data with:
 *        file       (File / Blob)
 *        name       (string — display name, e.g. "ESIS_Document.pdf")
 *        documentType (DocumentType enum)
 *        caseId?    (string)
 *        clientId?  (string)
 *   2. Route streams the file into a Buffer, uploads to Cloudflare R2 via uploadToR2()
 *   3. Creates a Document record in the DB with the returned storageUrl
 *   4. Logs an audit event
 *   5. Returns the created Document record
 *
 * The compliance checklist for INITIAL_DISCLOSURE checks for any COMPLIANCE document
 * on the case. The ESIS checklist checks for a COMPLIANCE document whose name contains
 * "ESIS". Uploading via this endpoint with the correct documentType and name satisfies
 * both gates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { uploadToR2 } from '@/lib/storage/r2';
import { DocumentTypeSchema } from '@ko/types';

// ── Allowed MIME types ────────────────────────────────────────────────────────

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

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (Supabase free tier limit)

// ── GET /api/documents ────────────────────────────────────────────────────────

export const GET = createHandler({
    method: 'GET',
    handler: async (req: NextRequest, { orgId }) => {
        const { searchParams } = new URL(req.url);
        const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '25', 10)));
        const caseId   = searchParams.get('caseId')   ?? undefined;
        const clientId = searchParams.get('clientId') ?? undefined;
        const documentType = searchParams.get('documentType') ?? undefined;

        const where = {
            orgId,
            ...(caseId        ? { caseId }        : {}),
            ...(clientId      ? { clientId }      : {}),
            ...(documentType  ? { documentType: documentType as never } : {}),
        };

        const [documents, total] = await Promise.all([
            prisma.document.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { createdAt: 'desc' },
                include: {
                    case:   { select: { id: true, referenceNumber: true } },
                    client: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            prisma.document.count({ where }),
        ]);

        return NextResponse.json(
            { success: true, data: documents, meta: { total, page, perPage } },
            { status: 200 }
        );
    },
});

// ── POST /api/documents (multipart upload) ────────────────────────────────────

export const POST = createHandler({
    method: 'POST',
    // NOTE: We do NOT set schema here — the body is multipart/form-data, not JSON.
    // Auth and org-scoping still run via the factory. We parse the form manually below.
    handler: async (req: NextRequest, { user, orgId }) => {
        let formData: FormData;
        try {
            formData = await req.formData();
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request must be multipart/form-data' } },
                { status: 422 }
            );
        }

        // ── Extract and validate form fields ──────────────────────────────────

        const file         = formData.get('file') as File | null;
        const name         = (formData.get('name') as string | null)?.trim();
        const documentType = formData.get('documentType') as string | null;
        const caseId       = (formData.get('caseId')   as string | null) ?? undefined;
        const clientId     = (formData.get('clientId') as string | null) ?? undefined;

        // name is required
        if (!name) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document name is required', fields: { name: ['Document name is required'] } } },
                { status: 422 }
            );
        }

        // documentType must be a valid enum value (defaults to OTHER)
        const parsedType = DocumentTypeSchema.safeParse(documentType ?? 'OTHER');
        if (!parsedType.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid documentType', fields: { documentType: [`Must be one of: ${DocumentTypeSchema.options.join(', ')}`] } } },
                { status: 422 }
            );
        }

        // At least one of caseId or clientId must be provided
        if (!caseId && !clientId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either caseId or clientId is required', fields: { caseId: ['Provide caseId or clientId'] } } },
                { status: 422 }
            );
        }

        // file is required
        if (!file || typeof file.arrayBuffer !== 'function') {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'A file must be attached to the upload', fields: { file: ['File is required'] } } },
                { status: 422 }
            );
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `File type '${file.type}' is not allowed. Accepted: PDF, Word, Excel, images, plain text.`,
                        fields: { file: ['Unsupported file type'] },
                    },
                },
                { status: 422 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `File exceeds the maximum allowed size of 50 MB.`,
                        fields: { file: ['File too large'] },
                    },
                },
                { status: 422 }
            );
        }

        // ── Verify ownership of caseId / clientId ─────────────────────────────

        if (caseId) {
            const caseRecord = await prisma.case.findFirst({ where: { id: caseId, orgId } });
            if (!caseRecord) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
                    { status: 404 }
                );
            }
        }

        if (clientId) {
            const clientRecord = await prisma.client.findFirst({ where: { id: clientId, orgId } });
            if (!clientRecord) {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
                    { status: 404 }
                );
            }
        }

        // ── Upload to Cloudflare R2 ───────────────────────────────────────────

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Build a namespaced R2 key: documents/{orgId}/{caseId|clientId}/{timestamp}_{sanitisedName}
        const scope        = caseId ? `cases/${caseId}` : `clients/${clientId}`;
        const safeName     = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const r2Key        = `documents/${orgId}/${scope}/${Date.now()}_${safeName}`;
        const storageUrl   = await uploadToR2(buffer, r2Key, file.type);

        // ── Create Document record ────────────────────────────────────────────

        const document = await prisma.document.create({
            data: {
                orgId:        orgId!,
                caseId:       caseId   ?? null,
                clientId:     clientId ?? null,
                name,
                documentType: parsedType.data,
                storageUrl,
                mimeType:     file.type   || null,
                sizeBytes:    file.size   || null,
                uploadedBy:   user?.id    ?? null,
            },
        });

        // ── Audit log ─────────────────────────────────────────────────────────

        await logAuditEvent({
            orgId:      orgId!,
            userId:     user?.id,
            entityType: 'Document',
            entityId:   caseId ?? clientId ?? document.id,
            action:     'DOCUMENT_UPLOADED',
            diff: {
                after: {
                    documentId:   document.id,
                    name,
                    documentType: parsedType.data,
                    mimeType:     file.type,
                    sizeBytes:    file.size,
                },
            },
        });

        return NextResponse.json({ success: true, data: document }, { status: 201 });
    },
});
