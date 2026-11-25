import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, inject, input, model, signal } from '@angular/core';
import { Hsv, hexToHsv, hsvToHex, normalizeHex } from './color-math';

let nextId = 0;

/**
 * Sélecteur de couleur : pastille, saisie hexadécimale et panneau avec zone saturation / luminosité,
 * curseur de teinte et nuancier. La valeur émise est toujours au format #rrggbb.
 */
@Component({
  selector: 'app-color-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-field.component.html',
  styleUrl: './color-field.component.css',
})
export class ColorFieldComponent {
  readonly value = model<string>('');
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly presets = input<readonly string[]>([]);
  readonly fallback = input<string>('#27647c');

  readonly fieldId = `color-field-${++nextId}`;
  readonly open = signal(false);
  /** Texte en cours de saisie ; il ne devient la valeur qu'une fois valide. */
  readonly draft = signal('');
  readonly invalid = signal(false);
  private readonly hsv = signal<Hsv>(hexToHsv('#27647c'));

  readonly hex = computed(() => normalizeHex(this.value()) ?? this.fallback());
  readonly hue = computed(() => Math.round(this.hsv().h));
  readonly hueColor = computed(() => hsvToHex({ h: this.hsv().h, s: 1, v: 1 }));
  readonly thumbX = computed(() => this.hsv().s * 100);
  readonly thumbY = computed(() => (1 - this.hsv().v) * 100);
  readonly areaText = computed(() => `Saturation ${Math.round(this.hsv().s * 100)} %, luminosité ${Math.round(this.hsv().v * 100)} %`);

  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    // Suit la valeur reçue du parent, sans écraser la teinte quand la couleur est grise.
    effect(() => {
      const hex = normalizeHex(this.value());
      this.draft.set(hex ?? (this.value() ?? ''));
      this.invalid.set(!!this.value() && !hex);
      if (hex && hex !== hsvToHex(this.hsv())) {
        const next = hexToHsv(hex);
        if (next.s === 0 || next.v === 0) next.h = this.hsv().h;
        this.hsv.set(next);
      }
    });
  }

  toggle(): void { this.open.update(open => !open); }

  onHexInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.draft.set(text);
    const hex = normalizeHex(text);
    this.invalid.set(!hex && text.trim() !== '');
    if (hex) this.value.set(hex);
  }

  commitDraft(): void {
    if (!normalizeHex(this.draft())) {
      this.draft.set(normalizeHex(this.value()) ?? '');
      this.invalid.set(false);
    }
  }

  choose(color: string): void { this.setHsv(hexToHsv(color)); }

  onHue(event: Event): void {
    this.setHsv({ ...this.hsv(), h: Number((event.target as HTMLInputElement).value) });
  }

  onAreaPointerDown(event: PointerEvent): void {
    const area = event.currentTarget as HTMLElement;
    area.setPointerCapture?.(event.pointerId);
    this.pickAt(area, event);
    event.preventDefault();
  }

  onAreaPointerMove(event: PointerEvent): void {
    if (event.buttons !== 1) return;
    this.pickAt(event.currentTarget as HTMLElement, event);
  }

  onAreaKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.1 : 0.02;
    const { s, v } = this.hsv();
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    this.setHsv({ ...this.hsv(), s: clamp(s + move[0]), v: clamp(v + move[1]) });
  }

  isSelected(color: string): boolean { return normalizeHex(color) === normalizeHex(this.value()); }

  @HostListener('document:pointerdown', ['$event'])
  closeOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  close(): void { this.open.set(false); }

  private pickAt(area: HTMLElement, event: PointerEvent): void {
    const box = area.getBoundingClientRect();
    this.setHsv({
      ...this.hsv(),
      s: clamp((event.clientX - box.left) / box.width),
      v: clamp(1 - (event.clientY - box.top) / box.height),
    });
  }

  private setHsv(next: Hsv): void {
    this.hsv.set(next);
    this.value.set(hsvToHex(next));
  }
}

function clamp(n: number): number { return Math.min(1, Math.max(0, n)); }
