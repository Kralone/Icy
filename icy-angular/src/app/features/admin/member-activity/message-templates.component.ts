import { ChangeDetectionStrategy, Component, OnChanges, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MemberActivityService } from '../../../core/services/member/member-activity.service';
import { MessageTemplate, discordPreviewHtml, renderMessage } from '../../../core/services/member/member-activity';
import { MediaPickerComponent } from './media-picker.component';

interface Draft { body: string; mediaFile: string | null; saving: boolean; message: string | null; error: boolean; }

/** Textes et GIF des messages privés envoyés par le bot : rappel d'inactivité, bienvenue, promotions et nominations. */
@Component({
  selector: 'app-message-templates',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, FormsModule, MediaPickerComponent],
  template: `
    <section class="templates">
      <p class="muted intro">{{ '{' }}pseudo{{ '}' }}, {{ '{' }}grade{{ '}' }} et {{ '{' }}pôle{{ '}' }} sont remplacés pour chaque membre. Une campagne de rappel copie le texte au moment où elle est créée : la modifier ensuite ne change pas ce modèle.</p>
      <div class="template-layout">
        <nav class="glace-panel template-list" aria-label="Modèles">
          @for (group of groups; track group.key) {
            <p class="group">{{ group.label }}</p>
            @for (template of byCategory(group.key); track template.code) {
              <button type="button" class="template-link" [class.template-link--active]="selected === template.code" (click)="selected = template.code">
                @if (template.mediaUrl) { <img [src]="template.mediaUrl" alt="" loading="lazy"> } @else { <span class="no-media" aria-hidden="true"></span> }
                <span>{{ template.label }}</span>
              </button>
            }
          }
        </nav>
        @if (current; as template) {
          <article class="glace-panel editor">
            <header>
              <h3>{{ template.label }}</h3>
              @if (template.updatedBy) { <small class="muted">Modifié par {{ template.updatedBy }} le {{ template.updatedAt | date:'d MMM yyyy' }}</small> }
            </header>
            <div class="editor__grid">
              <div class="editor__form">
                <label class="field">
                  <span>Texte</span>
                  <textarea class="input" [(ngModel)]="drafts[template.code].body" [attr.aria-label]="'Texte de ' + template.label"></textarea>
                  <small class="counter" [class.counter--over]="drafts[template.code].body.length > 1900">{{ drafts[template.code].body.length }} / 1900</small>
                </label>
                <app-media-picker [(file)]="drafts[template.code].mediaFile" />
                <div class="row">
                  <button type="button" class="btn btn--primary btn--small" (click)="save(template)" [disabled]="drafts[template.code].saving || !dirty(template)">Enregistrer</button>
                  @if (dirty(template)) { <button type="button" class="link-button" (click)="reset(template)">Annuler les changements</button> }
                  @if (drafts[template.code].message) { <small [class.form-error]="drafts[template.code].error" [class.muted]="!drafts[template.code].error" role="status">{{ drafts[template.code].message }}</small> }
                </div>
              </div>
              <div class="editor__preview">
                <span class="eyebrow">Aperçu</span>
                <div class="discord-preview"><div [innerHTML]="previewHtml(template)"></div>@if (previewMedia(template)) {<img [src]="previewMedia(template)" alt="">}</div>
              </div>
            </div>
          </article>
        }
      </div>
    </section>`,
  styles: [`
    .templates { display: grid; gap: 1rem; }
    .intro { line-height: 1.5; max-width: 70ch; }
    .template-layout { display: grid; grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr); gap: 1rem; align-items: start; }
    .template-list { display: grid; gap: 0.3rem; padding: 0.85rem; position: sticky; top: 1rem; }
    .group { margin: 0.6rem 0.4rem 0.2rem; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(148 163 184); }
    .template-link { display: flex; align-items: center; gap: 0.7rem; padding: 0.45rem 0.6rem; border-radius: 0.7rem; text-align: left; font-size: 0.86rem; color: rgb(203 213 225); border: 1px solid transparent; }
    .template-link:hover { background: rgb(255 255 255 / 0.04); }
    .template-link--active { border-color: rgb(103 232 249 / 0.45); background: rgb(103 232 249 / 0.08); color: white; }
    .template-link img, .no-media { flex: none; width: 2.2rem; height: 2.2rem; border-radius: 0.5rem; object-fit: cover; background: #08111b; border: 1px solid rgb(255 255 255 / 0.08); }
    .editor { display: grid; gap: 1rem; padding: clamp(1rem, 2.5vw, 1.75rem); }
    .editor h3 { font-size: 1.25rem; font-weight: 600; color: white; }
    .editor__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.5rem; }
    .editor__form { display: grid; gap: 1rem; align-content: start; }
    .editor__form textarea { min-height: 20rem; }
    .editor__preview { display: grid; gap: 0.5rem; align-content: start; }
    .eyebrow { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #67e8f9; }
    .counter { justify-self: end; color: rgb(100 116 139); font-size: 0.72rem; }
    .counter--over { color: rgb(252 165 165); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
    @media (max-width: 1280px) { .editor__grid { grid-template-columns: 1fr; } }
    @media (max-width: 760px) {
      .template-layout { grid-template-columns: 1fr; }
      .template-list { position: static; grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; }
      .group { display: none; }
    }
  `]
})
export class MessageTemplatesComponent implements OnChanges {
  private readonly api = inject(MemberActivityService);
  readonly templates = input<MessageTemplate[]>([]);
  readonly saved = output<void>();

  selected = 'RAPPEL_INACTIVITE';
  drafts: Record<string, Draft> = {};
  readonly groups = [
    { key: 'RAPPEL' as const, label: 'Rappels' },
    { key: 'PROMOTION' as const, label: 'Bienvenue et promotions' }
  ];

  ngOnChanges(): void {
    for (const template of this.templates()) {
      const existing = this.drafts[template.code];
      if (!existing || !this.dirty(template)) {
        this.drafts[template.code] = { body: template.body, mediaFile: template.mediaFile, saving: false, message: existing?.message ?? null, error: false };
      }
    }
    if (!this.templates().some(template => template.code === this.selected)) this.selected = this.templates()[0]?.code ?? '';
  }

  byCategory(category: 'RAPPEL' | 'PROMOTION'): MessageTemplate[] {
    return this.templates().filter(template => template.category === category);
  }

  get current(): MessageTemplate | null {
    return this.templates().find(template => template.code === this.selected && this.drafts[template.code]) ?? null;
  }

  dirty(template: MessageTemplate): boolean {
    const draft = this.drafts[template.code];
    return !!draft && (draft.body !== template.body || (draft.mediaFile ?? null) !== (template.mediaFile ?? null));
  }

  reset(template: MessageTemplate): void {
    this.drafts[template.code] = { body: template.body, mediaFile: template.mediaFile, saving: false, message: null, error: false };
  }

  preview(template: MessageTemplate): string {
    const pole = ['INDUSTRIE', 'LOGISTIQUE', 'MILITAIRE'].find(key => template.code.endsWith(`_${key}`));
    return renderMessage(this.drafts[template.code]?.body ?? template.body, {
      pseudo: 'Vexa', grade: 'Associé', pole: pole ? pole.charAt(0) + pole.slice(1).toLowerCase() : 'Industrie'
    });
  }

  previewHtml(template: MessageTemplate): string {
    return discordPreviewHtml(this.preview(template));
  }

  previewMedia(template: MessageTemplate): string | null {
    const file = this.drafts[template.code]?.mediaFile;
    if (!file) return null;
    if (file === template.mediaFile) return template.mediaUrl;
    return template.mediaUrl ? template.mediaUrl.replace(/[^/]+$/, encodeURIComponent(file)) : null;
  }

  save(template: MessageTemplate): void {
    const draft = this.drafts[template.code];
    draft.saving = true;
    draft.message = null;
    this.api.updateTemplate(template.code, draft.body, draft.mediaFile).subscribe({
      next: () => {
        draft.saving = false;
        draft.error = false;
        draft.message = 'Enregistré.';
        this.saved.emit();
      },
      error: err => {
        draft.saving = false;
        draft.error = true;
        draft.message = err?.error?.message ?? 'Enregistrement refusé.';
      }
    });
  }
}
