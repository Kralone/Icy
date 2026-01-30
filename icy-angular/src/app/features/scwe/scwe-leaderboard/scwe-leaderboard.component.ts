import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScWorldEventDto, ScWorldEventParticipationDto, ScweScoreSchema } from '../../../model/scwe-player.model';

@Component({
  selector: 'app-scwe-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scwe-leaderboard.component.html'
})
export class ScweLeaderboardComponent {
  @Input() event!: ScWorldEventDto;
  @Input() participants: ScWorldEventParticipationDto[] = [];

  expanded: Record<string, boolean> = {};
  protected readonly Math = Math;

  toggle(id: string) {
    this.expanded[id] = !this.expanded[id];
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

  getFieldValue(p: ScWorldEventParticipationDto, key: string): number {
    return p.points ? (p.points[key] || 0) : 0;
  }
}
