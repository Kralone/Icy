import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-async-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './async-state.component.css',
  template: `
    <section class="async-state" [class.async-state--error]="kind === 'error'"
      [attr.role]="kind === 'error' ? 'alert' : 'status'" aria-atomic="true">
      @if (kind === 'loading') {
        <span class="async-state__spinner" aria-hidden="true"></span>
      }
      <p class="async-state__title">{{ title || defaultTitles[kind] }}</p>
      @if (description) {
        <p class="async-state__description">{{ description }}</p>
      }
      @if (actionLabel) {
        <button type="button" (click)="action.emit()">{{ actionLabel }}</button>
      }
    </section>
  `
})
export class AsyncStateComponent {
  @Input() kind: 'loading' | 'error' | 'empty' = 'empty';
  @Input() title = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();

  readonly defaultTitles = {
    loading: 'Chargement en cours…',
    error: 'Impossible de charger les données',
    empty: 'Aucune donnée disponible'
  };
}
