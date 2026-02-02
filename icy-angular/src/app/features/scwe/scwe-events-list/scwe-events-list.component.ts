import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScWorldEventParticipationViewDto, ScWorldEventParticipationDto } from '../../../model/scwe-player.model';
import { ScweProgressEditorComponent } from '../scwe-progress-editor/scwe-progress-editor.component';

@Component({
  selector: 'app-scwe-events-list',
  standalone: true,
  imports: [CommonModule, ScweProgressEditorComponent],
  templateUrl: './scwe-events-list.component.html',
})
export class ScweEventsListComponent {
  @Input() items: ScWorldEventParticipationViewDto[] = [];
  @Input() mode: 'active' | 'history' = 'active';
  @Output() updated = new EventEmitter<{ viewItem: ScWorldEventParticipationViewDto, part: ScWorldEventParticipationDto }>();

  expanded: Record<string, boolean> = {};

  // Variable pour stocker quel tooltip est ouvert sur mobile
  activeMilestoneIndex: string | null = null;

  protected readonly Math = Math;

  toggle(eventId: string) {
    this.expanded[eventId] = !this.expanded[eventId];
    // Ferme les tooltips si on manipule la carte
    this.activeMilestoneIndex = null;
  }

  toggleMilestone(uid: string, event: Event) {
    // Important : empêche le clic de remonter et de déclencher d'autres actions
    event.stopPropagation();
    event.preventDefault(); // Sécurité supplémentaire pour le tactile

    if (this.activeMilestoneIndex === uid) {
      this.activeMilestoneIndex = null;
    } else {
      this.activeMilestoneIndex = uid;
    }
  }

  trackByEventId(index: number, item: ScWorldEventParticipationViewDto): string {
    return item.event.id;
  }

  onSave(viewItem: ScWorldEventParticipationViewDto, updatedPart: ScWorldEventParticipationDto) {
    this.updated.emit({ viewItem, part: updatedPart });
  }

  isActiveEvent(start: string, end?: string | null): boolean {
    const now = new Date().getTime();
    const s = new Date(start).getTime();

    if (now < s) return false;

    // Si pas de date de fin, c'est toujours actif
    if (!end) return true;

    return now <= new Date(end).getTime();
  }

  getGlobalMax(schema: any): number {
    if (!schema || !schema.total) return 1000;
    if (schema.total.milestones && Array.isArray(schema.total.milestones) && schema.total.milestones.length > 0) {
      const last = schema.total.milestones[schema.total.milestones.length - 1];
      return last.at || 1000;
    }
    return schema.total.max || 1000;
  }
}
