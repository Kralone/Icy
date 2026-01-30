import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
// Import du dossier frère pour l'éditeur
import { ScweProgressEditorComponent } from '../scwe-progress-editor/scwe-progress-editor.component';
import {
  ScWorldEventParticipationViewDto,
  ScWorldEventParticipationDto,
  ScweScoreSchema
} from '../../../model/scwe-player.model';

@Component({
  selector: 'app-scwe-events-list',
  standalone: true,
  imports: [CommonModule, ScweProgressEditorComponent],
  templateUrl: './scwe-events-list.component.html'
})
export class ScweEventsListComponent {
  @Input() items: ScWorldEventParticipationViewDto[] = [];
  @Input() mode: 'active' | 'history' = 'active';
  @Output() updated = new EventEmitter<{ viewItem: ScWorldEventParticipationViewDto, part: ScWorldEventParticipationDto }>();

  expanded: Record<string, boolean> = {};
  protected readonly Math = Math;

  toggle(id: string) {
    this.expanded[id] = !this.expanded[id];
  }

  trackByEventId(index: number, it: ScWorldEventParticipationViewDto): string {
    return it.event?.id || `idx-${index}`;
  }

  isActiveEvent(startAt: string, endAt?: string | null): boolean {
    const now = Date.now();
    const startOk = new Date(startAt).getTime() <= now;
    const endOk = !endAt || new Date(endAt).getTime() >= now;
    return startOk && endOk;
  }

  getGlobalMax(schema: any): number {
    const s = schema as ScweScoreSchema;
    if (!s?.fields) return 10000;

    let sumMax = s.fields.reduce((acc, f) => acc + (f.max || 0), 0);

    if (s.total?.milestones?.length) {
      const maxMilestone = Math.max(...s.total.milestones.map(m => m.at));
      if (maxMilestone > sumMax) return maxMilestone;
    }
    return sumMax || 10000;
  }

  onSave(viewItem: ScWorldEventParticipationViewDto, part: ScWorldEventParticipationDto) {
    this.updated.emit({ viewItem, part });
  }
}
