import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';

let nextId = 0;

/** « ? » cerclé : l'explication s'ouvre au survol, au focus ou au toucher. */
@Component({
  selector: 'app-hint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(mouseenter)': 'show()', '(mouseleave)': 'open.set(false)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="hint" [attr.aria-label]="'Aide : ' + label()" [attr.aria-describedby]="open() ? id : null"
      [attr.aria-expanded]="open()" (click)="show(); $event.stopPropagation(); $event.preventDefault()" (focus)="show()" (blur)="open.set(false)">?</button>
    @if (open()) { <span class="bubble" [attr.data-side]="side()" role="tooltip" [id]="id">{{ text() }}</span> }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; vertical-align: middle; margin-left: .3rem; text-transform: none; letter-spacing: normal; }
    .hint { display: inline-grid; place-items: center; width: 1.05rem; height: 1.05rem; padding: 0; border: 1px solid #5b7890; border-radius: 50%;
      color: #a9bfd0; background: transparent; font: 700 .68rem/1 system-ui, sans-serif; cursor: help; }
    .hint:hover, .hint[aria-expanded="true"] { border-color: #67e8f9; color: #67e8f9; }
    .hint:focus-visible { outline: 2px solid #72ddf7; outline-offset: 2px; }
    .bubble { position: absolute; z-index: 60; left: 50%; bottom: calc(100% + .45rem); width: max-content; max-width: min(18rem, 80vw); transform: translateX(-50%);
      padding: .5rem .65rem; border: 1px solid #36546a; border-radius: .5rem; color: #e2e8f0; background: #0b1525; box-shadow: 0 10px 24px rgba(2, 8, 23, .6);
      font-size: .8rem; font-weight: 400; line-height: 1.4; text-align: left; white-space: normal; pointer-events: none; }
    .bubble[data-side="start"] { left: -.4rem; transform: none; }
    .bubble[data-side="end"] { left: auto; right: -.4rem; transform: none; }
  `]
})
export class HintComponent {
  /** Texte de l'aide. */
  readonly text = input.required<string>();
  /** Sujet de l'aide, lu par les lecteurs d'écran : « Aide : Demande ». */
  readonly label = input('');
  readonly open = signal(false);
  /** Côté d'ouverture : centré, sauf près d'un bord de l'écran. */
  readonly side = signal<'center' | 'start' | 'end'>('center');
  readonly id = `hint-${++nextId}`;
  private readonly host = inject(ElementRef<HTMLElement>);

  show(): void {
    const box = this.host.nativeElement.getBoundingClientRect();
    const half = Math.min(288, window.innerWidth * .8) / 2;
    this.side.set(box.left < half ? 'start' : window.innerWidth - box.right < half ? 'end' : 'center');
    this.open.set(true);
  }
}
