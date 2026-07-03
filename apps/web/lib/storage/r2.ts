import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.warn('R2 storage credentials missing — file uploads will fail or use mock URLs.');
}

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || 'mock-key',
    secretAccessKey: secretAccessKey || 'mock-secret',
  },
});

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  mimeType: string = 'application/pdf',
): Promise<string> {
  if (!accountId) {
    console.warn(`[Mock Upload] Skipping upload for ${key}`);
    return `https://mock-storage.local/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });
}

export function extractR2Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'mock-storage.local') return null;
    return parsed.pathname.replace(/^\//, '') || null;
  } catch {
    return null;
  }
}

export async function refreshSignedUrl(storageUrl: string): Promise<string> {
  const r2Key = extractR2Key(storageUrl);
  if (!r2Key || !bucketName || !process.env.R2_ACCOUNT_ID) {
    return storageUrl;
  }

  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: r2Key });
    return await getSignedUrl(s3Client, command, { expiresIn: 604800 });
  } catch (err) {
    console.warn('[R2] Could not refresh signed URL:', err);
    return storageUrl;
  }
}
