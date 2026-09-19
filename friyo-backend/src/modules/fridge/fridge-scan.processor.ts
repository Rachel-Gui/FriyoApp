import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

import { ScanSession, ScanStatus } from '../../database/entities/scan-session.entity';
import { Ingredient } from '../../database/entities/ingredient.entity';

interface ScanJobData {
  sessionId: string;
  imageKey: string;
  imageUrl: string;
  userId: string;
}

interface DetectedItem {
  name: string;
  estimated_quantity: number;
  unit: string;
  storage_type: string;
  estimated_shelf_days: number;
  category: string;
  ingredient_id: string | null;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const SYSTEM_PROMPT =
  'You are a food inventory scanner. Analyze this fridge/pantry image and return a JSON array of detected food items. ' +
  'For each item return: {name, estimated_quantity, unit, storage_type, estimated_shelf_days, category}. ' +
  'Be specific with quantities. Return [] if no visible food inventory is present. Return ONLY valid JSON array, no markdown and no other text.';

@Processor('fridge-scan')
export class FridgeScanProcessor {
  private readonly logger = new Logger(FridgeScanProcessor.name);
  private readonly s3: S3Client;
  private readonly s3Bucket: string;
  private readonly geminiApiKey: string;
  private readonly geminiModel: string;

  constructor(
    @InjectRepository(ScanSession)
    private readonly scanSessionRepo: Repository<ScanSession>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    private readonly configService: ConfigService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    this.geminiModel = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    const region = this.configService.get<string>('aws.region') ?? 'us-east-1';
    this.s3Bucket = this.configService.get<string>('aws.s3Bucket') ?? 'friyo-uploads';
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });
  }

  @Process('fridge.scan')
  async handleScan(job: Job<ScanJobData>): Promise<void> {
    const { sessionId, imageKey } = job.data;
    this.logger.log(`Processing scan job for session ${sessionId}`);

    try {
      const base64Image = await this.downloadFromS3(imageKey);
      const detected = await this.callGeminiVision(base64Image);
      const withMatches = await this.matchIngredients(detected);

      await this.scanSessionRepo.update(sessionId, {
        status: ScanStatus.COMPLETED,
        aiRawResult: { detected: withMatches },
      });

      this.logger.log(`Scan session ${sessionId} completed — ${withMatches.length} items detected`);
    } catch (err) {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      this.logger.error(`Scan session ${sessionId} attempt ${job.attemptsMade + 1}/${attempts} failed: ${(err as Error).message}`);
      if (isFinalAttempt) {
        await this.scanSessionRepo.update(sessionId, { status: ScanStatus.FAILED });
      }
      throw err;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ScanJobData>, err: Error) {
    this.logger.error(`Job ${job.id} (session ${job.data.sessionId}) failed after all retries: ${err.message}`);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async downloadFromS3(key: string): Promise<string> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('base64');
  }

  private async callGeminiVision(base64Image: string): Promise<DetectedItem[]> {
    if (!this.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    try {
      return await this.callGeminiVisionOnce(base64Image, true);
    } catch (err) {
      this.logger.warn(`Gemini structured response failed, retrying without schema: ${(err as Error).message}`);
      return this.callGeminiVisionOnce(base64Image, false);
    }
  }

  private async callGeminiVisionOnce(base64Image: string, withSchema: boolean): Promise<DetectedItem[]> {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    };

    if (withSchema) {
      generationConfig.responseSchema = {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            estimated_quantity: { type: 'NUMBER' },
            unit: { type: 'STRING' },
            storage_type: { type: 'STRING' },
            estimated_shelf_days: { type: 'NUMBER' },
            category: { type: 'STRING' },
          },
          required: ['name', 'estimated_quantity', 'unit', 'storage_type', 'estimated_shelf_days', 'category'],
        },
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
                {
                  text: 'Detect visible food inventory. Return [] if the image is just an appliance, UI mockup, or contains no identifiable food.',
                },
              ],
            },
          ],
          generationConfig,
        }),
      },
    );

    const data = await response.json() as GeminiGenerateContentResponse;
    if (!response.ok) {
      throw new Error(data.error?.message ?? `Gemini request failed with status ${response.status}`);
    }

    const raw = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? '')
      .join('')
      .trim() ?? '[]';

    const parsed = this.parseGeminiJson(raw);

    const items: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>)['items'] as unknown[] ?? [];

    return items as DetectedItem[];
  }

  private parseGeminiJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn('Gemini returned non-JSON response, attempting extraction');
    }

    const unfenced = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(unfenced);
    } catch {
      // Continue to bracket extraction below.
    }

    const arrayStart = raw.indexOf('[');
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
      } catch {
        // Continue to object extraction below.
      }
    }

    const objectStart = raw.indexOf('{');
    const objectEnd = raw.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(raw.slice(objectStart, objectEnd + 1));
      } catch {
        // Fall through to a useful error.
      }
    }

    throw new Error(`Could not extract JSON from Gemini response: ${raw.slice(0, 200)}`);
  }

  private async matchIngredients(detected: DetectedItem[]): Promise<DetectedItem[]> {
    const results: DetectedItem[] = [];

    for (const item of detected) {
      const name = item.name?.trim();
      if (!name) {
        results.push({ ...item, ingredient_id: null });
        continue;
      }

      // Exact case-insensitive match first
      let match = await this.ingredientRepo
        .createQueryBuilder('i')
        .where('LOWER(i.name) = LOWER(:name)', { name })
        .orWhere('LOWER(i.nameZh) = LOWER(:name)', { name })
        .getOne();

      // Fallback: partial ILIKE match
      if (!match) {
        match = await this.ingredientRepo
          .createQueryBuilder('i')
          .where('i.name ILIKE :pattern', { pattern: `%${name}%` })
          .orderBy('LENGTH(i.name)', 'ASC')
          .getOne();
      }

      // Fallback: alias array search (simple-json stored as text)
      if (!match) {
        match = await this.ingredientRepo
          .createQueryBuilder('i')
          .where("i.aliases LIKE :aliasPattern", { aliasPattern: `%"${name}"%` })
          .getOne();
      }

      results.push({ ...item, ingredient_id: match?.id ?? null });
    }

    return results;
  }
}
