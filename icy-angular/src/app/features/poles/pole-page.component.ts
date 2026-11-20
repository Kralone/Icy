import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { POLE_STAT_LABELS, PoleActivity, PoleAgendaEntry, PoleHome, PoleNews, poleBySlug } from '../../core/services/pole/pole';
import { PoleService } from '../../core/services/pole/pole.service';
import { eventImage } from '../events/event-appearance';
import { PoleIconComponent } from '../../shared/pole-icon/pole-icon.component';

const ACTIVITY_STATUS: Record<string, string> = { ACTIVE: 'En cours', SETTLEMENT: 'Comptes arrêtés', CLOSED: 'Clôturée' };
const NUMBER = new Intl.NumberFormat('fr-FR');
const MOMENT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Accueil d'un pôle : référents, chiffres, actualités, activité récente et outils. */
@Component({
  selector: 'app-pole-page',
  standalone: true,
  imports: [RouterLink, FormsModule, PoleIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pole-page.component.html',
  styleUrl: './poles.css'
})
export class PolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly poleService = inject(PoleService);

  private readonly slug = toSignal(this.route.paramMap.pipe(map(params => params.get('pole'))), {
    initialValue: this.route.snapshot.paramMap.get('pole')
  });
  readonly pole = computed(() => poleBySlug(this.slug()));

  /** null tant que l'accueil du pôle n'est pas chargé. */
  readonly home = signal<PoleHome | null>(null);
  readonly loadFailed = signal(false);

  /** Chiffres que l'interface sait nommer, dans l'ordre du serveur. */
  readonly stats = computed(() =>
    (this.home()?.stats ?? [])
      .filter(stat => POLE_STAT_LABELS[stat.key])
      .map(stat => ({ ...POLE_STAT_LABELS[stat.key], key: stat.key, value: NUMBER.format(stat.value) }))
  );

  /** Mode gestion : formulaire d'actualité et actions sur les actualités publiées. */
  readonly managing = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  /** Actualité en cours de modification ; null pour une nouvelle. */
  readonly editingId = signal<number | null>(null);
  /** Actualité dont la suppression attend une confirmation. */
  readonly deletingId = signal<number | null>(null);
  draft = { title: '', content: '' };

  ngOnInit(): void {
    if (!this.pole()) {
      // Adresse d'un pôle qui n'existe pas : retour au menu des pôles.
      void this.router.navigate(['/icy/poles'], { replaceUrl: true });
      return;
    }
    this.load();
  }

  load(): void {
    const pole = this.pole();
    if (!pole) return;
    this.loadFailed.set(false);
    this.poleService.home(pole.key).subscribe({
      next: home => this.home.set(home),
      error: () => this.loadFailed.set(true)
    });
  }

  toggleManaging(): void {
    this.managing.update(on => !on);
    this.resetDraft();
  }

  edit(news: PoleNews): void {
    this.editingId.set(news.id);
    this.deletingId.set(null);
    this.formError.set(null);
    this.draft = { title: news.title, content: news.content };
  }

  resetDraft(): void {
    this.editingId.set(null);
    this.deletingId.set(null);
    this.formError.set(null);
    this.draft = { title: '', content: '' };
  }

  save(): void {
    const pole = this.pole();
    const news = { title: this.draft.title.trim(), content: this.draft.content.trim() };
    if (!pole || this.saving()) return;
    if (!news.title || !news.content) {
      this.formError.set('Le titre et le texte sont obligatoires.');
      return;
    }
    const id = this.editingId();
    this.saving.set(true);
    this.formError.set(null);
    (id === null ? this.poleService.publishNews(pole.key, news) : this.poleService.updateNews(pole.key, id, news)).subscribe({
      next: saved => {
        this.home.update(home => home && {
          ...home,
          news: id === null ? [saved, ...home.news] : home.news.map(entry => (entry.id === id ? saved : entry))
        });
        this.saving.set(false);
        this.resetDraft();
      },
      error: error => {
        this.saving.set(false);
        this.formError.set(error?.error?.message || "L'actualité n'a pas pu être enregistrée.");
      }
    });
  }

  /** Premier clic : demande de confirmation. Second clic : suppression. */
  remove(news: PoleNews): void {
    const pole = this.pole();
    if (!pole) return;
    if (this.deletingId() !== news.id) {
      this.deletingId.set(news.id);
      return;
    }
    this.poleService.deleteNews(pole.key, news.id).subscribe({
      next: () => {
        this.home.update(home => home && { ...home, news: home.news.filter(entry => entry.id !== news.id) });
        if (this.editingId() === news.id) this.resetDraft();
        this.deletingId.set(null);
      },
      error: () => {
        this.deletingId.set(null);
        this.formError.set("L'actualité n'a pas pu être supprimée.");
      }
    });
  }

  /** Image d'outil hébergée ailleurs qui ne répond pas : l'image du pôle la remplace, une seule fois. */
  useFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (!image.dataset['fallback']) {
      image.dataset['fallback'] = 'true';
      image.src = fallback;
    }
  }

  initial(username: string): string {
    return (username || '?').trim().charAt(0).toUpperCase();
  }

  day(value: string): string {
    // Une date civile (AAAA-MM-JJ) reste ce jour-là quel que soit le fuseau du navigateur.
    const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    const date = civil ? new Date(+civil[1], +civil[2] - 1, +civil[3]) : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : DAY.format(date);
  }

  /** Jour et heure de début, par exemple « samedi 21 novembre à 21:00 ». */
  moment(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : MOMENT.format(date);
  }

  agendaKind(entry: PoleAgendaEntry): string {
    return entry.kind === 'OPERATION' ? 'Opération' : 'Événement';
  }

  /** Image de l'activité si elle en a une valable, sinon celle du pôle. */
  agendaImage(entry: PoleAgendaEntry, fallback: string): string {
    return eventImage(entry.imageUrl) ?? fallback;
  }

  /** Une opération ouvre sa page ; un événement ouvre sa fiche dans le calendrier. */
  agendaLink(entry: PoleAgendaEntry): string[] {
    return entry.kind === 'OPERATION' ? ['/icy/operations', entry.id] : ['/icy/events'];
  }

  agendaQuery(entry: PoleAgendaEntry): { eventId: string } | null {
    return entry.kind === 'OPERATION' ? null : { eventId: entry.id };
  }

  activityStatus(activity: PoleActivity): string {
    return ACTIVITY_STATUS[activity.status] ?? activity.status;
  }

  activityLink(activity: PoleActivity): string[] | null {
    return activity.kind === 'MINING_SHEET' ? ['/icy/outils/fiches-minage', activity.id] : null;
  }
}
