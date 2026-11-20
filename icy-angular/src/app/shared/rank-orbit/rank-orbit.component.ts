import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  QueryList,
  ViewChildren,
  computed,
  inject,
  input
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Nombre d'anneaux affichés pour chaque grade. */
const RANK_LEVELS: Record<string, number> = {
  JUNIOR: 1,
  ASSOCIE: 2,
  INGENIEUR: 3,
  SPECIALISTE: 4,
  OFFICIER: 5,
  ADMIN: 6
};

const RANK_ALIASES: Record<string, string> = {
  USER: 'JUNIOR',
  MEMBRE: 'JUNIOR',
  RECRUE: 'JUNIOR',
  DIRECTEUR: 'ADMIN'
};

/**
 * Durées calées sur une boucle de 30 s : chaque satellite fait un nombre entier de tours,
 * une onde part toutes les 1,875 s. Les GIF de grade reprennent ces mêmes valeurs.
 */
const LOOP_SECONDS = 30;
const SATELLITE_PERIODS = [5, 6, 7.5, 10, 15, 30];
const SATELLITE_PHASES = [0.12, 0.61, 0.33, 0.86, 0.47, 0.02];
const WAVE_SECONDS = 3.75;
const WAVE_COUNT = 2;
const WAVE_FROM = 16;
const WAVE_TO = 100;

const RING_INNER = 58;
const RING_OUTER = 99;
const RING_FLATTEN = 0.42;
/** Inclinaison du plan des anneaux, en degrés. */
const TILT = -14;
/** Rayon de l'avatar dans la vue de 200 unités. */
const AVATAR_RADIUS = 46;
/** Rayon du cœur lumineux devant lequel passent les anneaux. */
const CORE_RADIUS = 18;

interface Ring {
  rx: number;
  ry: number;
  opacity: number;
  period: number;
  phase: number;
  /** Instant où l'onde atteint l'anneau, dans la période des ondes. */
  reach: number;
}

interface RingParts {
  ring: Ring;
  satellites: SVGGElement[];
  outlines: SVGEllipseElement[];
}

/** Une seule boucle d'animation pour toutes les icônes de grade de la page. */
@Injectable({ providedIn: 'root' })
export class RankOrbitTicker {
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly clients = new Set<RankOrbitComponent>();
  private frame: number | null = null;
  private readonly reducedMotion =
    this.isBrowser && typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  get motionReduced(): boolean {
    return this.reducedMotion?.matches ?? false;
  }

  register(client: RankOrbitComponent): void {
    if (!this.isBrowser) {
      return;
    }
    this.clients.add(client);
    client.render(this.now());
    if (!this.motionReduced && this.frame === null) {
      this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(this.tick)));
    }
  }

  unregister(client: RankOrbitComponent): void {
    this.clients.delete(client);
    if (this.clients.size === 0 && this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private now(): number {
    return this.isBrowser ? performance.now() / 1000 : 0;
  }

  private readonly tick = () => {
    const seconds = this.now();
    this.clients.forEach((client) => client.render(seconds));
    this.frame = this.clients.size > 0 ? requestAnimationFrame(this.tick) : null;
  };
}

let nextId = 0;

/**
 * Icône de grade : un anneau incliné par grade, chacun avec un satellite, autour d'un cœur
 * lumineux qui envoie des ondes. Chaque onde allume les anneaux qu'elle traverse.
 * En mode « avatar », le contenu projeté (photo ou initiales) remplace le cœur.
 * La couleur vient du grade ; tout reste dans la boîte du composant.
 */
@Component({
  selector: 'app-rank-orbit',
  standalone: true,
  templateUrl: './rank-orbit.component.html',
  styleUrl: './rank-orbit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-rank]': 'rankKey()',
    '[attr.title]': 'label() || null',
    '[class.is-avatar]': "mode() === 'avatar'"
  }
})
export class RankOrbitComponent implements AfterViewInit, OnDestroy {
  readonly rank = input<string | null | undefined>('JUNIOR');
  /** « emblem » : cœur lumineux au centre. « avatar » : le contenu projeté au centre. */
  readonly mode = input<'emblem' | 'avatar'>('emblem');
  /** Texte d'info-bulle, par exemple le nom du grade. */
  readonly label = input<string | null>(null);

  @ViewChildren('satellite') private satelliteRefs!: QueryList<ElementRef<SVGGElement>>;
  @ViewChildren('outline') private outlineRefs!: QueryList<ElementRef<SVGEllipseElement>>;
  @ViewChildren('wave') private waveRefs!: QueryList<ElementRef<SVGEllipseElement>>;
  @ViewChildren('core') private coreRefs!: QueryList<ElementRef<SVGGElement>>;

  private readonly ticker = inject(RankOrbitTicker);
  private parts: RingParts[] = [];

  readonly uid = `rank-orbit-${nextId++}`;
  readonly tilt = TILT;
  readonly avatarRadius = AVATAR_RADIUS;
  readonly coreRadius = CORE_RADIUS;
  readonly waves = Array.from({ length: WAVE_COUNT }, (_, i) => i);

  readonly rankKey = computed(() => {
    const raw = (this.rank() ?? 'JUNIOR').toUpperCase();
    const key = RANK_ALIASES[raw] ?? raw;
    return RANK_LEVELS[key] ? key : 'JUNIOR';
  });

  readonly rings = computed<Ring[]>(() => {
    const level = RANK_LEVELS[this.rankKey()];
    const flashPeriod = WAVE_SECONDS / WAVE_COUNT;
    return Array.from({ length: level }, (_, i) => {
      const rx = RING_INNER + ((RING_OUTER - RING_INNER) * (i + 0.5)) / 6;
      return {
        rx,
        ry: rx * RING_FLATTEN,
        opacity: 0.72 - 0.05 * (i + 1),
        period: SATELLITE_PERIODS[i],
        phase: SATELLITE_PHASES[i],
        reach: (((rx - WAVE_FROM) / (WAVE_TO - WAVE_FROM)) * WAVE_SECONDS) % flashPeriod
      };
    });
  });

  /** Deux calques : l'arrière (sous l'avatar ou le cœur) et l'avant, visible seulement devant. */
  readonly layers = ['back', 'front'] as const;

  ngAfterViewInit(): void {
    this.collectParts();
    this.satelliteRefs.changes.subscribe(() => this.collectParts());
    this.ticker.register(this);
  }

  ngOnDestroy(): void {
    this.ticker.unregister(this);
  }

  /**
   * Met l'icône à l'instant donné : satellites sur leurs ellipses (plus gros et plus clairs
   * devant), ondes qui s'élargissent, cœur qui pulse, anneaux qui s'allument au passage d'une onde.
   */
  render(seconds: number): void {
    const t = this.ticker.motionReduced ? 0 : seconds % LOOP_SECONDS;
    const flashPeriod = WAVE_SECONDS / WAVE_COUNT;

    for (const { ring, satellites, outlines } of this.parts) {
      const angle = -2 * Math.PI * ((t / ring.period + ring.phase) % 1);
      const depth = (Math.sin(angle) + 1) / 2;
      const transform = `translate(${(ring.rx * Math.cos(angle)).toFixed(2)} ${(ring.ry * Math.sin(angle)).toFixed(2)}) scale(${(2.2 + 3 * depth).toFixed(3)})`;
      const opacity = (0.28 + 0.72 * depth).toFixed(3);
      for (const element of satellites) {
        element.setAttribute('transform', transform);
        element.setAttribute('opacity', opacity);
      }

      const sinceWave = (((t - ring.reach) % flashPeriod) + flashPeriod) % flashPeriod / flashPeriod;
      const width = sinceWave < 0.08 ? 2 + 2.2 * (sinceWave / 0.08) : sinceWave < 0.3 ? 4.2 - 2.2 * ((sinceWave - 0.08) / 0.22) : 2;
      for (const outline of outlines) {
        outline.setAttribute('stroke-width', width.toFixed(2));
      }
    }

    this.waveRefs?.forEach((ref, i) => {
      const progress = ((t + (i * WAVE_SECONDS) / WAVE_COUNT) / WAVE_SECONDS) % 1;
      const rx = WAVE_FROM + (WAVE_TO - WAVE_FROM) * progress;
      const opacity = progress < 0.7 ? 0.85 - 0.34 * (progress / 0.7) : 0.51 * (1 - (progress - 0.7) / 0.3);
      const wave = ref.nativeElement;
      wave.setAttribute('rx', rx.toFixed(2));
      wave.setAttribute('ry', (rx * RING_FLATTEN).toFixed(2));
      wave.setAttribute('stroke-opacity', opacity.toFixed(3));
      wave.setAttribute('stroke-width', (3.2 - 2.6 * progress).toFixed(2));
    });

    const beat = (t / flashPeriod) % 1;
    const scale = 0.9 + 0.16 * ((1 - Math.cos(2 * Math.PI * beat)) / 2);
    this.coreRefs?.forEach((ref) => ref.nativeElement.setAttribute('transform', `scale(${scale.toFixed(3)})`));
  }

  private collectParts(): void {
    const satellites = this.satelliteRefs.map((ref) => ref.nativeElement);
    const outlines = this.outlineRefs.map((ref) => ref.nativeElement);
    const byRing = <T extends Element>(elements: T[], i: number) =>
      elements.filter((element) => element.getAttribute('data-ring') === String(i));
    this.parts = this.rings().map((ring, i) => ({
      ring,
      satellites: byRing(satellites, i),
      outlines: byRing(outlines, i)
    }));
  }
}
