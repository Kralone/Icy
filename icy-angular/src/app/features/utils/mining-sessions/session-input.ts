/** Saisie des montants et quantités telle qu'un joueur la tape : espaces, virgule décimale. */

/** « 1 250 000 » → 1250000 ; vide ou invalide → null. */
export function parseAmount(value: string | number | null | undefined): number | null {
  const digits = String(value ?? '').replace(/[\s  .]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/** Montant qui peut valoir 0 (coût d'un ordre). */
export function parseAmountOrZero(value: string | number | null | undefined): number | null {
  if (String(value ?? '').trim() === '') return 0;
  const digits = String(value ?? '').replace(/[\s  .]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

/** « 14,8 » SCU → 1480 cSCU ; au plus deux décimales. */
export function parseScu(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cscu = Math.round(Number(text) * 100);
  return cscu > 0 ? cscu : null;
}

export function scuInput(cscu: number): string {
  return (cscu / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2, useGrouping: false });
}
