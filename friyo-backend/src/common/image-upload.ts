import { BadRequestException } from '@nestjs/common';
const sharp: typeof import('sharp').default = require('sharp');

export const imageUploadLimits = { fileSize: 10 * 1024 * 1024, files: 3 };
/** Decode pixels, strip metadata and encode a known format before persistence. */
export async function normalizeImage(file?: Express.Multer.File): Promise<Express.Multer.File> {
  if (!file?.buffer?.length) throw new BadRequestException('An image is required');
  if (file.buffer.length > imageUploadLimits.fileSize) throw new BadRequestException('Image exceeds 10 MB');
  try {
    const buffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 }).rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { ...file, buffer, originalname: 'image.jpg', mimetype: 'image/jpeg', size: buffer.length };
  } catch { throw new BadRequestException('Please upload a valid JPEG, PNG or supported photo'); }
}
