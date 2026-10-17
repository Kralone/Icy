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

/** Montant tel qu'on le tape, groupé par milliers à la volée : « 236000 » → « 236 000 ». */
export function groupDigits(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Durée restante d'une raffinerie : de 0 à 100 h, minutes de 0 à 59. */
export interface Duration { hours: number; minutes: number; }
export const MAX_DURATION_HOURS = 100;

export function toDuration(totalMinutes: number): Duration {
  const total = Math.min(MAX_DURATION_HOURS * 60, Math.max(0, Math.round(totalMinutes)));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/**
 * Flèche ±1 sur les heures ou les minutes. Les minutes passent l'heure : 0 − 1 donne 59 et une heure de moins,
 * 59 + 1 donne 0 et une heure de plus. Rien sous 0 h 00, rien au-delà de 100 h 00.
 */
export function stepDuration(duration: Duration, unit: 'hours' | 'minutes', delta: 1 | -1): Duration {
  if (unit === 'hours' && duration.hours + delta < 0) return duration;
  return toDuration(duration.hours * 60 + duration.minutes + delta * (unit === 'hours' ? 60 : 1));
}

/** Valeur tapée dans un des deux champs, ramenée dans ses bornes. */
export function typedDuration(duration: Duration, unit: 'hours' | 'minutes', text: string): Duration {
  const digits = String(text ?? '').replace(/\D/g, '');
  const value = digits ? Number(digits) : 0;
  if (unit === 'minutes') return toDuration(duration.hours * 60 + Math.min(59, value));
  return toDuration(Math.min(MAX_DURATION_HOURS, value) * 60 + duration.minutes);
}

/** Qualité d'un minerai, ramenée entre 0 et 1000 ; vide reste vide. */
export function clampQuality(value: string | number | null | undefined): string {
  const text = String(value ?? '').trim();
  if (text === '' || text === '-') return text === '-' ? '0' : '';
  const number = Math.trunc(Number(text.replace(',', '.')));
  if (Number.isNaN(number)) return '';
  return String(Math.min(1000, Math.max(0, number)));
}
