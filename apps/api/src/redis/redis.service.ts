import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Small wrapper over ioredis. Used for: preview image cache, Google OAuth state,
 * the M-Pesa access token, and rate limiting (see redis-throttler.storage.ts).
 * Every key is prefixed with REDIS_PREFIX so several apps can share one Redis.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  readonly prefix: string;

  constructor(config: ConfigService) {
    this.prefix = config.get<string>('REDIS_PREFIX', 'nvi:');
    this.client = new Redis(config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379'), {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on('error', (e) => this.logger.warn(`Redis: ${e.message}`));
  }

  key(k: string) {
    return `${this.prefix}${k}`;
  }

  async getJson<T>(k: string): Promise<T | null> {
    const raw = await this.client.get(this.key(k));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(k: string, value: unknown, ttlSeconds: number) {
    await this.client.set(this.key(k), JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** Read once and delete (OAuth state) */
  async take<T>(k: string): Promise<T | null> {
    const raw = await this.client.getdel(this.key(k));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async getBuffer(k: string): Promise<Buffer | null> {
    return this.client.getBuffer(this.key(k));
  }

  async setBuffer(k: string, value: Buffer, ttlSeconds: number) {
    await this.client.set(this.key(k), value, 'EX', ttlSeconds);
  }

  async del(k: string) {
    await this.client.del(this.key(k));
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
