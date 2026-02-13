import { Component, OnInit } from '@angular/core';
import { Goal } from '../../../model/goal.model';
import { GoalService } from '../../../core/services/goal/goal.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-dashboard-goal',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingOverlayComponent],
  templateUrl: './goal.component.html',
})
export class GoalComponent implements OnInit {
  goals: Goal[] = [];
  isLoading = true;
  readonly maxSubGoals = 3;
  animatedProgressById: Record<number, number> = {};

  constructor(private goalService: GoalService) {}

  ngOnInit(): void {
    this.goalService.getPinnedGoal().subscribe({
      next: (goal) => {
        this.goals = goal ? [goal] : [];
        this.initializeAnimatedProgress();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  calculateProgress(goal: Goal): number {
    if (!goal) return 0;
    const total = this.getTotalProgress(goal);
    if (total.target === 0) return 0;
    return Math.min(Math.max((total.current / total.target) * 100, 0), 100);
  }

  isDone(goal: Goal): boolean {
    if ((goal as any).completed !== undefined) return !!(goal as any).completed;
    if (!goal) return false;
    const total = this.getTotalProgress(goal);
    if (total.target <= 0) return false;
    return total.current >= total.target;
  }

  getAnimatedProgress(goal: Goal): number {
    if (!goal) return 0;
    if (this.animatedProgressById[goal.id] === undefined) {
      return this.calculateProgress(goal);
    }
    return this.animatedProgressById[goal.id];
  }

  getAnimatedLabelLeft(goal: Goal): number {
    const value = this.getAnimatedProgress(goal);
    if (value <= 6) return 0;
    if (value >= 94) return 100;
    return value;
  }

  getAnimatedLabelAlign(goal: Goal): 'left' | 'center' | 'right' {
    const value = this.getAnimatedProgress(goal);
    if (value <= 6) return 'left';
    if (value >= 94) return 'right';
    return 'center';
  }

  visibleSubGoals(goal: Goal): Goal[] {
    if (!goal.subGoals) return [];
    const sorted = [...goal.subGoals].sort((a, b) => {
      const aDone = this.isDone(a);
      const bDone = this.isDone(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return this.calculateProgress(b) - this.calculateProgress(a);
    });
    return goal.__expanded ? sorted : sorted.slice(0, this.maxSubGoals);
  }

  toggleSubGoals(goal: Goal): void {
    goal.__expanded = !goal.__expanded;
  }

  getTotalProgress(goal: Goal): { current: number; target: number } {
    if (!goal) return { current: 0, target: 0 };
    if (!goal.subGoals?.length) {
      return { current: goal.current ?? 0, target: goal.target ?? 0 };
    }
    return goal.subGoals.reduce(
      (acc, child) => {
        const totals = this.getTotalProgress(child);
        return { current: acc.current + totals.current, target: acc.target + totals.target };
      },
      { current: 0, target: 0 }
    );
  }

  private initializeAnimatedProgress(): void {
    this.animatedProgressById = {};
    for (const goal of this.goals) {
      this.animatedProgressById[goal.id] = 0;
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.animatedProgressById[goal.id] = this.calculateProgress(goal);
        }, 350);
      });
    }
  }
}
