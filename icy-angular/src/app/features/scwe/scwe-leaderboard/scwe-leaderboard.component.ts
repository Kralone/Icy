import { scweGlobalTarget, scweProgressBackground } from '../scwe-progress.utils';
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScWorldEventDto, ScWorldEventParticipationDto, ScweScoreSchema } from '../../../model/scwe-player.model';

@Component({
  selector: 'app-scwe-leaderboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
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

  readonly getGlobalMax = scweGlobalTarget;
  readonly progressBackground = scweProgressBackground;

  getFieldValue(p: ScWorldEventParticipationDto, key: string): number {
    return p.points ? (p.points[key] || 0) : 0;
  }

  getInitial(username?: string | null): string {
    const value = (username || '').trim();
    return value ? value.charAt(0).toUpperCase() : '?';
  }
}
