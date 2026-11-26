import { describe, expect, it } from 'vitest';
import { hasRole, memberRank, isOrganizer, organizes, polesOf, referentPole, withPole } from './member-rank';

describe('memberRank', () => {
  it('ignores the treasurer function, whatever its position', () => {
    expect(memberRank(['TRESORIER', 'ASSOCIE'])).toBe('ASSOCIE');
    expect(memberRank(['ASSOCIE', 'TRESORIER'])).toBe('ASSOCIE');
  });

  it('keeps the highest rank and maps legacy names', () => {
    expect(memberRank(['INGENIEUR', 'OFFICIER'])).toBe('OFFICIER');
    expect(memberRank(['membre'])).toBe('JUNIOR');
    expect(memberRank(['TRESORIER'])).toBe('JUNIOR');
    expect(memberRank(null)).toBe('JUNIOR');
  });

  it('finds a role regardless of case', () => {
    expect(hasRole(['tresorier'], 'TRESORIER')).toBe(true);
    expect(hasRole(['ASSOCIE'], 'TRESORIER')).toBe(false);
  });

  it('lets organizers organize everything and a referent only the activities of their pole', () => {
    expect(isOrganizer(['officier'])).toBe(true);
    expect(organizes(['ADMIN'], null, 'MILITAIRE')).toBe(true);
    expect(referentPole(['SPECIALISTE'], 'militaire')).toBe('MILITAIRE');
    expect(organizes(['SPECIALISTE'], 'MILITAIRE')).toBe(true);
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', 'MILITAIRE')).toBe(true);
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', 'INDUSTRIE')).toBe(false);
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', null)).toBe(false);
    // Une activité de plusieurs pôles : le référent l'organise si son pôle en fait partie.
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', ['INDUSTRIE', 'MILITAIRE'])).toBe(true);
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', ['INDUSTRIE', 'LOGISTIQUE'])).toBe(false);
    expect(organizes(['SPECIALISTE'], 'MILITAIRE', [])).toBe(false);
    // Un Spécialiste sans pôle, ou un pôle porté par un autre grade, n'est référent de rien.
    expect(organizes(['SPECIALISTE'], null)).toBe(false);
    expect(referentPole(['INGENIEUR'], 'MILITAIRE')).toBeNull();
  });

  it('reads the poles of an activity in display order, including the former single pole', () => {
    expect(polesOf({ poles: ['industrie', 'LOGISTIQUE', 'INDUSTRIE', 'inconnu'] })).toEqual(['LOGISTIQUE', 'INDUSTRIE']);
    expect(polesOf({ pole: 'MILITAIRE' })).toEqual(['MILITAIRE']);
    expect(polesOf({ poles: [], pole: 'MILITAIRE' })).toEqual([]);
    expect(polesOf(null)).toEqual([]);
    expect(withPole(['INDUSTRIE'], 'MILITAIRE')).toEqual(['MILITAIRE', 'INDUSTRIE']);
    expect(withPole(['MILITAIRE'], 'MILITAIRE')).toEqual(['MILITAIRE']);
    expect(withPole([], '')).toEqual([]);
  });
});
