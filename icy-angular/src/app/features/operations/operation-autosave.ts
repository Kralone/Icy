import { Observable } from 'rxjs';

export type AutosaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface AutosaveOptions<T> {
  /** Délai sans nouvelle saisie avant l'envoi. */
  delayMs: number;
  /** Envoie une version au serveur avec la dernière révision confirmée ; renvoie la nouvelle révision. */
  save: (payload: T, revision: number | null, options: { keepalive: boolean }) => Observable<{ revision?: number | null } | null | undefined>;
  describeError: (error: unknown) => string;
  onChange: () => void;
}

/**
 * Autosauvegarde d'un brouillon.
 * Une seule écriture est en cours à la fois : les saisies faites pendant un envoi partent ensuite, dans l'ordre.
 * L'état « saved » n'est atteint que sur confirmation du serveur.
 */
export class DraftAutosave<T> {
  status: AutosaveStatus = 'saved';
  errorMessage = '';
  savedAt: Date | null = null;
  /** Faux : les modifications sont suivies mais ne partent que sur demande (opération déjà publiée). */
  auto = true;

  private revision: number | null = null;
  private savedKey = '';
  private pending: T | null = null;
  private inFlight = false;
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: AutosaveOptions<T>) {}

  get hasUnsavedChanges(): boolean { return this.status !== 'saved'; }

  /** Repart de l'état lu sur le serveur. */
  reset(payload: T, revision: number | null, savedAt: Date | null): void {
    this.clearTimer();
    this.sequence++;
    this.inFlight = false;
    this.pending = null;
    this.savedKey = JSON.stringify(payload);
    this.revision = revision;
    this.savedAt = savedAt;
    this.errorMessage = '';
    this.setStatus('saved');
  }

  /** Une écriture faite ailleurs (publication) a fait avancer la révision. */
  setRevision(revision: number | null | undefined): void {
    if (revision !== null && revision !== undefined) this.revision = revision;
  }

  /** Signale le contenu courant du formulaire. */
  update(payload: T): void {
    if (this.status === 'conflict') { this.pending = payload; return; }
    if (!this.inFlight && JSON.stringify(payload) === this.savedKey) {
      this.pending = null;
      this.clearTimer();
      this.errorMessage = '';
      this.setStatus('saved');
      return;
    }
    this.pending = payload;
    if (!this.inFlight) this.setStatus('dirty');
    this.clearTimer();
    if (this.auto) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.options.delayMs);
  }

  /** Envoie tout de suite la dernière version en attente. `keepalive` sert à la fermeture de la page. */
  flush(options: { keepalive?: boolean } = {}): void {
    this.clearTimer();
    if (this.status === 'conflict' || this.pending === null) return;
    // Hors fermeture de page, la réponse en cours déclenchera l'envoi suivant.
    if (this.inFlight && !options.keepalive) return;
    this.send(!!options.keepalive);
  }

  retry(): void {
    if (this.status === 'error') this.flush();
  }

  /** Après un conflit : repart de la révision actuelle du serveur et renvoie la version locale. */
  overwriteFrom(revision: number | null): void {
    if (this.status !== 'conflict') return;
    this.revision = revision;
    this.errorMessage = '';
    this.setStatus('dirty');
    this.flush();
  }

  private send(keepalive: boolean): void {
    const payload = this.pending as T;
    const key = JSON.stringify(payload);
    // Un envoi forcé pendant une écriture en cours ne connaît pas encore sa révision : il part sans contrôle.
    const revision = this.inFlight ? null : this.revision;
    const ticket = ++this.sequence;
    this.pending = null;
    this.inFlight = true;
    this.errorMessage = '';
    this.setStatus('saving');
    this.options.save(payload, revision, { keepalive }).subscribe({
      next: result => {
        if (ticket !== this.sequence) return;
        this.inFlight = false;
        this.setRevision(result?.revision);
        this.savedKey = key;
        this.savedAt = new Date();
        if (this.pending !== null && JSON.stringify(this.pending) === key) this.pending = null;
        if (this.pending === null) { this.setStatus('saved'); return; }
        this.setStatus('dirty');
        // Si l'utilisateur tape encore, la temporisation en cours enverra la suite.
        if (this.auto && this.timer === null) this.flush();
      },
      error: error => {
        if (ticket !== this.sequence) return;
        this.inFlight = false;
        // La version refusée reste à envoyer, sauf si une saisie plus récente l'a remplacée.
        if (this.pending === null) this.pending = payload;
        this.errorMessage = this.options.describeError(error);
        if ((error as { status?: number })?.status === 409) { this.clearTimer(); this.setStatus('conflict'); }
        else this.setStatus('error');
      }
    });
  }

  private clearTimer(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
  }

  private setStatus(status: AutosaveStatus): void {
    this.status = status;
    this.options.onChange();
  }
}
