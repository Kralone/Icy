import { Component, OnInit } from '@angular/core';
import { Goal } from '../../../model/goal.model';
import { GoalService } from '../../../core/services/goal/goal.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-goal',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
    if (goal.subGoals?.length) {
      const summary = this.getSubGoalSummary(goal);
      if (summary.total === 0) return 0;
      return Math.min(Math.max((summary.done / summary.total) * 100, 0), 100);
    }
    return goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
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
    return goal.__expanded ? goal.subGoals : goal.subGoals.slice(0, this.maxSubGoals);
  }

  toggleSubGoals(goal: Goal): void {
    goal.__expanded = !goal.__expanded;
  }

  getSubGoalSummary(goal: Goal): { done: number; total: number } {
    if (!goal.subGoals?.length) return { done: 0, total: 0 };
    const total = goal.subGoals.length;
    const done = goal.subGoals.filter((child) => this.hasAnyProgress(child)).length;
    return { done, total };
  }

  hasAnyProgress(goal: Goal): boolean {
    if (!goal) return false;
    if ((goal.current ?? 0) > 0) return true;
    if (!goal.subGoals?.length) return false;
    return goal.subGoals.some((child) => this.hasAnyProgress(child));
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
