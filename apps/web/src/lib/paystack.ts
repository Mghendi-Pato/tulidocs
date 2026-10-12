/**
 * Paystack Popup (InlineJS v2): the card form opens in Paystack's secure window over our page,
 * so the customer never leaves tuli. Card details go straight to Paystack — our servers never see them.
 * The server still verifies every payment with Paystack before anything is unlocked.
 */
const SRC = 'https://js.paystack.co/v2/inline.js';

type PopupCallbacks = {
  onSuccess?: (tx: { reference?: string }) => void;
  onCancel?: () => void;
  onError?: (e: { message?: string }) => void;
  onLoad?: () => void;
};
type PaystackPopCtor = new () => { resumeTransaction: (accessCode: string, callbacks?: PopupCallbacks) => void };

let loading: Promise<PaystackPopCtor> | null = null;

function loadPaystack(timeoutMs = 8000): Promise<PaystackPopCtor> {
  const w = window as unknown as { PaystackPop?: PaystackPopCtor };
  if (w.PaystackPop) return Promise.resolve(w.PaystackPop);
  if (loading) return loading;
  loading = new Promise<PaystackPopCtor>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    const timer = setTimeout(() => fail(new Error('Paystack took too long to load')), timeoutMs);
    const fail = (e: Error) => {
      clearTimeout(timer);
      s.remove();
      loading = null;
      reject(e);
    };
    s.onload = () => {
      clearTimeout(timer);
      if (w.PaystackPop) resolve(w.PaystackPop);
      else fail(new Error('Paystack did not load'));
    };
    s.onerror = () => fail(new Error('Paystack could not load'));
    document.head.appendChild(s);
  });
  return loading;
}

/** Warm the script up (e.g. when the pay dialog opens) so the popup appears instantly on "Pay". */
export function preloadPaystack() {
  if (typeof window !== 'undefined') loadPaystack().catch(() => undefined);
}

/**
 * Opens the popup for a transaction the server already initialised.
 * Resolves 'success' | 'cancelled'; rejects if the popup can't be shown (caller falls back to the redirect page).
 */
export async function payWithPopup(accessCode: string): Promise<'success' | 'cancelled'> {
  const PaystackPop = await loadPaystack();
  return new Promise((resolve, reject) => {
    try {
      new PaystackPop().resumeTransaction(accessCode, {
        onSuccess: () => resolve('success'),
        onCancel: () => resolve('cancelled'),
        onError: (e) => reject(new Error(e?.message || 'Paystack could not open')),
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Paystack could not open'));
    }
  });
}
