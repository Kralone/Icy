import { describe, expect, it } from 'vitest';
import { AvailabilityMember, bestSlots, membersBySlot, slotLabel, slotOfDateTime } from './availability';

const member = (username: string, slots: AvailabilityMember['slots']): AvailabilityMember => ({ userId: username, username, slots });

describe('disponibilités', () => {
  it('range une heure de Paris dans le bon créneau', () => {
    expect(slotOfDateTime('2026-11-14T21:00')).toEqual({ day: 6, period: 'EVENING' });
    expect(slotOfDateTime('2026-11-14T09:30')).toEqual({ day: 6, period: 'MORNING' });
    expect(slotOfDateTime('2026-11-14T12:00')).toEqual({ day: 6, period: 'AFTERNOON' });
    expect(slotOfDateTime('2026-11-14T23:15')).toEqual({ day: 6, period: 'NIGHT' });
  });

  it('rattache le petit matin à la nuit de la veille', () => {
    expect(slotOfDateTime('2026-11-16T01:00')).toEqual({ day: 7, period: 'NIGHT' });
    expect(slotOfDateTime('2026-11-16T06:00')).toEqual({ day: 1, period: 'MORNING' });
  });

  it('ignore une date incomplète', () => {
    expect(slotOfDateTime('')).toBeNull();
    expect(slotOfDateTime('2026-11-14')).toBeNull();
    expect(slotOfDateTime(null)).toBeNull();
  });

  it('classe les créneaux par nombre de membres, puis dans l’ordre de la semaine', () => {
    const members = [
      member('a', [{ day: 6, period: 'EVENING' }, { day: 5, period: 'EVENING' }]),
      member('b', [{ day: 6, period: 'EVENING' }, { day: 2, period: 'NIGHT' }]),
      member('c', [{ day: 6, period: 'EVENING' }, { day: 5, period: 'EVENING' }])
    ];
    expect(bestSlots(members, 2)).toEqual([
      { day: 6, period: 'EVENING', count: 3 },
      { day: 5, period: 'EVENING', count: 2 }
    ]);
    expect(membersBySlot(members).get('2-NIGHT')?.map(m => m.username)).toEqual(['b']);
    expect(slotLabel(6, 'EVENING')).toBe('Samedi soir');
  });
});
