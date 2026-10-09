'use client';

import { Globe2 } from 'lucide-react';
import type { FlagComponent } from 'country-flag-icons/react/3x2';
import { COUNTRIES } from '@/lib/countries';
import AE from 'country-flag-icons/react/3x2/AE';
import AU from 'country-flag-icons/react/3x2/AU';
import BR from 'country-flag-icons/react/3x2/BR';
import CA from 'country-flag-icons/react/3x2/CA';
import CH from 'country-flag-icons/react/3x2/CH';
import CN from 'country-flag-icons/react/3x2/CN';
import DE from 'country-flag-icons/react/3x2/DE';
import EG from 'country-flag-icons/react/3x2/EG';
import ES from 'country-flag-icons/react/3x2/ES';
import ET from 'country-flag-icons/react/3x2/ET';
import EU from 'country-flag-icons/react/3x2/EU';
import FR from 'country-flag-icons/react/3x2/FR';
import GB from 'country-flag-icons/react/3x2/GB';
import GH from 'country-flag-icons/react/3x2/GH';
import ID from 'country-flag-icons/react/3x2/ID';
import IE from 'country-flag-icons/react/3x2/IE';
import IN from 'country-flag-icons/react/3x2/IN';
import IT from 'country-flag-icons/react/3x2/IT';
import JP from 'country-flag-icons/react/3x2/JP';
import KE from 'country-flag-icons/react/3x2/KE';
import MA from 'country-flag-icons/react/3x2/MA';
import MX from 'country-flag-icons/react/3x2/MX';
import MY from 'country-flag-icons/react/3x2/MY';
import NG from 'country-flag-icons/react/3x2/NG';
import NL from 'country-flag-icons/react/3x2/NL';
import NZ from 'country-flag-icons/react/3x2/NZ';
import PH from 'country-flag-icons/react/3x2/PH';
import PK from 'country-flag-icons/react/3x2/PK';
import PT from 'country-flag-icons/react/3x2/PT';
import RW from 'country-flag-icons/react/3x2/RW';
import SA from 'country-flag-icons/react/3x2/SA';
import SE from 'country-flag-icons/react/3x2/SE';
import SG from 'country-flag-icons/react/3x2/SG';
import TZ from 'country-flag-icons/react/3x2/TZ';
import UG from 'country-flag-icons/react/3x2/UG';
import US from 'country-flag-icons/react/3x2/US';
import ZA from 'country-flag-icons/react/3x2/ZA';

/** SVG flags for the supported countries (imported one by one to keep the bundle small) */
const FLAGS: Record<string, FlagComponent> = { EU, AE, AU, BR, CA, CH, CN, DE, EG, ES, ET, FR, GB, GH, ID, IE, IN, IT, JP, KE, MA, MX, MY, NG, NL, NZ, PH, PK, PT, RW, SA, SE, SG, TZ, UG, US, ZA };

/** Small rounded flag; a globe for "Other" / unknown codes. */
export function Flag({ code, className = 'h-[14px] w-[21px]' }: { code: string; className?: string }) {
  const F = FLAGS[code];
  if (!F) return <Globe2 className="size-[16px] shrink-0 text-muted" aria-hidden="true" />;
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/.08)] ${className}`} aria-hidden="true">
      <F className="h-full w-full" />
    </span>
  );
}

/** Flag + country name, for dropdown options and the selected value. */
export function CountryLabel({ code, name }: { code: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Flag code={code} />
      {name}
    </span>
  );
}

/** Which flag represents a currency: USD → US, EUR → EU, GBP → GB, otherwise the first country using it. */
const CURRENCY_FLAG: Record<string, string> = {
  ...Object.fromEntries([...COUNTRIES].reverse().map((c) => [c.currency, c.code])),
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
};

/** Flag + currency code, for currency dropdowns. */
export function CurrencyLabel({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Flag code={CURRENCY_FLAG[code] ?? ''} />
      {code}
    </span>
  );
}
