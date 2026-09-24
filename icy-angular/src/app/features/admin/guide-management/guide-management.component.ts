import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuideService } from '../../../core/services/guide/guide.service';
import { Guide } from '../../../model/guide.model';

@Component({
  selector: 'app-guide-management', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './guide-management.component.html', changeDetection: ChangeDetectionStrategy.Eager
})
export class GuideManagementComponent implements OnInit {
  guides: Guide[] = [];
  editing: Guide | null = null;
  showForm = false;
  form: Partial<Guide> = this.empty();
  saving = false;
  error = '';
  constructor(private readonly service: GuideService) {}
  ngOnInit(): void { this.load(); }
  load(): void { this.service.listAdmin().subscribe({ next: guides => this.guides = guides, error: () => this.error = 'Impossible de charger les guides.' }); }
  open(guide?: Guide): void { this.editing = guide ?? null; this.form = guide ? { ...guide } : this.empty(); this.showForm = true; this.error = ''; }
  close(): void { this.editing = null; this.form = this.empty(); this.showForm = false; }
  save(): void {
    try {
      const parsed = JSON.parse(this.form.content || '');
      if (!Array.isArray(parsed.sections)) throw new Error();
    } catch {
      this.error = 'Le contenu doit être un JSON valide contenant un tableau « sections ». ';
      return;
    }
    this.saving = true; this.error = '';
    const request = this.editing ? this.service.update(this.editing.id, this.form) : this.service.create(this.form);
    request.subscribe({ next: () => { this.saving = false; this.close(); this.load(); }, error: () => { this.saving = false; this.error = 'Enregistrement impossible.'; } });
  }
  remove(guide: Guide): void { if (confirm(`Supprimer « ${guide.title} » ?`)) this.service.delete(guide.id).subscribe(() => this.load()); }
  private empty(): Partial<Guide> { return { slug: '', title: '', summary: '', content: '{\n  "sections": []\n}', status: 'DRAFT', published: false, gameVersion: '' }; }
}
