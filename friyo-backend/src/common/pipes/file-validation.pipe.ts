import { PipeTransform, Injectable } from '@nestjs/common';
import { normalizeImage } from '../image-upload';

export interface ValidatedFile {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
  size: number;
}

/** Shared decoder strips metadata and bounds upload size and pixel count. */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File | undefined): Promise<ValidatedFile> {
    return normalizeImage(file);
  }
}
