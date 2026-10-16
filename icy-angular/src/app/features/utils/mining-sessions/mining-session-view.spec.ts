import { SessionSheet, UserRef } from '../../../core/services/mining/mining-session.service';
import { mySituation, progress } from './mining-session-view';
import { parseAmount, parseScu } from './session-input';

const kralone: UserRef = { id: 'k', username: 'Kralone', avatarUrl: null };
const vexa: UserRef = { id: 'v', username: 'Vexa', avatarUrl: null };
const torin: UserRef = { id: 't', username: 'Torin', avatarUrl: null };
const NOW = new Date('2026-10-22T22:00:00').getTime();

function sheet(overrides: Partial<SessionSheet> = {}): SessionSheet {
  return {
    id: 's', name: 'Quanta du jeudi', sessionDate: '2026-10-22', status: 'ACTIVE', phase: 'MINING', revision: 1, organizer: kralone,
    operationEventId: null, operationTitle: null,
    permissions: { currentUserId: 't', organizer: false, participant: true, canEdit: true },
    participants: [kralone, vexa, torin].map(user => ({ user, sharesCenti: 100, joinedAt: '2026-10-22T19:00:00', seller: false })),
    expenses: [], orders: [], sales: [], stock: [], remaining: [],
    share: { source: 'NONE', totalSales: 0, totalExpenses: 8_400, net: -8_400, totalSharesCenti: 300,
      rows: [kralone, vexa, torin].map(user => ({ user, sharesCenti: 100, share: 0, advanced: user === torin ? 8_400 : 0, cashed: 0, balance: 0, gap: 0 })),
      transfers: [], settlement: null },
    history: [], cancelledSettlements: [], lastOrderFinishesAt: null, serverTime: '2026-10-22T22:00:00',
    ...overrides
  };
}

describe('Ma situation', () => {
  it('ne montre aucun faux déficit avant la première vente', () => {
    const situation = mySituation(sheet());
    expect(situation?.kind).toBe('waiting');
    expect(situation?.amount).toBe('8 400');
    expect(situation?.what).toContain('remboursés');
  });

  it('indique à qui verser une fois les ventes enregistrées', () => {
    const situation = mySituation(sheet({
      share: { source: 'PREVIEW', totalSales: 100_000, totalExpenses: 0, net: 100_000, totalSharesCenti: 300,
        rows: [{ user: torin, sharesCenti: 100, share: 33_333, advanced: 0, cashed: 100_000, balance: 33_333, gap: -66_667 }],
        transfers: [{ id: null, from: torin, to: vexa, amount: 33_334, receivedAt: null, receivedBy: null }, { id: null, from: torin, to: kralone, amount: 33_333, receivedAt: null, receivedBy: null }],
        settlement: null }
    }));
    expect(situation?.amountTone).toBe('out');
    expect(situation?.what).toBe('Je verse à Vexa et Kralone.');
  });

  it('ne présente pas un versement confirmé comme une dette une fois la fiche terminée', () => {
    const situation = mySituation(sheet({
      status: 'CLOSED', phase: 'DONE',
      share: { source: 'SETTLEMENT', totalSales: 100_000, totalExpenses: 0, net: 100_000, totalSharesCenti: 300,
        rows: [{ user: torin, sharesCenti: 100, share: 33_333, advanced: 0, cashed: 0, balance: 33_333, gap: 33_333 }],
        transfers: [{ id: 'x', from: kralone, to: torin, amount: 33_333, receivedAt: '2026-10-23T00:12:00', receivedBy: torin }],
        settlement: { id: 'r', createdAt: '2026-10-22T23:55:00', createdBy: kralone, closedAt: '2026-10-23T00:12:00', closeKind: 'NORMAL', closeReason: null } }
    }));
    expect(situation?.tag).toBe('Soldé');
    expect(situation?.unit).toBe('aUEC reçus');
    expect(situation?.amountTone).toBe('neutral');
  });

  it('signale un versement non confirmé après une clôture forcée', () => {
    const situation = mySituation(sheet({
      status: 'CLOSED', phase: 'DONE',
      share: { source: 'SETTLEMENT', totalSales: 100_000, totalExpenses: 0, net: 100_000, totalSharesCenti: 300,
        rows: [{ user: torin, sharesCenti: 100, share: 33_333, advanced: 0, cashed: 0, balance: 33_333, gap: 33_333 }],
        transfers: [{ id: 'x', from: kralone, to: torin, amount: 33_333, receivedAt: null, receivedBy: null }],
        settlement: { id: 'r', createdAt: '2026-10-22T23:55:00', createdBy: kralone, closedAt: '2026-10-23T10:02:00', closeKind: 'FORCED', closeReason: 'Torin absent' } }
    }));
    expect(situation?.tag).toBe('Clôturée · non confirmé');
    expect(situation?.unit).toBe('aUEC non confirmés');
  });
});

describe('Avancement', () => {
  it('annonce la fin du dernier raffinage', () => {
    const order = (finishesAt: string, launcher: UserRef) => ({
      id: finishesAt, launcher, terminalId: 1, terminalLabel: 'CRU-L1', methodCode: null, methodLabel: null, cost: 0, finishesAt, ready: false,
      recipient: vexa, handedOverAt: null, lines: [], editable: false, canHandOver: false
    });
    const result = progress(sheet({ phase: 'REFINING', orders: [order('2026-10-22T21:05:00', kralone), order('2026-10-22T23:12:00', torin)] }), NOW);
    expect(result.headline).toBe('Dernier raffinage prêt à 23 h 12, dans 1 h 12.');
    expect(result.tasks[0].text).toBe('Kralone : récupérer l’ordre à CRU-L1 et l’apporter à Vexa');
  });

  it('compte les versements confirmés et liste ceux qui restent', () => {
    const result = progress(sheet({
      status: 'SETTLEMENT', phase: 'PAYMENTS',
      share: { source: 'SETTLEMENT', totalSales: 1, totalExpenses: 0, net: 1, totalSharesCenti: 300, rows: [], settlement: null,
        transfers: [{ id: 'a', from: kralone, to: vexa, amount: 10, receivedAt: '2026-10-23T00:00:00', receivedBy: vexa }, { id: 'b', from: kralone, to: torin, amount: 20, receivedAt: null, receivedBy: null }] }
    }), NOW);
    expect(result.headline).toBe('1 versement confirmé sur 2.');
    expect(result.tasks).toEqual([{ text: 'Torin : confirmer la réception de 20 aUEC versés par Kralone', userId: 't', later: false }]);
  });
});

describe('Saisie', () => {
  it('lit les SCU à la française', () => {
    expect(parseScu('14,8')).toBe(1480);
    expect(parseScu('0,05')).toBe(5);
    expect(parseScu('1,234')).toBeNull();
    expect(parseScu('0')).toBeNull();
  });

  it('lit les montants avec espaces', () => {
    expect(parseAmount('1 250 000')).toBe(1_250_000);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('12a')).toBeNull();
  });
});
