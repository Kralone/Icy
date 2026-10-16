import { RefineryOrder, SessionPhase, SessionSheet, Transfer, formatAuec, formatScu } from '../../../core/services/mining/mining-session.service';

/** Étapes affichées en haut de la fiche, dans l'ordre. */
export const STEPS: { phase: SessionPhase; label: string }[] = [
  { phase: 'MINING', label: 'Minage' },
  { phase: 'REFINING', label: 'Raffinage' },
  { phase: 'HANDOVER', label: 'Remise du cargo' },
  { phase: 'SELLING', label: 'Vente' },
  { phase: 'PAYMENTS', label: 'Versements' },
  { phase: 'DONE', label: 'Terminée' }
];

export interface Task { text: string; userId: string | null; later: boolean; }
export interface Progress { headline: string; tasks: Task[]; }

/** Heure au format « 22 h 40 ». */
export function hourLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Durée restante lisible : « 1 h 12 », « 12 min ». */
export function durationLabel(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/**
 * Message principal et tâches de l'étape en cours (docs/mining-v3/SPEC.md, « Déroulé de la fiche »).
 * nowMs : heure courante alignée sur l'horloge du serveur.
 */
export function progress(sheet: SessionSheet, nowMs: number): Progress {
  const tasks: Task[] = [];
  const isReady = (order: RefineryOrder) => new Date(order.finishesAt).getTime() <= nowMs;
  switch (sheet.phase) {
    case 'MINING':
      return {
        headline: 'Session en cours. Déclarez vos frais au fil de l’eau.',
        tasks: [
          { text: 'Chacun : ajouter ses pleins, réparations et achats', userId: null, later: false },
          { text: 'À la raffinerie : créer un ordre à chaque lancement', userId: null, later: true }
        ]
      };
    case 'REFINING': {
      const waiting = sheet.orders.filter(order => !isReady(order));
      const last = waiting.reduce((max, order) => Math.max(max, new Date(order.finishesAt).getTime()), 0);
      for (const order of sheet.orders) {
        if (isReady(order) && !order.handedOverAt) tasks.push(handoverTask(order, false));
        else if (!isReady(order)) tasks.push({ text: `${order.launcher.username} : ordre prêt à ${hourLabel(order.finishesAt)} à ${order.terminalLabel}`, userId: order.launcher.id, later: true });
      }
      if (!waiting.length) return { headline: 'Tous les ordres sont prêts.', tasks };
      return { headline: `Dernier raffinage prêt à ${hourLabel(new Date(last).toISOString())}, dans ${durationLabel(last - nowMs)}.`, tasks };
    }
    case 'HANDOVER': {
      const pending = sheet.orders.filter(order => !order.handedOverAt);
      pending.forEach(order => tasks.push(handoverTask(order, false)));
      sellerTasks(sheet).forEach(task => tasks.push({ ...task, later: true }));
      return { headline: `Tous les ordres sont prêts. ${pending.length} remise${pending.length > 1 ? 's' : ''} de cargo ${pending.length > 1 ? 'restent' : 'reste'} à faire.`, tasks };
    }
    case 'SELLING': {
      const left = sheet.remaining.reduce((sum, item) => sum + item.remainingCscu, 0);
      const organizerTask: Task = { text: `${sheet.organizer.username} : arrêter les comptes une fois tout vendu`, userId: sheet.organizer.id, later: left > 0 };
      if (left <= 0) return { headline: 'Tout est vendu. L’organisateur peut arrêter les comptes.', tasks: [organizerTask] };
      const holders = sheet.stock.filter(stock => stock.lines.some(line => line.inStockCscu > 0)).map(stock => stock.seller.username);
      return { headline: `Reste à vendre : ${formatScu(left)} SCU${holders.length ? `, chez ${joinNames(holders)}` : ''}.`, tasks: [...sellerTasks(sheet), organizerTask] };
    }
    case 'PAYMENTS': {
      const transfers = sheet.share.transfers;
      const done = transfers.filter(transfer => transfer.receivedAt).length;
      transfers.filter(transfer => !transfer.receivedAt).forEach(transfer => tasks.push({
        text: `${transfer.to.username} : confirmer la réception de ${formatAuec(transfer.amount)} aUEC versés par ${transfer.from.username}`,
        userId: transfer.to.id, later: false
      }));
      return { headline: `${done} versement${done > 1 ? 's' : ''} confirmé${done > 1 ? 's' : ''} sur ${transfers.length}.`, tasks };
    }
    case 'DONE': {
      const settlement = sheet.share.settlement;
      const missing = sheet.share.transfers.filter(transfer => !transfer.receivedAt).length;
      if (settlement?.closeKind === 'FORCED') {
        return {
          headline: `Clôturée par l’organisateur avec ${missing} versement${missing > 1 ? 's' : ''} non confirmé${missing > 1 ? 's' : ''}.`,
          tasks: [
            ...(settlement.closeReason ? [{ text: `Motif : « ${settlement.closeReason} »`, userId: null, later: true }] : []),
            { text: 'L’organisateur peut rouvrir la fiche pour enregistrer une confirmation.', userId: null, later: true }
          ]
        };
      }
      return { headline: 'Session terminée : tous les versements ont été reçus.', tasks: [{ text: 'Une erreur ? L’organisateur peut rouvrir la fiche depuis « Gérer la fiche ».', userId: null, later: true }] };
    }
  }
}

function handoverTask(order: RefineryOrder, later: boolean): Task {
  const own = order.launcher.id === order.recipient.id;
  return own
    ? { text: `${order.launcher.username} : récupérer son ordre à ${order.terminalLabel}, puis le marquer récupéré`, userId: order.launcher.id, later }
    : { text: `${order.launcher.username} : récupérer l’ordre à ${order.terminalLabel} et l’apporter à ${order.recipient.username}`, userId: order.launcher.id, later };
}

function sellerTasks(sheet: SessionSheet): Task[] {
  return sheet.stock
    .map(stock => ({ stock, ores: stock.lines.filter(line => line.inStockCscu > 0).map(line => line.commodityName) }))
    .filter(entry => entry.ores.length)
    .map(entry => ({ text: `${entry.stock.seller.username} : vendre ${joinNames(entry.ores)}, puis saisir le montant reçu`, userId: entry.stock.seller.id, later: false }));
}

/** Encart « Ma situation ». */
export interface MySituation {
  kind: 'waiting' | 'balance' | 'done' | 'outside';
  tag: string;
  tagTone: 'prov' | 'fixed';
  amount: string;
  amountTone: 'in' | 'out' | 'neutral';
  unit: string;
  what: string;
  share: number;
  advanced: number;
  cashed: number;
  gap: number;
  sharesCenti: number;
  resultLabel: string;
}

export function mySituation(sheet: SessionSheet): MySituation | null {
  const me = sheet.permissions.currentUserId;
  const row = sheet.share.rows.find(item => item.user.id === me);
  if (!row) return null;
  const base = { share: row.share, advanced: row.advanced, cashed: row.cashed, gap: row.gap, sharesCenti: row.sharesCenti };
  // Avant la première vente, un solde serait un faux déficit : seulement ce qui sera remboursé.
  if (sheet.share.source === 'NONE') {
    return {
      ...base, kind: 'waiting', tag: 'En attente des ventes', tagTone: 'prov', amount: formatAuec(row.advanced), amountTone: 'neutral', unit: 'aUEC avancés',
      what: row.advanced ? 'Ces frais vous seront remboursés avant le partage.' : 'Aucun frais avancé pour l’instant.', resultLabel: ''
    };
  }
  const out = row.gap < 0;
  const mine: Transfer[] = sheet.share.transfers.filter(transfer => (out ? transfer.from.id : transfer.to.id) === me);
  const names = joinNames(mine.map(transfer => out ? transfer.to.username : transfer.from.username));
  if (sheet.status === 'CLOSED') {
    const pending = mine.filter(transfer => !transfer.receivedAt);
    const forced = sheet.share.settlement?.closeKind === 'FORCED' && pending.length > 0;
    return {
      ...base, kind: 'done', tag: forced ? 'Clôturée · non confirmé' : 'Soldé', tagTone: forced ? 'prov' : 'fixed',
      amount: formatAuec(Math.abs(row.gap)), amountTone: 'neutral', unit: row.gap === 0 ? 'aUEC' : forced ? 'aUEC non confirmés' : out ? 'aUEC versés' : 'aUEC reçus',
      what: row.gap === 0 ? 'Rien à verser ni à recevoir.' : forced ? (out ? `Versement à ${names} non confirmé par le receveur.` : `Réception de ${names} non confirmée.`) : (out ? `Versé à ${names}, réception confirmée.` : `Reçu de ${names}.`),
      resultLabel: forced ? 'Non confirmé' : out ? 'Versé' : 'Reçu'
    };
  }
  return {
    ...base, kind: 'balance', tag: sheet.status === 'SETTLEMENT' ? 'Comptes arrêtés' : 'Provisoire', tagTone: sheet.status === 'SETTLEMENT' ? 'fixed' : 'prov',
    amount: row.gap === 0 ? '0' : `${out ? '− ' : '+ '}${formatAuec(Math.abs(row.gap))}`, amountTone: row.gap === 0 ? 'neutral' : out ? 'out' : 'in', unit: 'aUEC',
    what: row.gap === 0 ? 'Rien à verser ni à recevoir.' : out ? `Je verse à ${names}.` : `Je reçois de ${names}.`,
    resultLabel: out ? 'À verser' : 'À recevoir'
  };
}
