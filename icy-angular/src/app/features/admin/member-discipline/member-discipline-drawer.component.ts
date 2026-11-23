import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisciplineService } from '../../../core/services/moderation/discipline.service';
import { DisciplineRecord, MemberSanction, MemberWarning, SanctionDecision, WarningCategory } from '../../../model/discipline.model';
import { WARNING_CATEGORIES, categoryLabel, consequence, deliveryFailureLabel, ordinal, warningTone } from './discipline-messages';

/** Ligne de l'historique : un avertissement ou une décision, dans l'ordre chronologique inverse. */
type HistoryEntry =
  | { kind: 'warning'; at: string; warning: MemberWarning }
  | { kind: 'sanction'; at: string; sanction: MemberSanction };

export const REASON_MAX = 1000;

/**
 * Dossier disciplinaire d'un membre, en panneau latéral : avertir avec un aperçu du message du bot,
 * lever ou renvoyer un avertissement, et, pour un Directeur, trancher au seuil.
 */
@Component({
  selector: 'app-member-discipline-drawer',
  templateUrl: './member-discipline-drawer.component.html',
  styleUrl: './member-discipline-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  host: { '(document:keydown.escape)': 'close()' }
})
export class MemberDisciplineDrawerComponent {
  private readonly discipline = inject(DisciplineService);

  readonly userId = input.required<string>();
  /** Grade du membre, pour la couleur de son initiale. */
  readonly rank = input<string>('JUNIOR');
  readonly closed = output<void>();
  /** Le dossier a changé : la page rafraîchit ses compteurs (et sa liste après une exclusion). */
  readonly changed = output<DisciplineRecord>();

  readonly categories = WARNING_CATEGORIES;
  readonly reasonMax = REASON_MAX;
  readonly categoryLabel = categoryLabel;
  readonly ordinal = ordinal;
  readonly failureLabel = deliveryFailureLabel;
  readonly today = new Date();

  readonly record = signal<DisciplineRecord | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);

  // Nouvel avertissement
  readonly category = signal<WarningCategory | null>(null);
  readonly reason = signal('');

  // Lever un avertissement
  readonly revokingId = signal<number | null>(null);
  revokeReason = '';
  revokeNotify = true;

  // Décision au seuil
  decisionNote = '';
  decisionNotify = true;
  readonly confirmingExclusion = signal(false);

  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  readonly threshold = computed(() => this.record()?.threshold ?? 3);
  readonly nextRank = computed(() => (this.record()?.activeWarnings ?? 0) + 1);
  readonly pips = computed(() => {
    const record = this.record();
    const threshold = this.threshold();
    const count = Math.max(threshold, record?.activeWarnings ?? 0);
    return Array.from({ length: count }, (_, index) => ({
      filled: index < (record?.activeWarnings ?? 0),
      tone: warningTone(index + 1, threshold)
    }));
  });
  readonly history = computed<HistoryEntry[]>(() => {
    const record = this.record();
    if (!record) return [];
    const entries: HistoryEntry[] = [
      ...record.warnings.map(warning => ({ kind: 'warning' as const, at: warning.createdAt, warning })),
      ...record.sanctions.map(sanction => ({ kind: 'sanction' as const, at: sanction.createdAt, sanction }))
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  });
  /** Exclusion décidée dont le ban Discord n'est pas encore confirmé. */
  readonly banToDo = computed(() => this.record()?.sanctions.find(sanction => sanction.decision === 'EXCLUDE' && !sanction.discordBanDoneAt) ?? null);
  readonly canSubmit = computed(() => !!this.category() && this.reason().trim().length > 0 && this.reason().length <= REASON_MAX && !this.busy());

  /** Aperçu du message que le bot enverra. */
  readonly preview = computed(() => {
    const rank = this.nextRank();
    const threshold = this.threshold();
    return {
      title: `⚠️ ${ordinal(rank).charAt(0).toUpperCase()}${ordinal(rank).slice(1)} avertissement`,
      category: this.category() ? categoryLabel(this.category()) : 'Nature à choisir',
      reason: this.reason().trim(),
      consequence: consequence(rank, threshold),
      tone: warningTone(rank, threshold)
    };
  });

  constructor() {
    effect(() => this.load(this.userId()));
  }

  load(userId: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.discipline.record(userId).subscribe({
      next: record => {
        this.record.set(record);
        this.loading.set(false);
        queueMicrotask(() => this.closeButton()?.nativeElement.focus());
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Impossible de charger le dossier de ce membre.');
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  warn(): void {
    const record = this.record();
    const category = this.category();
    if (!record || !category || !this.canSubmit()) return;
    const rank = this.nextRank();
    this.run(this.discipline.warn(record.userId, category, this.reason().trim()), () => {
      this.category.set(null);
      this.reason.set('');
      this.notice.set(`${ordinal(rank).charAt(0).toUpperCase()}${ordinal(rank).slice(1)} avertissement donné. Le bot envoie le message à ${record.username}.`);
    });
  }

  startRevoke(warning: MemberWarning): void {
    this.revokingId.set(warning.id);
    this.revokeReason = '';
    this.revokeNotify = true;
    this.actionError.set(null);
  }

  revoke(warning: MemberWarning): void {
    this.run(this.discipline.revoke(warning.id, this.revokeReason.trim(), this.revokeNotify), () => {
      this.revokingId.set(null);
      this.notice.set(`Avertissement du ${new Date(warning.createdAt).toLocaleDateString('fr-FR')} levé.`);
    });
  }

  resend(warning: MemberWarning): void {
    this.run(this.discipline.resend(warning.id), () => this.notice.set('Message renvoyé au bot.'));
  }

  decide(decision: SanctionDecision): void {
    const record = this.record();
    if (!record) return;
    if (decision === 'EXCLUDE' && !this.confirmingExclusion()) {
      this.confirmingExclusion.set(true);
      return;
    }
    this.run(this.discipline.decide(record.userId, decision, this.decisionNote.trim(), this.decisionNotify), () => {
      this.confirmingExclusion.set(false);
      this.decisionNote = '';
      this.notice.set(decision === 'EXCLUDE'
        ? `${record.username} est exclu : son compte du site est désactivé. Le bannissement Discord reste à effectuer manuellement.`
        : `Dernière chance accordée à ${record.username}.`);
    });
  }

  confirmDiscordBan(sanction: MemberSanction): void {
    this.run(this.discipline.confirmDiscordBan(sanction.id), () => this.notice.set('Bannissement Discord confirmé.'));
  }

  copyDiscordId(): void {
    const id = this.record()?.discordId;
    if (!id) return;
    navigator.clipboard?.writeText(id).then(
      () => this.notice.set('Discord ID copié.'),
      () => this.notice.set(`Discord ID : ${id}`)
    );
  }

  statusLine(record: DisciplineRecord): string {
    if (!record.active) return this.banToDo() ? 'Exclu · bannissement Discord à effectuer' : 'Exclu';
    if (record.pendingDecision) return 'Exclusion à décider';
    if (record.activeWarnings === 0) return 'Aucun avertissement en cours';
    return `${record.activeWarnings} avertissement${record.activeWarnings > 1 ? 's' : ''} en cours sur ${record.threshold}`;
  }

  tone(rank: number): string {
    return warningTone(rank, this.threshold());
  }

  private run(request: Observable<DisciplineRecord>, done: () => void): void {
    this.busy.set(true);
    this.actionError.set(null);
    this.notice.set(null);
    request.subscribe({
      next: record => {
        this.record.set(record);
        this.busy.set(false);
        done();
        this.changed.emit(record);
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.actionError.set(typeof error.error?.message === 'string' ? error.error.message : "L'action n'a pas abouti. Veuillez réessayer dans un instant.");
      }
    });
  }
}
