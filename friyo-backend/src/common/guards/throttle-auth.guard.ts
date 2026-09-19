import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Strict throttle guard for authentication endpoints.
 * Limit: 5 requests per 60 seconds, keyed by IP address.
 * Apply via @UseGuards(ThrottlerAuthGuard) + @Throttle({ auth: { limit: 5, ttl: 60000 } })
 */
@Injectable()
export class ThrottlerAuthGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use forwarded IP first (behind load balancer), fall back to direct connection
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown');
    return `auth:${ip}`;
  }
}
