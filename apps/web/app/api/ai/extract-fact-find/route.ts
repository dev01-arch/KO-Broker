import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { extractFactFindFromDocument } from '@/lib/ai/extractFactFindFromDocument';
import { isOpenRouterConfigured } from '@/lib/ai/openRouterClient';
import { apiError, apiSuccess } from '@/lib/api/responses';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    if (!isOpenRouterConfigured()) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'AI document extraction is not configured. Set OPENROUTER_API_KEY in your environment.',
        503,
      );
    }

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return apiError('VALIDATION_ERROR', 'Request must be multipart/form-data', 422);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError('VALIDATION_ERROR', 'Failed to parse form data', 422);
    }

    const file = formData.get('file') as File | null;
    const documentCategory = (formData.get('documentCategory') as string | null)?.trim() || undefined;

    if (!file || typeof file.arrayBuffer !== 'function') {
      return apiError('VALIDATION_ERROR', 'A file must be attached to the upload', 422);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        'VALIDATION_ERROR',
        `File type '${file.type}' is not allowed. Accepted: PDF, PNG, JPEG.`,
        422,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError('VALIDATION_ERROR', 'File exceeds the maximum allowed size of 20 MB.', 422);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await extractFactFindFromDocument({
      buffer,
      filename: file.name,
      mimeType: file.type,
      documentCategory,
    });

    if (result.fieldsFound === 0) {
      return apiError(
        'EXTRACTION_EMPTY',
        'No fact-find fields could be extracted from this document. Try a clearer PDF or image, or enter details manually.',
        422,
      );
    }

    return apiSuccess(result);
  } catch (error) {
    console.error('[POST /api/ai/extract-fact-find]', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during extraction';
    return apiError('EXTRACTION_FAILED', message, 500);
  }
}
