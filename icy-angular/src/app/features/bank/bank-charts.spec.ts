import { describe, expect, it } from 'vitest';
import { balanceChart, compactAuec, monthBars, nearestPoint, parseAmount, variation } from './bank-charts';

describe('parseAmount', () => {
  it('reads spaced, suffixed and signed amounts', () => {
    expect(parseAmount('1 500 000')).toBe(1_500_000);
    expect(parseAmount('1,5M')).toBe(1_500_000);
    expect(parseAmount('250k')).toBe(250_000);
    expect(parseAmount('-5 000')).toBe(-5_000);
    expect(parseAmount('12 000 aUEC')).toBe(12_000);
  });

  it('refuses what is not an amount', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('beaucoup')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
  });
});

describe('compactAuec', () => {
  it('shortens large amounts', () => {
    expect(compactAuec(1_250_000)).toBe('1,25 M');
    expect(compactAuec(45_000)).toBe('45 k');
    expect(compactAuec(-2_000_000)).toBe('−2 M');
    expect(compactAuec(9_500)).toBe('9 500');
  });
});

describe('balanceChart', () => {
  it('draws steps up to today and keeps zero inside the frame', () => {
    const chart = balanceChart([{ date: '2026-11-01', balance: 100 }, { date: '2026-11-05', balance: -50 }], '2026-11-10')!;

    expect(chart.points).toHaveLength(3);
    expect(chart.points[2]).toMatchObject({ x: 1000, balance: -50, date: '2026-11-10' });
    expect(chart.min).toBe(-50);
    expect(chart.zeroY).toBeGreaterThan(4);
    expect(chart.zeroY).toBeLessThan(96);
    expect(chart.line.startsWith('M0,')).toBe(true);
  });

  it('returns nothing without movements', () => {
    expect(balanceChart([], '2026-11-10')).toBeNull();
  });

  it('finds the hovered point', () => {
    const chart = balanceChart([{ date: '2026-11-01', balance: 100 }, { date: '2026-11-05', balance: 300 }], '2026-11-09')!;
    expect(nearestPoint(chart.points, 480)?.date).toBe('2026-11-05');
  });
});

describe('variation', () => {
  it('compares with the balance at the start of the period', () => {
    const curve = [{ date: '2026-09-01', balance: 100 }, { date: '2026-10-20', balance: 400 }, { date: '2026-11-08', balance: 250 }];
    expect(variation(curve, '2026-11-10', 30)).toBe(150);
    expect(variation(curve, '2026-11-10', 365)).toBe(250);
  });
});

describe('monthBars', () => {
  it('puts inflows and outflows on the same scale', () => {
    const bars = monthBars([
      { month: '2026-10', deposits: 400, expenses: 100, payouts: 100, adjustments: 0, balance: 200 },
      { month: '2026-11', deposits: 0, expenses: 0, payouts: 0, adjustments: -50, balance: 150 }
    ]);
    expect(bars[0]).toMatchObject({ inflow: 400, outflow: 200, inHeight: 100, outHeight: 50, label: 'oct.' });
    expect(bars[1]).toMatchObject({ inflow: 0, outflow: 50, inHeight: 0 });
  });
});
