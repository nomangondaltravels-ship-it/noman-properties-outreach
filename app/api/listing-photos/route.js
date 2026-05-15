import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'property-photos';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 10;

const extensionByType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function fileExtension(file) {
  const fromType = extensionByType[file.type];
  if (fromType) return fromType;

  const match = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || 'jpg';
}

async function ensureBucket(supabase) {
  const { error } = await supabase.storage.getBucket(BUCKET);
  if (!error) {
    await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Object.keys(extensionByType)
    });
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Object.keys(extensionByType)
  });

  if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
    throw createError;
  }
}

export async function POST(request) {
  const formData = await request.formData();
  const files = formData
    .getAll('photos')
    .filter((file) => file && typeof file.arrayBuffer === 'function')
    .slice(0, MAX_FILES);

  if (!files.length) {
    return NextResponse.json({ error: 'Please choose at least one image.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    await ensureBucket(supabase);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to prepare photo storage.' }, { status: 500 });
  }

  const photos = [];
  for (const file of files) {
    if (!String(file.type || '').startsWith('image/')) {
      return NextResponse.json({ error: `${file.name || 'File'} is not an image.` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `${file.name || 'Image'} is larger than 8 MB.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${fileExtension(file)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Photo upload failed.' }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    photos.push(data.publicUrl);
  }

  return NextResponse.json({ photos });
}
