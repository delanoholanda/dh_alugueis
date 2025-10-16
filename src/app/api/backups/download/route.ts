
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return new NextResponse('Filename is required', { status: 400 });
  }

  // --- Security Check ---
  // Normalize the filename to prevent directory traversal attacks.
  // path.normalize will resolve '..' segments. path.basename will extract the final part.
  const sanitizedFilename = path.basename(path.normalize(filename));
  // After sanitization, if the filename is not what was originally passed, it's suspicious.
  if (sanitizedFilename !== filename) {
    return new NextResponse('Invalid filename', { status: 400 });
  }
  
  const filePath = path.join(BACKUPS_DIR, sanitizedFilename);
  
  // Final check to ensure we are still within the intended directory.
  if (!filePath.startsWith(BACKUPS_DIR)) {
      return new NextResponse('Access Denied', { status: 403 });
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    
    // Set headers to trigger a download dialog in the browser.
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('File not found', { status: 404 });
    }
    console.error(`Error reading backup file at ${filePath}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
