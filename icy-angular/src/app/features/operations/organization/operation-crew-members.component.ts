import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CrewMember, isPositionFull, OperationCrew } from './operation-crew.model';

/** Demande d'attribution : `select` permet de remettre la liste sur le poste réel si le serveur refuse. */
export interface CrewPositionChange { member: CrewMember; positionId: number | null; select: { value: string }; }

/** Membres d'un équipage avec, pour chacun, la liste des postes : partagé par l'éditeur et par la fiche du responsable. */
@Component({
  selector: 'app-operation-crew-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="members">
      @for (member of crew().members; track member.userId) {
        <li>
          <span class="members__avatar" aria-hidden="true">{{ member.username.charAt(0).toUpperCase() }}</span>
          <span class="members__name">{{ member.username }}</span>
          @if (crew().positions.length && editable()) {
            <select [attr.aria-label]="'Poste de ' + member.username" [disabled]="busy()" [value]="member.positionId ?? ''" (change)="change(member, $any($event.target))">
              <option value="">Sans poste</option>
              @for (position of crew().positions; track position.id) {
                <option [value]="position.id" [selected]="member.positionId === position.id" [disabled]="isFull(position) && member.positionId !== position.id">{{ position.label }}{{ isFull(position) && member.positionId !== position.id ? ' (complet)' : '' }}</option>
              }
            </select>
          } @else {
            <span class="members__position" [class.is-none]="member.positionId === null">{{ positionLabel(member) }}</span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; min-width: 0; container: crewmembers / inline-size; }
    .members { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); gap: .45rem; }
    .members li { display: flex; align-items: center; gap: .55rem; min-width: 0; padding: .45rem .6rem; border: 1px solid rgba(148,163,184,.25); border-radius: .55rem; background: #111827; }
    .members__avatar { display: inline-grid; place-items: center; flex: none; width: 1.8rem; height: 1.8rem; border-radius: 50%; color: #082f49; background: #80e5b8; font-size: .8rem; font-weight: 700; }
    .members__name { flex: 1 1 5rem; min-width: 0; color: #e2e8f0; overflow-wrap: anywhere; }
    select { flex: 0 1 9.5rem; min-width: 0; min-height: 2.5rem; max-width: 100%; border: 1px solid #475569; border-radius: .45rem; padding: .4rem .6rem; color: #f8fafc; background: #111827; color-scheme: dark; }
    select:disabled { opacity: .45; }
    select:focus-visible { outline: 2px solid #72ddf7; outline-offset: 2px; }
    .members__position { color: #a5f3fc; font-size: .85rem; font-weight: 600; }
    .members__position.is-none { color: #94a3b8; font-weight: 400; }
    @container crewmembers (max-width: 22rem) { .members li { flex-wrap: wrap; } select { flex: 1 1 100%; } }
  `
})
export class OperationCrewMembersComponent {
  readonly crew = input.required<OperationCrew>();
  /** Faux : les postes sont seulement lus (opération terminée). */
  readonly editable = input(true);
  readonly busy = input(false);
  readonly assign = output<CrewPositionChange>();

  readonly isFull = isPositionFull;

  positionLabel(member: CrewMember): string {
    return this.crew().positions.find(position => position.id === member.positionId)?.label ?? 'Sans poste';
  }

  change(member: CrewMember, select: { value: string }): void {
    const positionId = select.value === '' ? null : Number(select.value);
    if (positionId !== (member.positionId ?? null)) this.assign.emit({ member, positionId, select });
  }
}
