import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Document, Organization } from '@prisma/client';
import QRCode from 'qrcode';

/**
 * KRA eTIMS (OSCU, system-to-system) — PLACEHOLDER.
 *
 * Nothing here talks to KRA yet. The shape is ready so the rest of the app doesn't change when it does:
 *
 *  1. Certification: build against the eTIMS sandbox (ETIMS_BASE_URL), then apply to KRA as a third-party
 *     integrator with the OSCU bio-data form. Until approved, keep ETIMS_ENABLED=false.
 *  2. Onboarding a business (Settings → eTIMS): the business registers on etims.kra.go.ke, picks OSCU,
 *     and gives us KRA PIN + branch id (usually "00") + device serial. We call `initializeDevice()`
 *     (OSCU "selectInitOsdcInfo") and store the returned cmcKey on the Organization.
 *  3. Items: each product/service needs a KRA item classification code, tax type (A–E) and unit codes
 *     ("saveItem"). Map them from DocumentItem when this is built.
 *  4. Issuing: when an invoice is finalised, `signInvoice()` posts it ("saveTrnsSalesOsdc") and stores the
 *     returned CU invoice number, receipt number, signature and QR URL on the Document. The templates
 *     already print these (see render/templates — `etims` block).
 *  5. Credit notes must be raised through the same solution as the original invoice.
 */
@Injectable()
export class EtimsService {
  private readonly logger = new Logger(EtimsService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return this.config.get('ETIMS_ENABLED') === 'true';
  }

  /** OSCU device initialization → returns the cmcKey to store on the organization */
  async initializeDevice(org: Pick<Organization, 'taxId' | 'etimsBranchId' | 'etimsDeviceSerial'>): Promise<{ cmcKey: string }> {
    this.notReady();
    this.logger.debug(`would initialise ${org.taxId}/${org.etimsBranchId}/${org.etimsDeviceSerial}`);
    return { cmcKey: '' };
  }

  /** Sends a finalised invoice to KRA and returns the signature data to print */
  async signInvoice(doc: Pick<Document, 'id' | 'number'>, org: Pick<Organization, 'etimsCmcKey'>): Promise<{
    invoiceNo: string;
    receiptNo: string;
    signature: string;
    qrUrl: string;
  }> {
    this.notReady();
    this.logger.debug(`would sign ${doc.number} with ${org.etimsCmcKey ? 'key' : 'no key'}`);
    return { invoiceNo: '', receiptNo: '', signature: '', qrUrl: '' };
  }

  /** QR image (data URL) for a signed document, printed on the template */
  async qrFor(doc: Pick<Document, 'etimsQrUrl'>): Promise<string | null> {
    if (!doc.etimsQrUrl) return null;
    return QRCode.toDataURL(doc.etimsQrUrl, { margin: 0, width: 168 });
  }

  private notReady(): never {
    throw new HttpException({ code: 'ETIMS_NOT_READY', message: 'KRA eTIMS invoicing is coming soon.' }, HttpStatus.NOT_IMPLEMENTED);
  }
}
