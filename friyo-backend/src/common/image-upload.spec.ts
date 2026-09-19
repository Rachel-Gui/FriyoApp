import { normalizeImage } from './image-upload';
const sharp: typeof import('sharp').default = require('sharp');
describe('photo uploads', () => {
  it('decodes a real image and strips embedded metadata', async () => {
    const buffer = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#ffcc00' } }).withMetadata().png().toBuffer();
    const result = await normalizeImage({ buffer, size: buffer.length, originalname: 'photo.png', mimetype: 'image/png' } as any);
    const metadata = await sharp(result.buffer).metadata();
    expect(result.mimetype).toBe('image/jpeg'); expect(metadata.format).toBe('jpeg'); expect(metadata.exif).toBeUndefined();
  });
  it('rejects content that only claims to be an image', async () => {
    await expect(normalizeImage({ buffer: Buffer.from('<script>'), mimetype: 'image/jpeg' } as any)).rejects.toThrow('valid JPEG');
  });
  it('rejects missing input before uploading', async () => { await expect(normalizeImage()).rejects.toThrow('image is required'); });
});
