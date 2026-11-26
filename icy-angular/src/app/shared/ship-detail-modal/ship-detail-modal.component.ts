import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Caractéristiques lues dans le catalogue ; une valeur absente reste null et n'est pas affichée. */
export interface ShipCatalogStats {
  sizeClass?: number | null; career?: string | null; role?: string | null;
  crewMin?: number | null; crewMax?: number | null; cargoScu?: number | null;
  length?: number | null; width?: number | null; height?: number | null; mass?: number | null;
  scmSpeed?: number | null; maxSpeed?: number | null; boostSpeed?: number | null;
  pitch?: number | null; yaw?: number | null; roll?: number | null;
  hull?: number | null; shield?: number | null; pilotDps?: number | null; missiles?: number | null;
  quantumSpeed?: number | null; quantumRange?: number | null;
  insuranceClaimMinutes?: number | null; insuranceExpediteMinutes?: number | null; insuranceExpediteCost?: number | null;
  description?: string | null;
}

export interface ShipDetail {
  name: string; brand?: string; brandImageUrl?: string; imageUrl?: string; focus?: string;
  crew?: string; cargo?: string; description?: string; owners?: string[]; stats?: ShipCatalogStats | null;
}

interface StatRow { label: string; value: string; }
interface StatGroup { title: string; rows: StatRow[]; }

const number = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const has = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

@Component({selector:'app-ship-detail-modal', standalone:true, imports:[CommonModule], templateUrl:'./ship-detail-modal.component.html', styleUrls:['./ship-detail-modal.component.css']})
export class ShipDetailModalComponent {
  @Input() ship: ShipDetail|null = null;
  @Input() owners: string[] = [];
  @Output() closed = new EventEmitter<void>();

  close(){ this.closed.emit(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.ship) this.close(); }

  /** Rôle affiché sous le nom : carrière et rôle du catalogue, sinon le rôle de la flotte. */
  roleLine(ship: ShipDetail): string {
    const stats = ship.stats;
    const parts = [stats?.career, stats?.role].filter((part): part is string => !!part);
    return parts.length ? [...new Set(parts)].join(' · ') : (ship.focus || '—');
  }

  sizeLabel(ship: ShipDetail): string | null {
    const size = ship.stats?.sizeClass;
    return has(size) ? (size > 6 ? 'Capital' : `Taille ${size}`) : null;
  }

  crew(ship: ShipDetail): string {
    const min = ship.stats?.crewMin, max = ship.stats?.crewMax;
    if (has(min) && has(max)) return min === max ? `${min}` : `${min} à ${max}`;
    if (has(max)) return `${max}`;
    return ship.crew || 'Non renseigné';
  }

  cargo(ship: ShipDetail): string {
    // La soute du catalogue interne passe d'abord : la source externe met 0 pour les vaisseaux à soute minière dédiée.
    if (ship.cargo) return ship.cargo;
    const scu = ship.stats?.cargoScu;
    return has(scu) ? `${number(scu)} SCU` : 'Non renseignée';
  }

  description(ship: ShipDetail): string | undefined {
    return ship.description || ship.stats?.description || undefined;
  }

  groups(ship: ShipDetail): StatGroup[] {
    const s = ship.stats;
    if (!s) return [];
    const row = (label: string, value: number | null | undefined, format: (v: number) => string): StatRow[] =>
      has(value) ? [{ label, value: format(value) }] : [];
    const dims = [s.length, s.width, s.height];
    const groups: StatGroup[] = [
      { title: 'Gabarit', rows: [
        ...(dims.every(has) ? [{ label: 'Dimensions', value: `${dims.map(v => number(v!, 1)).join(' × ')} m` }] : []),
        ...row('Masse', s.mass, v => `${number(v / 1000, 1)} t`),
      ]},
      { title: 'Vol', rows: [
        ...row('Vitesse SCM', s.scmSpeed, v => `${number(v)} m/s`),
        ...row('Vitesse max', s.maxSpeed, v => `${number(v)} m/s`),
        ...row('Boost avant', s.boostSpeed, v => `${number(v)} m/s`),
        ...([s.pitch, s.yaw, s.roll].every(has)
          ? [{ label: 'Tangage, lacet, roulis', value: `${number(s.pitch!)} · ${number(s.yaw!)} · ${number(s.roll!)} °/s` }] : []),
      ]},
      { title: 'Combat', rows: [
        ...row('Coque', s.hull, v => `${number(v)} PV`),
        ...row('Boucliers', s.shield, v => `${number(v)} PV`),
        ...row('DPS pilote', s.pilotDps, v => number(v)),
        ...row('Missiles', s.missiles, v => number(v)),
      ]},
      { title: 'Quantique', rows: [
        ...row('Vitesse', s.quantumSpeed, v => `${number(v / 1000)} km/s`),
        ...row('Portée', s.quantumRange, v => `${number(v / 1e9, 1)} Gm`),
      ]},
      { title: 'Assurance', rows: [
        ...row('Réclamation', s.insuranceClaimMinutes, v => `${number(v, 1)} min`),
        ...row('Réclamation accélérée', s.insuranceExpediteMinutes, v => `${number(v, 1)} min`),
        ...row('Coût accéléré', s.insuranceExpediteCost, v => `${number(v)} aUEC`),
      ]},
    ];
    return groups.filter(group => group.rows.length > 0);
  }
}
