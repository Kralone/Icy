import { BankBalancePoint, BankMonthPoint } from '../../core/services/bank/guild-bank.service';

/** Montant saisi : « 1 500 000 », « 1,5M », « 250k ». null si la saisie n'est pas un montant. */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  const text = raw.replace(/[\s  _]/g, '').replace(/auec$/i, '').toLowerCase();
  const match = /^(-?)(\d+(?:[.,]\d+)?)([km]?)$/.exec(text);
  if (!match) return null;
  const value = Number(match[2].replace(',', '.')) * (match[3] === 'm' ? 1_000_000 : match[3] === 'k' ? 1_000 : 1);
  const rounded = Math.round(value);
  return match[1] ? -rounded : rounded;
}

/** 1 250 000 → « 1,25 M » ; utilisé là où la place manque (axes, cartes). */
export function compactAuec(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)} Md`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} M`;
  if (abs >= 10_000) return `${sign}${trim(abs / 1_000)} k`;
  return `${sign}${new Intl.NumberFormat('fr-FR').format(abs).replace(/[\u00a0\u202f]/g, ' ')}`;
}

function trim(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2 });
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-11 » → « nov. » (et l'année en janvier, pour se repérer). */
export function monthLabel(month: string): string {
  const [, index] = month.split('-').map(Number);
  const label = MONTHS_SHORT[(index || 1) - 1];
  return label;
}

export function dayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface CurvePoint { x: number; y: number; date: string; balance: number; }
export interface BalanceChart { points: CurvePoint[]; line: string; area: string; zeroY: number; min: number; max: number; ticks: { y: number; value: number }[]; }

/**
 * Courbe du solde dans un repère 0–1000 × 0–100 (le SVG s'étire, les traits gardent leur épaisseur).
 * Le solde ne bouge qu'aux jours de mouvement : la courbe est en marches, prolongée jusqu'à aujourd'hui.
 */
export function balanceChart(curve: BankBalancePoint[], today: string): BalanceChart | null {
  if (!curve.length) return null;
  const series = [...curve];
  if (series[series.length - 1].date < today) series.push({ date: today, balance: series[series.length - 1].balance });
  if (series.length === 1) series.unshift({ date: shiftDays(series[0].date, -1), balance: 0 });
  const start = toDays(series[0].date);
  const span = Math.max(1, toDays(series[series.length - 1].date) - start);
  const values = series.map(point => point.balance);
  const min = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const max = rawMax === min ? min + 1 : rawMax + (rawMax - min) * 0.08;
  const y = (value: number) => 4 + (1 - (value - min) / (max - min)) * 92;
  const points = series.map(point => ({ x: ((toDays(point.date) - start) / span) * 1000, y: y(point.balance), date: point.date, balance: point.balance }));
  let line = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 1; i < points.length; i++) line += ` H${round(points[i].x)} V${round(points[i].y)}`;
  const zeroY = y(0);
  const area = `${line} V${round(zeroY)} H${round(points[0].x)} Z`;
  const ticks = [0, 0.5, 1].map(ratio => min + (rawMax - min) * ratio).filter((value, index, all) => all.indexOf(value) === index)
    .map(value => ({ y: y(value), value }));
  return { points, line, area, zeroY, min, max, ticks };
}

/** Point le plus proche d'une abscisse (0–1000) : celui que le survol affiche. */
export function nearestPoint(points: CurvePoint[], x: number): CurvePoint | null {
  let best: CurvePoint | null = null;
  for (const point of points) if (!best || Math.abs(point.x - x) < Math.abs(best.x - x)) best = point;
  return best;
}

/** Variation du solde sur les derniers jours : solde actuel moins solde d'il y a `days` jours. */
export function variation(curve: BankBalancePoint[], today: string, days: number): number {
  if (!curve.length) return 0;
  const since = shiftDays(today, -days);
  const before = [...curve].reverse().find(point => point.date <= since);
  return curve[curve.length - 1].balance - (before?.balance ?? 0);
}

export interface MonthBar { month: string; label: string; inflow: number; outflow: number; inHeight: number; outHeight: number; balance: number; }

/** Barres mensuelles opposées : entrées au-dessus de l'axe, sorties en dessous, à la même échelle. */
export function monthBars(months: BankMonthPoint[]): MonthBar[] {
  const flows = months.map(month => ({
    month,
    inflow: month.deposits + month.adjustmentsIn,
    outflow: month.expenses + month.payouts + month.adjustmentsOut
  }));
  const peak = Math.max(1, ...flows.map(flow => Math.max(flow.inflow, flow.outflow)));
  return flows.map(({ month, inflow, outflow }) => ({
    month: month.month, label: monthLabel(month.month), inflow, outflow,
    inHeight: inflow ? Math.max(2, (inflow / peak) * 100) : 0,
    outHeight: outflow ? Math.max(2, (outflow / peak) * 100) : 0,
    balance: month.balance
  }));
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toDays(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

function shiftDays(date: string, days: number): string {
  const shifted = new Date((toDays(date) + days) * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
