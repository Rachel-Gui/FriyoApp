import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Per-user throttle guard for AI endpoints.
 * Limit: 20 requests per 60 seconds, keyed by authenticated user ID.
 * Falls back to IP if no authenticated user (unauthenticated requests are blocked
 * earlier by JwtAuthGuard, so this is mainly a safety net).
 * Apply via @UseGuards(ThrottlerAiGuard) + @Throttle({ ai: { limit: 20, ttl: 60000 } })
 */
@Injectable()
export class ThrottlerAiGuard extends ThrottlerGuard {
  protected async getTracker(req: Request & { user?: { id?: string; sub?: string } }): Promise<string> {
    const userId = req.user?.id ?? req.user?.sub;
    if (userId) return `ai:user:${userId}`;

    // Fallback to IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown');
    return `ai:ip:${ip}`;
  }
}
