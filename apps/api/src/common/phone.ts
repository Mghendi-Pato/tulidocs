/** Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX (the format Daraja expects). */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  let n = digits;
  if (n.startsWith('0') && n.length === 10) n = `254${n.slice(1)}`;
  else if ((n.startsWith('7') || n.startsWith('1')) && n.length === 9) n = `254${n}`;
  return /^254(7|1)\d{8}$/.test(n) ? n : null;
}
