
'use server';

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

// All user-generated content will be stored here. This folder is mapped to a
// persistent volume in docker-compose.yml to survive container restarts.
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_URL_PREFIX = '/uploads';

// Ensures a subdirectory exists within the uploads folder.
async function ensureUploadsDirectory(subdirectory: string): Promise<string> {
  const dirPath = path.join(UPLOADS_DIR, subdirectory);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    throw new Error('Server error: Could not create upload directory.');
  }
  return dirPath;
}

/**
 * Saves a base64 encoded image to a persistent data directory.
 * @param base64Data The base64 data URI (e.g., "data:image/png;base64,iVBOR...").
 * @param subdirectory The subdirectory within 'data/uploads/' (e.g., 'customers').
 * @returns The public-facing URL path to the saved image.
 */
export async function saveFile(base64Data: string, subdirectory: string): Promise<string> {
  // If the provided string is not a new base64 upload, assume it's an existing URL and return it.
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return base64Data;
  }

  const dirPath = await ensureUploadsDirectory(subdirectory);

  const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image string provided.');
  }

  const base64EncodedImage = matches[2];
  const originalBuffer = Buffer.from(base64EncodedImage, 'base64');
  
  // Process the image with Sharp
  const processedBuffer = await sharp(originalBuffer)
    .rotate() // Auto-rotates the image based on EXIF data.
    .resize(1024, 1024, { 
      fit: 'inside', // Resize to fit within 1024x1024, maintaining aspect ratio
      withoutEnlargement: true // Don't enlarge images that are already smaller
    })
    .webp({ quality: 80 }) // Convert to WebP format with 80% quality
    .toBuffer();

  const filename = `${uuidv4()}.webp`; // Always save as .webp now
  const filePath = path.join(dirPath, filename);

  await fs.writeFile(filePath, processedBuffer);

  // Return the URL that the /app/uploads/[...slug]/route.ts handler will serve
  return `${PUBLIC_URL_PREFIX}/${subdirectory}/${filename}`;
}

/**
 * Deletes a file from the uploads directory based on its public URL.
 * @param publicUrl The public URL of the file to delete (e.g., '/uploads/customers/filename.png').
 */
export async function deleteFile(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith(PUBLIC_URL_PREFIX)) {
    // Not a local file managed by our system, so we do nothing.
    return;
  }
  
  // Convert the public URL to a local filesystem path
  // e.g., /uploads/customers/file.png -> /app/data/uploads/customers/file.png
  const relativePath = publicUrl.substring(PUBLIC_URL_PREFIX.length);
  const filePath = path.join(UPLOADS_DIR, relativePath);

  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    // It's not a critical error if the file doesn't exist, so we only log other errors.
    if (error.code !== 'ENOENT') {
      console.error(`Failed to delete file at ${filePath}:`, error);
    }
  }
}
