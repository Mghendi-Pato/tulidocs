import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import puppeteer, { Browser } from 'puppeteer';
import { BRAND } from '../common/brand';
import { RedisService } from '../redis/redis.service';
import { renderHtml, RenderDoc, RenderOptions } from './templates';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PREVIEW_TTL = 15 * 60; // seconds

/**
 * Turns template HTML into a PDF (download) or a JPEG (live preview) with one shared headless Chrome.
 * Clean output only ever leaves the server through these methods, so a watermark can't be removed in the browser.
 */
@Injectable()
export class RenderService implements OnModuleDestroy {
  private readonly logger = new Logger(RenderService.name);
  private browser: Promise<Browser> | null = null;
  private active = 0;
  private readonly queue: (() => void)[] = [];
  private readonly maxConcurrent: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.maxConcurrent = Number(config.get('RENDER_CONCURRENCY', 3));
  }

  html(doc: RenderDoc, opts: RenderOptions) {
    return renderHtml(doc, { footer: BRAND.footer, ...opts });
  }

  async pdf(doc: RenderDoc, opts: RenderOptions): Promise<Buffer> {
    const html = this.html(doc, opts);
    return this.withPage(async (page) => {
      await page.setContent(html, { waitUntil: 'load' });
      const out = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      return Buffer.from(out);
    });
  }

  /** JPEG of the whole document (all pages stacked), cached in Redis by content. */
  async preview(doc: RenderDoc, opts: RenderOptions): Promise<Buffer> {
    const html = this.html(doc, opts);
    const key = `preview:${createHash('sha256').update(html).digest('hex')}`;
    const cached = await this.redis.getBuffer(key).catch(() => null);
    if (cached) return cached;

    const img = await this.withPage(async (page) => {
      await page.setViewport({ width: A4_WIDTH, height: A4_HEIGHT, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'load' });
      const height = await page.evaluate(() => Math.max(document.body.scrollHeight, 1123));
      await page.setViewport({ width: A4_WIDTH, height: Math.min(height, A4_HEIGHT * 6), deviceScaleFactor: 2 });
      const shot = await page.screenshot({ type: 'jpeg', quality: 82, fullPage: false });
      return Buffer.from(shot);
    });
    await this.redis.setBuffer(key, img, PREVIEW_TTL).catch(() => undefined);
    return img;
  }

  // ───────────────────────── Browser pool ─────────────────────────

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = this.config.get<string>('CHROME_PATH') || undefined;
      this.browser = puppeteer
        .launch({
          headless: true,
          executablePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
        })
        .then((b) => {
          b.on('disconnected', () => {
            this.logger.warn('Chrome disconnected — will relaunch on next render');
            this.browser = null;
          });
          this.logger.log('Headless Chrome started');
          return b;
        })
        .catch((e: Error) => {
          this.browser = null;
          this.logger.error(`Could not start Chrome: ${e.message}`);
          throw new ServiceUnavailableException({ code: 'RENDER_UNAVAILABLE', message: 'Document rendering is unavailable right now. Please try again shortly.' });
        });
    }
    return this.browser;
  }

  private async slot() {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  private release() {
    this.active--;
    this.queue.shift()?.();
  }

  private async withPage<T>(fn: (page: import('puppeteer').Page) => Promise<T>): Promise<T> {
    await this.slot();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      // Templates are self-contained: block every network request (no remote images, no tracking)
      await page.setRequestInterception(true);
      page.on('request', (req) => (/^(data|about):/.test(req.url()) ? req.continue() : req.abort()));
      page.setDefaultTimeout(20_000);
      try {
        return await fn(page);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      this.release();
    }
  }

  async onModuleDestroy() {
    if (this.browser) await (await this.browser.catch(() => null))?.close().catch(() => undefined);
  }
}
