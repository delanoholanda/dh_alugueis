import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

const DATA_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug;

  if (!slug || !Array.isArray(slug) || slug.length === 0) {
    return new NextResponse('Invalid file path', { status: 400 });
  }

  // Sanitize the path to prevent directory traversal attacks
  const sanitizedPath = path.join(DATA_DIR, ...slug.map(segment => path.normalize(segment).replace(/^(\.\.[\/\\])+/, '')));

  // Double-check that the resolved path is still within our intended directory
  if (!sanitizedPath.startsWith(DATA_DIR)) {
    return new NextResponse('Access denied', { status: 403 });
  }

  try {
    const fileBuffer = await fs.readFile(sanitizedPath);
    const contentType = mime.lookup(sanitizedPath) || 'application/octet-stream';
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('File not found', { status: 404 });
    }
    console.error(`Error reading file at ${sanitizedPath}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
