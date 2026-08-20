import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const isS3Configured = Boolean(
  process.env.AWS_S3_ACCESS_KEY_ID &&
  process.env.AWS_S3_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET
);

const s3Client = isS3Configured
  ? new S3Client({
      region: process.env.AWS_S3_REGION || 'us-east-1',
      endpoint: process.env.AWS_S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export async function uploadFile(
  bucket: 'avatars' | 'logos' | 'attachments',
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  if (s3Client && process.env.AWS_S3_BUCKET) {
    const s3Key = `${bucket}/${key}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicBase =
      process.env.STORAGE_PUBLIC_URL ||
      (process.env.AWS_S3_ENDPOINT
        ? `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET}`
        : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION || 'us-east-1'}.amazonaws.com`);

    return {
      url: `${publicBase}/${s3Key}`,
      key: s3Key,
    };
  }

  // Local fallback for offline/development environments
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', bucket);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, key);
  await fs.promises.writeFile(filePath, buffer);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return {
    url: `${appUrl}/uploads/${bucket}/${key}`,
    key: `${bucket}/${key}`,
  };
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  if (s3Client && process.env.AWS_S3_BUCKET) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      })
    );
    return;
  }

  // Local fallback
  const filePath = path.join(process.cwd(), 'public', 'uploads', key);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath).catch(() => {});
  }
}
