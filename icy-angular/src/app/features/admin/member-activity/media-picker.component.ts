import { ChangeDetectionStrategy, Component, OnInit, computed, inject, model, signal } from '@angular/core';
import { ImageLibraryService } from '../../../core/services/image/image-library.service';
import { ImageMetadata } from '../../../model/image-metadata.model';

const MEDIA = /\.(gif|webp|png|jpe?g|avif)$/i;
/** Catégorie de la bibliothèque réservée aux GIF des messages privés. */
export const BOT_MEDIA_CATEGORY = 'Messages du bot';

export function isBotMedia(image: ImageMetadata): boolean {
  return MEDIA.test(image.name) && (image.category ?? '').trim().toLowerCase() === BOT_MEDIA_CATEGORY.toLowerCase();
}

/**
 * GIF joint à un message privé : choisi dans la bibliothèque d'images. Le bot le lit dans le même dossier
 * et le joint au message ; un fichier introuvable n'empêche pas l'envoi du texte.
 */
@Component({
  selector: 'app-media-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field media">
      <span>GIF joint</span>
      <div class="media__row">
        <div class="media__thumb" [class.media__thumb--missing]="file() && !current()">
          @if (current(); as image) { <img [src]="image.url" [alt]="image.name"> }
          @else if (file()) { <span>Introuvable</span> }
          @else { <span>Aucun</span> }
        </div>
        <div class="media__choice">
          <select class="input" (change)="pick($any($event.target).value)" aria-label="GIF joint au message">
            <option value="" [selected]="!file()">Aucun GIF</option>
            @if (file() && !current()) { <option [value]="file()" selected>{{ file() }} (pas dans la bibliothèque)</option> }
            @for (image of images(); track image.name) { <option [value]="image.name" [selected]="image.name === file()">{{ image.name }}</option> }
          </select>
          @if (file() && !current() && loaded()) {
            <small class="media__warning">« {{ file() }} » n’est pas dans la catégorie « {{ category }} » de la bibliothèque d’images : importez-le dans cette catégorie (Admin › Images) ou choisissez-en un autre. Sans lui, le texte part seul.</small>
          } @else {
            <small class="muted">Les fichiers de la catégorie « {{ category }} » de la bibliothèque d’images (Admin › Images).</small>
          }
        </div>
      </div>
    </div>`,
  styles: [`
    .media__row { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: 0.85rem; align-items: start; }
    .media__thumb { display: grid; place-items: center; aspect-ratio: 1; overflow: hidden; border-radius: 0.75rem; border: 1px solid rgb(255 255 255 / 0.1); background: #08111b; color: rgb(100 116 139); font-size: 0.72rem; }
    .media__thumb img { width: 100%; height: 100%; object-fit: cover; }
    .media__thumb--missing { border-color: rgb(251 191 36 / 0.5); color: rgb(253 230 138); }
    .media__choice { display: grid; gap: 0.45rem; }
    .media__warning { color: rgb(253 230 138); font-size: 0.76rem; line-height: 1.45; }
  `]
})
export class MediaPickerComponent implements OnInit {
  private readonly library = inject(ImageLibraryService);
  readonly file = model<string | null>(null);
  readonly images = signal<ImageMetadata[]>([]);
  readonly loaded = signal(false);
  readonly category = BOT_MEDIA_CATEGORY;
  readonly current = computed(() => this.images().find(image => image.name === this.file()) ?? null);

  ngOnInit(): void {
    this.library.getAll().subscribe({
      next: images => {
        this.images.set((images ?? []).filter(isBotMedia).sort((a, b) => a.name.localeCompare(b.name)));
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true)
    });
  }

  pick(name: string): void {
    this.file.set(name || null);
  }
}
