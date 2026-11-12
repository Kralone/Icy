/**
 * Disponibilités habituelles des membres, à l'heure de Paris.
 * Quatre créneaux par jour ; la nuit (23h-6h) appartient au jour où elle commence.
 */
export type AvailabilityPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface AvailabilitySlot {
  /** Jour ISO : 1 = lundi, 7 = dimanche. */
  day: number;
  period: AvailabilityPeriod;
}

export interface AvailabilityMember {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  slots: AvailabilitySlot[];
}

export interface AvailabilityDay { day: number; label: string; short: string; }
export interface AvailabilityPeriodInfo { key: AvailabilityPeriod; label: string; hours: string; icon: string; }

export const AVAILABILITY_DAYS: AvailabilityDay[] = [
  { day: 1, label: 'Lundi', short: 'Lun' },
  { day: 2, label: 'Mardi', short: 'Mar' },
  { day: 3, label: 'Mercredi', short: 'Mer' },
  { day: 4, label: 'Jeudi', short: 'Jeu' },
  { day: 5, label: 'Vendredi', short: 'Ven' },
  { day: 6, label: 'Samedi', short: 'Sam' },
  { day: 7, label: 'Dimanche', short: 'Dim' }
];

export const AVAILABILITY_PERIODS: AvailabilityPeriodInfo[] = [
  { key: 'MORNING', label: 'Matin', hours: '6h – 12h', icon: 'sunrise' },
  { key: 'AFTERNOON', label: 'Après-midi', hours: '12h – 18h', icon: 'sun' },
  { key: 'EVENING', label: 'Soir', hours: '18h – 23h', icon: 'sunset' },
  { key: 'NIGHT', label: 'Nuit', hours: '23h – 6h', icon: 'moon' }
];

export function slotKey(day: number, period: AvailabilityPeriod): string {
  return `${day}-${period}`;
}

export function dayLabel(day: number): string {
  return AVAILABILITY_DAYS.find(item => item.day === day)?.label ?? '';
}

export function periodLabel(period: AvailabilityPeriod): string {
  return AVAILABILITY_PERIODS.find(item => item.key === period)?.label ?? '';
}

/** « Samedi soir », « Lundi après-midi ». */
export function slotLabel(day: number, period: AvailabilityPeriod): string {
  return `${dayLabel(day)} ${periodLabel(period).toLowerCase()}`;
}

/** Membres disponibles par case, indexés par slotKey. */
export function membersBySlot(members: AvailabilityMember[]): Map<string, AvailabilityMember[]> {
  const result = new Map<string, AvailabilityMember[]>();
  for (const member of members) {
    for (const slot of member.slots) {
      const key = slotKey(slot.day, slot.period);
      const list = result.get(key);
      if (list) list.push(member); else result.set(key, [member]);
    }
  }
  return result;
}

export interface RankedSlot { day: number; period: AvailabilityPeriod; count: number; }

/** Cases les plus fréquentées, de la meilleure à la moins bonne ; à égalité, l'ordre de la semaine. */
export function bestSlots(members: AvailabilityMember[], limit = 3): RankedSlot[] {
  const counts = membersBySlot(members);
  const ranked: RankedSlot[] = [];
  for (const day of AVAILABILITY_DAYS) {
    for (const period of AVAILABILITY_PERIODS) {
      const count = counts.get(slotKey(day.day, period.key))?.length ?? 0;
      if (count > 0) ranked.push({ day: day.day, period: period.key, count });
    }
  }
  return ranked.sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Case de la grille pour une date saisie « AAAA-MM-JJTHH:mm » (heure de Paris).
 * Avant 6h, l'heure appartient à la nuit de la veille.
 */
export function slotOfDateTime(value: string | null | undefined): AvailabilitySlot | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const [, year, month, date, hourText] = match;
  const hour = Number(hourText);
  const day = new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
  if (Number.isNaN(day.getTime()) || hour > 23) return null;
  if (hour < 6) day.setUTCDate(day.getUTCDate() - 1);
  const iso = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  const period: AvailabilityPeriod = hour < 6 || hour >= 23 ? 'NIGHT' : hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EVENING';
  return { day: iso, period };
}
