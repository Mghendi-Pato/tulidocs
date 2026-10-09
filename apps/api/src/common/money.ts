import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const D = (v: Decimal.Value | { toString(): string } | null | undefined) => new Decimal(v == null ? 0 : v.toString());
export const round2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export { Decimal };

export interface LineInput {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

/**
 * Totals for a document. Line amounts are tax-exclusive.
 * A flat discount comes off the subtotal and reduces each line's taxable base proportionally,
 * so VAT is charged on what the customer actually pays.
 */
export function computeTotals(items: LineInput[], discountInput: string | number = 0) {
  const lines = items.map((it) => {
    const qty = D(it.quantity);
    const price = D(it.unitPrice);
    const rate = D(it.taxRate ?? 0);
    return { qty, price, rate, amount: round2(qty.mul(price)) };
  });
  const subtotal = lines.reduce((s, l) => s.add(l.amount), D(0));
  let discount = round2(D(discountInput));
  if (discount.lt(0)) discount = D(0);
  if (discount.gt(subtotal)) discount = subtotal;
  const factor = subtotal.gt(0) ? D(1).sub(discount.div(subtotal)) : D(1);
  const taxTotal = round2(lines.reduce((s, l) => s.add(l.amount.mul(factor).mul(l.rate).div(100)), D(0)));
  const total = round2(subtotal.sub(discount).add(taxTotal));
  return {
    lines: lines.map((l) => ({ quantity: l.qty, unitPrice: l.price, taxRate: l.rate, amount: l.amount })),
    subtotal: round2(subtotal),
    discount,
    taxTotal,
    total,
  };
}
