export type Money = string;
export type Currency = string;
export type DocType = 'QUOTE' | 'INVOICE' | 'RECEIPT';
export type DocStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type Plan = 'FREE' | 'STARTER' | 'PRO';
export type Cycle = 'MONTHLY' | 'YEARLY';
export type Provider = 'MPESA' | 'CARD';
export type PaymentMethod = 'MPESA' | 'BANK' | 'CASH' | 'CARD' | 'CHEQUE' | 'OTHER';

export interface Me {
  id: string;
  name: string;
  email: string;
  role: 'SYSTEM_ADMIN' | 'ADMIN' | 'STAFF';
  avatarUrl: string | null;
  hasPassword: boolean;
  google: boolean;
  organization: {
    id: string;
    name: string;
    currency: string;
    country: string | null;
    taxName: string;
    taxIdLabel: string;
    hasLogo: boolean;
    defaultTemplate: string;
    plan: Plan;
    planExpiresAt: string | null;
    watermark: boolean;
    usage: { used: number; limit: number | null };
    etimsEnabled: boolean;
  } | null;
}

export interface Item {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

/** What the editor sends (create / update / preview) */
export interface DocInput {
  type: DocType;
  number?: string | null;
  template: string;
  accent: string;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  /** editor only (guest builder): drives currency and tax defaults; never sent */
  country?: string;
  /** guest documents: tax wording (businesses use Settings) */
  taxName?: string;
  taxIdLabel?: string;
  fromName?: string;
  fromEmail?: string | null;
  fromPhone?: string | null;
  fromAddress?: string | null;
  fromTaxId?: string | null;
  /** false = leave the sender's tax number (and its label) off this document */
  showFromTaxId?: boolean;
  fromLogo?: string | null;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  clientTaxId?: string | null;
  items: Item[];
  discount: string;
  notes?: string | null;
  terms?: string | null;
  paymentInfo?: string | null;
}

export interface Doc extends DocInput {
  id: string;
  organizationId: string | null;
  status: DocStatus;
  number: string;
  subtotal: Money;
  taxTotal: Money;
  total: Money;
  amountPaid: Money;
  balance: Money;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  sourceId: string | null;
  source?: { number: string } | null;
  watermark: boolean;
  unlocked: boolean;
  unlockedAt: string | null;
  editWindowOpen: boolean;
  createdAt: string;
  updatedAt: string;
  items: (Item & { amount: Money; position: number; id: string })[];
  related?: { id: string; type: DocType; number: string; status: DocStatus; total: Money; issueDate: string }[];
  /** invoices: paid but not yet covered by a receipt */
  unreceipted?: Money;
}

export interface DocRow {
  id: string;
  type: DocType;
  status: DocStatus;
  number: string;
  issueDate: string;
  dueDate: string | null;
  clientName: string;
  currency: string;
  total: Money;
  amountPaid: Money;
  balance: Money;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  outstanding?: Money;
  openInvoices?: number;
}

export interface Organization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  website: string | null;
  logo: string | null;
  currency: string;
  country: string | null;
  taxName: string;
  taxIdLabel: string;
  mpesaPaybill: string | null;
  mpesaAccount: string | null;
  mpesaTill: string | null;
  bankDetails: string | null;
  defaultTemplate: string;
  defaultTaxRate: string;
  defaultTerms: string | null;
  defaultNotes: string | null;
  paymentTermDays: number;
  invoicePrefix: string;
  quotePrefix: string;
  receiptPrefix: string;
  etimsEnabled: boolean;
  etimsBranchId: string | null;
  etimsDeviceSerial: string | null;
}

export interface PlanInfo {
  id: Plan;
  name: string;
  tagline: string;
  prices: Record<Cycle, number> | null;
  features: string[];
  available: boolean;
}

/** Regional price list: USD worldwide, local currency where a region is set up (e.g. KES for Kenya) */
export interface Pricing {
  region: string;
  country: string | null;
  currency: string;
  plans: PlanInfo[];
  unlockPrice: number;
  freeMonthlyDocs: number;
  providers: Provider[];
}

export interface CheckoutStart {
  checkoutId: string;
  provider: Provider;
  status: 'PENDING';
  message?: string;
  authorizationUrl?: string;
}

export interface CheckoutStatus {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  purpose: 'DOCUMENT_UNLOCK' | 'SUBSCRIPTION';
  provider: Provider;
  amount: Money;
  documentId: string | null;
  plan: Plan | null;
  receipt: string | null;
  failureReason: string | null;
  guest: boolean;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}

export interface BillingOverview extends Pricing {
  current: { plan: Plan; billingCycle: Cycle | null; expiresAt: string | null; expiredPlan: Plan | null; graceDays: number; renewDate: string | null };
  history: {
    id: string;
    purpose: string;
    provider: Provider;
    status: string;
    amount: string;
    currency: string;
    plan: Plan | null;
    billingCycle: Cycle | null;
    receipt: string | null;
    createdAt: string;
    document: { number: string } | null;
  }[];
}
