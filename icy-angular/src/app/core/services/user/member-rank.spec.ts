import { describe, expect, it } from 'vitest';
import { hasRole, memberRank } from './member-rank';

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
});
