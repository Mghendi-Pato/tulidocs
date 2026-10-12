import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BRAND } from '../common/brand';

export interface Mail {
  to: string;
  subject: string;
  /** short plain-text version (shown by mail clients that don't render HTML) */
  text: string;
  html: string;
}

/**
 * Transactional email through Resend (https://resend.com) — password resets, security notices.
 * RESEND_API_KEY unset (local dev) → the email is written to the log instead of being sent.
 * The sender's domain must be verified in Resend (RESEND_FROM_EMAIL/RESEND_FROM_NAME, or MAIL_FROM).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Sender, from either style of settings:
   *   RESEND_FROM_EMAIL=no-reply@tulidocs.com + RESEND_FROM_NAME=tuli   (name optional)
   *   MAIL_FROM="tuli <no-reply@tulidocs.com>"
   * Default: tuli <no-reply@tulidocs.com>
   */
  private from() {
    const email = this.config.get<string>('RESEND_FROM_EMAIL');
    if (email) return `${this.config.get<string>('RESEND_FROM_NAME') || BRAND.name} <${email}>`;
    return this.config.get<string>('MAIL_FROM') || `${BRAND.name} <no-reply@${BRAND.domain}>`;
  }

  get enabled() {
    return !!this.config.get<string>('RESEND_API_KEY');
  }

  async send(mail: Mail): Promise<boolean> {
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.from();
    const replyTo = this.config.get<string>('MAIL_REPLY_TO') || this.config.get<string>('RESEND_REPLY_TO') || 'info@nubiannetworks.com';
    if (!key) {
      this.logger.log(`[mail disabled — set RESEND_API_KEY] To: ${mail.to} · ${mail.subject}\n${mail.text}`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [mail.to], reply_to: replyTo, subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (!res.ok) {
        this.logger.warn(`Resend refused email to ${mail.to}: ${res.status} ${await res.text().catch(() => '')}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Email to ${mail.to} failed: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Simple, email-client-safe layout (tables + inline styles) */
export function emailLayout(opts: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }) {
  // the logo is a PNG served by the website (email apps don't show SVG); alt text "tuli" shows if images are blocked
  const appUrl = (process.env.APP_URL || `https://${BRAND.domain}`).replace(/\/$/, '');
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b3140">${t}</p>`;
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:#2451d6">
         <a href="${esc(opts.button.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(opts.button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 20px;font-size:12.5px;line-height:1.5;color:#6b7385">Button not working? Copy this link into your browser:<br><a href="${esc(opts.button.url)}" style="color:#2451d6;word-break:break-all">${esc(opts.button.url)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e3e7ee">
      <tr><td style="padding:28px 32px 8px">
        <a href="${esc(appUrl)}" style="text-decoration:none"><img src="${esc(appUrl)}/images/tuli-email.png" width="84" height="28" alt="tuli" style="display:block;border:0;outline:none;height:28px;width:84px;font-size:22px;font-weight:800;color:#0c0d12"></a>
      </td></tr>
      <tr><td style="padding:8px 32px 28px">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0c0d12">${esc(opts.heading)}</h1>
        ${opts.paragraphs.map(p).join('')}
        ${button}
        ${opts.footnote ? `<p style="margin:0;font-size:12.5px;line-height:1.5;color:#6b7385">${opts.footnote}</p>` : ''}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#8a93a3">${BRAND.name} · ${BRAND.domain} · Nubian Networks Limited, Nairobi</p>
  </td></tr></table></body></html>`;
}

export { esc as escapeHtml };
