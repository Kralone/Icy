import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchOption<T> { value: T; label: string; detail?: string | null; }

let nextId = 0;

/** Liste longue avec recherche : on tape quelques lettres, flèches et Entrée pour choisir. */
@Component({
  selector: 'app-search-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
  host: { '(document:click)': 'outside($event)' },
  template: `
    <input type="text" role="combobox" autocomplete="off" [id]="inputId()" [attr.aria-label]="ariaLabel()" [placeholder]="placeholder()" [value]="text()" [disabled]="disabled()"
      [attr.aria-expanded]="open()" [attr.aria-controls]="listId" [attr.aria-activedescendant]="open() && matches().length ? listId + '-' + active() : null"
      (focus)="show()" (click)="show()" (input)="search($any($event.target).value)" (keydown)="key($event)" (blur)="touched()">
    @if (open()) {
      <ul class="list" role="listbox" [id]="listId">
        @for (option of matches(); track $index; let i = $index) {
          <li role="option" [id]="listId + '-' + i" [attr.aria-selected]="option.value === value()" [class.active]="i === active()"
            (mousedown)="$event.preventDefault()" (click)="pick(option)" (mouseenter)="active.set(i)">
            <span>{{ option.label }}</span>@if (option.detail) { <small>{{ option.detail }}</small> }
          </li>
        } @empty { <li class="none">Aucun résultat</li> }
      </ul>
    }
  `,
  styles: [`
    :host { position: relative; display: block; }
    input { width: 100%; padding: .55rem .65rem; border: 1px solid var(--line-strong, #36546a); border-radius: .4rem; color: var(--fg, #e2e8f0); background: var(--field, #122235); font: inherit; }
    input::placeholder { color: var(--muted, #94a3b8); opacity: .65; }
    input:disabled { opacity: .55; }
    /* Dans le flux : une fenêtre qui défile ne coupe pas la liste. */
    .list { max-height: 15rem; overflow: auto; margin: .25rem 0 0; padding: .25rem; list-style: none;
      border: 1px solid var(--line-strong, #36546a); border-radius: .5rem; background: #0b1525; box-shadow: 0 12px 28px rgba(2, 8, 23, .65); }
    li { display: flex; justify-content: space-between; gap: .8rem; padding: .45rem .55rem; border-radius: .35rem; color: var(--fg, #e2e8f0); cursor: pointer; }
    li small { color: var(--muted, #94a3b8); white-space: nowrap; }
    li.active { background: #16324a; }
    li[aria-selected="true"] span { color: var(--cyan, #67e8f9); font-weight: 600; }
    li.none { color: var(--muted, #94a3b8); cursor: default; }
  `]
})
export class SearchSelectComponent<T> implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly options = input.required<SearchOption<T>[]>();
  readonly placeholder = input('Rechercher');
  readonly inputId = input<string | null>(null);
  /** Nom du champ pour les lecteurs d'écran quand aucun label ne lui est lié. */
  readonly ariaLabel = input<string | null>(null);
  /** Ajout successif (participants) : le champ se vide après chaque choix. */
  readonly clearOnPick = input(false);
  readonly listId = `search-select-${++nextId}`;

  readonly value = signal<T | null>(null);
  readonly query = signal<string | null>(null);
  readonly open = signal(false);
  readonly active = signal(0);
  readonly disabled = signal(false);

  readonly text = computed(() => this.query() ?? this.options().find(option => option.value === this.value())?.label ?? '');
  readonly matches = computed(() => {
    const words = normalize(this.query() ?? '').split(/\s+/).filter(Boolean);
    return this.options().filter(option => {
      const haystack = normalize(`${option.label} ${option.detail ?? ''}`);
      return words.every(word => haystack.includes(word));
    }).slice(0, 60);
  });

  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: T | null): void { this.value.set(value); this.query.set(null); }
  registerOnChange(fn: (value: T | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  show(): void {
    if (this.disabled()) return;
    const index = this.matches().findIndex(option => option.value === this.value());
    this.active.set(Math.max(0, index));
    this.open.set(true);
  }

  search(text: string): void {
    this.query.set(text);
    this.active.set(0);
    this.open.set(true);
  }

  pick(option: SearchOption<T>): void {
    this.onChange(option.value);
    if (this.clearOnPick()) {
      this.value.set(null);
      this.query.set('');
      this.active.set(0);
      return;
    }
    this.value.set(option.value);
    this.query.set(null);
    this.open.set(false);
  }

  key(event: KeyboardEvent): void {
    const count = this.matches().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) { this.show(); return; }
      if (count) this.active.set((this.active() + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const option = this.matches()[this.active()];
      if (option) this.pick(option);
    } else if (event.key === 'Escape' && this.open()) {
      event.stopPropagation();
      this.close();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }

  touched(): void { this.onTouched(); }

  outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  /** Fermer sans choisir : le texte revient à la valeur retenue. */
  private close(): void {
    this.open.set(false);
    this.query.set(null);
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
