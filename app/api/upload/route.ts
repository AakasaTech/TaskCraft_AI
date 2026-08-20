import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/helpers';
import { uploadFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'avatars';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!['avatars', 'logos', 'attachments'].includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    }

    // Generate unique key
    const ext = file.name.split('.').pop() || 'png';
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const key = `${user.id}-${Date.now()}-${randomSuffix}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFile(bucket as 'avatars' | 'logos' | 'attachments', key, buffer, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
