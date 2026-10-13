import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AsyncStateComponent } from '../async-state/async-state.component';

export interface ParticipationsByStatus {
  confirmed: any[];
  maybe: any[];
  refused: any[];
}

/**
 * Bloc historique « Présence » + « Équipage » (trois boutons colorés, trois colonnes nominatives).
 * Extrait à l'identique de la modale d'événement pour être partagé avec la fiche Opération.
 * Composant de présentation : les données et l'enregistrement restent chez le parent (source serveur).
 */
@Component({
  selector: 'app-participation-panel',
  standalone: true,
  imports: [AsyncStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participation-panel.component.html',
  styleUrl: './participation-panel.component.css'
})
export class ParticipationPanelComponent {
  @Input() participationsByStatus: ParticipationsByStatus = { confirmed: [], maybe: [], refused: [] };
  @Input() selectedStatus: number | null = null;
  @Input() finished = false;
  @Input() finishedLabel = 'Événement terminé.';
  @Input() actionsLabel = 'Votre réponse à cet événement';
  @Input() loading = false;
  @Input() saving = false;
  @Input() error = '';

  @Output() statusChange = new EventEmitter<number>();
  @Output() retry = new EventEmitter<void>();
}
