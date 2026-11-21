import { DEFAULT_ROLE_TONE, nameInitials, shipRoleTone } from './ship-role-tone';

describe('shipRoleTone', () => {
  it('reprend la couleur du pôle qui correspond au rôle', () => {
    expect(shipRoleTone('Heavy Fighter')).toBe('248 113 113');
    expect(shipRoleTone('Cargo')).toBe('251 146 60');
    expect(shipRoleTone('Minage')).toBe('52 211 153');
    expect(shipRoleTone('Salvage')).toBe('52 211 153');
    expect(shipRoleTone('Exploration')).toBe('34 211 238');
  });

  it('laisse argenté un rôle inconnu ou absent', () => {
    expect(shipRoleTone('Non classé')).toBe(DEFAULT_ROLE_TONE);
    expect(shipRoleTone(null)).toBe(DEFAULT_ROLE_TONE);
  });
});

describe('nameInitials', () => {
  it('donne deux lettres au plus', () => {
    expect(nameInitials('Kralone')).toBe('KR');
    expect(nameInitials('Ice Forge')).toBe('IF');
    expect(nameInitials('')).toBe('?');
  });
});
