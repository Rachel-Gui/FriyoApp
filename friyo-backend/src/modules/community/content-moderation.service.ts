import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  flaggedLabels?: string[];
}

// AWS Rekognition top-level category keywords to block
const BLOCKED_REKOGNITION_KEYWORDS = [
  'explicit',
  'nudity',
  'violence',
  'drugs',
  'hate',
  'sexual',
  'gore',
  'disturbing',
];

// Default prohibited word list — extend via PROHIBITED_WORDS env var (comma-separated)
const DEFAULT_PROHIBITED_WORDS = [
  'spam', 'scam', 'hate', 'slur', 'kill', 'suicide', 'selfharm',
];

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private readonly rekognition: RekognitionClient;
  private readonly s3Bucket: string;
  private readonly prohibitedWords: string[];

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('aws.region') ?? 'us-east-1';
    this.s3Bucket = this.configService.get<string>('aws.s3Bucket') ?? 'friyo-uploads';

    this.rekognition = new RekognitionClient({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });

    const envWords = this.configService.get<string>('PROHIBITED_WORDS') ?? '';
    const extraWords = envWords
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    this.prohibitedWords = [...DEFAULT_PROHIBITED_WORDS, ...extraWords];
  }

  // ── Text moderation ────────────────────────────────────────────────────────

  checkText(text: string): ModerationResult {
    if (!text?.trim()) return { safe: true };

    const lower = text.toLowerCase().replace(/\s+/g, '');
    const hit = this.prohibitedWords.find((word) => lower.includes(word));

    if (hit) {
      this.logger.debug(`Text flagged: prohibited word "${hit}" detected`);
      return { safe: false, reason: 'Prohibited content detected in text.' };
    }

    return { safe: true };
  }

  // ── Image moderation via AWS Rekognition ───────────────────────────────────

  async checkImage(s3Key: string): Promise<ModerationResult> {
    try {
      const command = new DetectModerationLabelsCommand({
        Image: {
          S3Object: {
            Bucket: this.s3Bucket,
            Name: s3Key,
          },
        },
        MinConfidence: 75,
      });

      const response = await this.rekognition.send(command);
      const labels = response.ModerationLabels ?? [];

      const flagged = labels.filter((label) => {
        const name = (label.Name ?? '').toLowerCase();
        const parent = (label.ParentName ?? '').toLowerCase();
        return BLOCKED_REKOGNITION_KEYWORDS.some(
          (kw) => name.includes(kw) || parent.includes(kw),
        );
      });

      if (flagged.length > 0) {
        const flaggedNames = flagged.map((l) => l.Name ?? '');
        this.logger.warn(`Image flagged by Rekognition: ${flaggedNames.join(', ')}`);
        return {
          safe: false,
          reason: 'Image contains unsafe content.',
          flaggedLabels: flaggedNames,
        };
      }

      return { safe: true };
    } catch (err) {
      // Rekognition errors (e.g., unsupported format, no faces) should not block the post
      this.logger.error(`Rekognition check failed for key ${s3Key}: ${(err as Error).message}`);
      return { safe: true }; // Fail open — let human review flag it later
    }
  }
}
