'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatMoney, lineTotals, money2 } from '@/lib/format';
import type { Item } from '@/lib/types';
import { IconButton } from '../ui/button';
import { Input, MoneyInput } from '../ui/field';

export const emptyItem = (taxRate = '0'): Item => ({ description: '', quantity: '1', unitPrice: '', taxRate });

/** Line items with live amounts and totals (the server recalculates on save). */
export function ItemsEditor({
  items,
  discount,
  currency,
  defaultTaxRate,
  taxName = 'Tax',
  onItems,
  onDiscount,
}: {
  items: Item[];
  discount: string;
  currency: string;
  defaultTaxRate: string;
  taxName?: string;
  onItems: (items: Item[]) => void;
  onDiscount: (d: string) => void;
}) {
  const t = lineTotals(items, discount);
  const set = (i: number, patch: Partial<Item>) => onItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onItems(items.length > 1 ? items.filter((_, j) => j !== i) : [emptyItem(defaultTaxRate)]);

  return (
    <div>
      <div className="hidden grid-cols-[1fr_72px_120px_72px_40px] gap-2 px-1 pb-2 text-[12px] font-bold text-muted sm:grid">
        <span>
          Description
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        </span>
        <span>Qty</span>
        <span>Price</span>
        <span className="truncate">{taxName.length > 6 ? 'Tax' : taxName} %</span>
        <span />
      </div>
      <ul className="space-y-3 sm:space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-xl border border-line p-3 sm:border-0 sm:p-0">
            <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_72px_120px_72px_40px]">
              <Input
                aria-label={`Item ${i + 1} description`}
                placeholder="What did you sell?"
                value={it.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className="h-11 col-span-1"
              />
              <IconButton label="Remove item" onClick={() => remove(i)} className="sm:order-last">
                <Trash2 className="size-[18px] text-muted" />
              </IconButton>
              <div className="col-span-2 grid grid-cols-3 gap-2 sm:contents">
                <label className="min-w-0 sm:contents">
                  <span className="mb-1 block px-1 text-[11.5px] font-bold text-muted sm:hidden">Qty</span>
                  <Input aria-label="Quantity" inputMode="decimal" value={it.quantity} onChange={(e) => set(i, { quantity: e.target.value })} className="h-11 tabular" placeholder="Qty" />
                </label>
                <label className="min-w-0 sm:contents">
                  <span className="mb-1 block px-1 text-[11.5px] font-bold text-muted sm:hidden">Price</span>
                  <MoneyInput aria-label="Unit price" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} className="h-11" placeholder="0.00" />
                </label>
                <label className="min-w-0 sm:contents">
                  <span className="mb-1 block truncate px-1 text-[11.5px] font-bold text-muted sm:hidden">{taxName.length > 6 ? 'Tax' : taxName} %</span>
                  <Input aria-label="Tax rate" inputMode="decimal" value={it.taxRate} onChange={(e) => set(i, { taxRate: e.target.value })} className="h-11 tabular" placeholder="0" />
                </label>
              </div>
            </div>
            <div className="mt-1.5 px-1 text-right text-[12.5px] text-muted sm:hidden">
              Amount <span className="font-bold text-ink tabular">{formatMoney(money2(t.amounts[i] ?? 0), currency, { decimals: true })}</span>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onItems([...items, emptyItem(defaultTaxRate)])} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary-soft">
        <Plus className="size-4" strokeWidth={2.5} /> Add item
      </button>

      <dl className="mt-4 ml-auto max-w-[320px] space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-semibold tabular">{formatMoney(money2(t.subtotal), currency, { decimals: true })}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Discount</dt>
          <dd className="w-36">
            <MoneyInput aria-label="Discount" value={discount} onChange={(e) => onDiscount(e.target.value)} className="h-10 text-right" placeholder="0.00" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{taxName}</dt>
          <dd className="font-semibold tabular">{formatMoney(money2(t.tax), currency, { decimals: true })}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <dt className="font-extrabold">Total</dt>
          <dd className="font-extrabold tabular">{formatMoney(money2(t.total), currency, { decimals: true })}</dd>
        </div>
      </dl>
    </div>
  );
}
