import { Injectable } from '@nestjs/common';
import type { DocumentType, Organization } from '@prisma/client';
import { Tx } from '../prisma/prisma.service';

export function prefixOf(org: Pick<Organization, 'invoicePrefix' | 'quotePrefix' | 'receiptPrefix'>, type: DocumentType) {
  return type === 'QUOTE' ? org.quotePrefix : type === 'RECEIPT' ? org.receiptPrefix : org.invoicePrefix;
}

export const formatNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`;

/** Per-business running numbers. Always call inside a transaction (row lock via upsert). */
@Injectable()
export class SequencesService {
  /** Next free number (INV-0007), skipping any already used (e.g. typed in by hand or claimed from a guest). */
  async next(tx: Tx, org: Organization, type: DocumentType): Promise<string> {
    const prefix = prefixOf(org, type);
    for (let attempt = 0; attempt < 50; attempt++) {
      const seq = await tx.sequence.upsert({
        where: { organizationId_type: { organizationId: org.id, type } },
        create: { organizationId: org.id, type, next: 2 },
        update: { next: { increment: 1 } },
      });
      const n = seq.next - 1;
      const number = formatNumber(prefix, n);
      const taken = await tx.document.findFirst({ where: { organizationId: org.id, type, number }, select: { id: true } });
      if (!taken) return number;
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  /** What the next number will look like (for the editor), without using it up */
  async peek(tx: Tx, org: Organization, type: DocumentType): Promise<string> {
    const seq = await tx.sequence.findUnique({ where: { organizationId_type: { organizationId: org.id, type } } });
    return formatNumber(prefixOf(org, type), seq?.next ?? 1);
  }
}
