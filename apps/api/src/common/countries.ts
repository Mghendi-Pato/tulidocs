/**
 * Country defaults. Only suggestions — a business can change currency, tax name, rate and label in Settings.
 * Keep in sync with apps/web/src/lib/countries.ts.
 */
export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  /** what the tax is called on documents */
  taxName: string;
  /** standard rate, percent */
  taxRate: number;
  /** label for the business/client tax number */
  taxIdLabel: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'KE', name: 'Kenya', currency: 'KES', taxName: 'VAT', taxRate: 16, taxIdLabel: 'KRA PIN' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', taxName: 'VAT', taxRate: 18, taxIdLabel: 'TIN' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', taxName: 'VAT', taxRate: 18, taxIdLabel: 'TIN' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', taxName: 'VAT', taxRate: 18, taxIdLabel: 'TIN' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', taxName: 'VAT', taxRate: 15, taxIdLabel: 'TIN' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', taxName: 'VAT', taxRate: 7.5, taxIdLabel: 'TIN' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', taxName: 'VAT', taxRate: 15, taxIdLabel: 'TIN' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', taxName: 'VAT', taxRate: 15, taxIdLabel: 'VAT No.' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', taxName: 'VAT', taxRate: 14, taxIdLabel: 'Tax Reg. No.' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', taxName: 'VAT', taxRate: 20, taxIdLabel: 'ICE' },
  { code: 'US', name: 'United States', currency: 'USD', taxName: 'Sales tax', taxRate: 0, taxIdLabel: 'EIN' },
  { code: 'CA', name: 'Canada', currency: 'CAD', taxName: 'GST/HST', taxRate: 5, taxIdLabel: 'BN' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', taxName: 'IVA', taxRate: 16, taxIdLabel: 'RFC' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', taxName: 'Tax', taxRate: 0, taxIdLabel: 'CNPJ' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxName: 'VAT', taxRate: 20, taxIdLabel: 'VAT No.' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', taxName: 'VAT', taxRate: 23, taxIdLabel: 'VAT No.' },
  { code: 'DE', name: 'Germany', currency: 'EUR', taxName: 'USt.', taxRate: 19, taxIdLabel: 'USt-IdNr.' },
  { code: 'FR', name: 'France', currency: 'EUR', taxName: 'TVA', taxRate: 20, taxIdLabel: 'N° TVA' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', taxName: 'BTW', taxRate: 21, taxIdLabel: 'BTW-nr' },
  { code: 'ES', name: 'Spain', currency: 'EUR', taxName: 'IVA', taxRate: 21, taxIdLabel: 'NIF' },
  { code: 'IT', name: 'Italy', currency: 'EUR', taxName: 'IVA', taxRate: 22, taxIdLabel: 'P. IVA' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', taxName: 'IVA', taxRate: 23, taxIdLabel: 'NIF' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', taxName: 'Moms', taxRate: 25, taxIdLabel: 'VAT No.' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', taxName: 'MWST', taxRate: 8.1, taxIdLabel: 'UID' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', taxName: 'VAT', taxRate: 5, taxIdLabel: 'TRN' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', taxName: 'VAT', taxRate: 15, taxIdLabel: 'VAT No.' },
  { code: 'IN', name: 'India', currency: 'INR', taxName: 'GST', taxRate: 18, taxIdLabel: 'GSTIN' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', taxName: 'Sales tax', taxRate: 18, taxIdLabel: 'NTN' },
  { code: 'CN', name: 'China', currency: 'CNY', taxName: 'VAT', taxRate: 13, taxIdLabel: 'Tax ID' },
  { code: 'JP', name: 'Japan', currency: 'JPY', taxName: 'Consumption tax', taxRate: 10, taxIdLabel: 'T-number' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', taxName: 'GST', taxRate: 9, taxIdLabel: 'GST Reg. No.' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', taxName: 'SST', taxRate: 8, taxIdLabel: 'SST No.' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', taxName: 'VAT', taxRate: 12, taxIdLabel: 'TIN' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', taxName: 'PPN', taxRate: 11, taxIdLabel: 'NPWP' },
  { code: 'AU', name: 'Australia', currency: 'AUD', taxName: 'GST', taxRate: 10, taxIdLabel: 'ABN' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', taxName: 'GST', taxRate: 15, taxIdLabel: 'GST No.' },
];

export const OTHER_COUNTRY: CountryInfo = { code: 'XX', name: 'Other', currency: 'USD', taxName: 'Tax', taxRate: 0, taxIdLabel: 'Tax ID' };

export function countryInfo(code?: string | null): CountryInfo {
  return COUNTRIES.find((c) => c.code === code?.toUpperCase()) ?? OTHER_COUNTRY;
}

export const isCountryCode = (v: unknown) => typeof v === 'string' && /^[A-Z]{2}$/.test(v);

/** Default currency for new documents and businesses: KES in Kenya, USD everywhere else (changeable). */
export function defaultCurrency(country?: string | null): string {
  return (country ?? '').toUpperCase() === 'KE' ? 'KES' : 'USD';
}
