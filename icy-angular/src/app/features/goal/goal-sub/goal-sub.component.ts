import { Component, EventEmitter, Input, Output, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalService } from '../../../core/services/goal/goal.service';
import { Goal } from '../../../model/goal.model';

@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-sub.component.html',
})
export class GoalSubComponent implements OnChanges, AfterViewInit {
  @Input() goal!: Goal;
  @Input() isAdmin = false;
  @Input() depth = 0;
  @Input() showChildren = true;

  @Output() refresh = new EventEmitter<void>();
  @Output() expandedChange = new EventEmitter<{ id: number; expanded: boolean }>();

  loading = false;
  progressWidth = '0%';
  progressValue = 0;
  progressLabelLeft = 0;
  progressLabelAlign: 'left' | 'center' | 'right' = 'center';
  private hasAnimated = false;
  private lastGoalId: number | null = null;

  constructor(private goalService: GoalService) {}

  ngOnChanges(): void {
    if (this.goal?.id !== this.lastGoalId) {
      this.lastGoalId = this.goal?.id ?? null;
      this.hasAnimated = false;
    }
    const expanded = (this.goal as any).__expanded;
    if (expanded !== undefined) {
      this.showChildren = expanded;
    }
    this.updateProgressBar();
  }

  ngAfterViewInit(): void {
    this.updateProgressBar();
  }

  private updateProgressBar(): void {
    const progress = this.calculateProgress(this.goal);
    const clamped = Math.min(100, Math.max(0, progress));
    const labelLeft = clamped <= 6 ? 0 : clamped >= 94 ? 100 : clamped;
    this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';

    if (!this.hasAnimated) {
      this.progressWidth = '0%';
      this.progressValue = 0;
      this.progressLabelLeft = 4;
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.progressWidth = clamped.toFixed(2) + '%';
          this.progressValue = clamped;
          this.progressLabelLeft = labelLeft;
          this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
          this.hasAnimated = true;
        }, 350);
      });
      return;
    }

    this.progressWidth = clamped.toFixed(2) + '%';
    this.progressValue = clamped;
    this.progressLabelLeft = labelLeft;
    this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
  }

  calculateProgress(goal: Goal): number {
    if (!goal) return 0;
    if (goal.subGoals?.length) {
      const summary = this.getSubGoalSummary(goal);
      if (summary.total === 0) return 0;
      return Math.min(Math.max((summary.done / summary.total) * 100, 0), 100);
    }
    if (goal.target === 0) return 0;
    const ratio = (goal.current / goal.target) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  }

  isDone(goal: Goal): boolean {
    if ((goal as any).completed !== undefined) return !!(goal as any).completed;
    if (!goal) return false;
    if (goal.subGoals?.length) {
      const summary = this.getSubGoalSummary(goal);
      return summary.total > 0 && summary.done === summary.total;
    }
    if (goal.target <= 0) return false;
    return (goal.current ?? 0) >= (goal.target ?? 0);
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

  private normalizeText(value: any): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  get sortedSubGoals(): Goal[] {
    if (!this.goal?.subGoals) return [];
    return [...this.goal.subGoals].sort((a, b) => {
      const aDone = this.isDone(a);
      const bDone = this.isDone(b);

      if (aDone !== bDone) return aDone ? 1 : -1;

      const an = this.normalizeText(a.name);
      const bn = this.normalizeText(b.name);

      return an.localeCompare(bn);
    });
  }

  togglePinned(): void {
    this.goalService.togglePinned(this.goal.id).subscribe(() => this.refresh.emit());
  }

  deleteGoal(): void {
    this.goalService.deleteGoal(this.goal.id).subscribe(() => this.refresh.emit());
  }

  increment(goalId: number, delta: number): void {
    if (this.loading) return;
    this.loading = true;

    this.goalService.incrementGoal(goalId, delta).subscribe({
      next: () => {
        this.goal.current = Math.max(0, Math.min(this.goal.target, (this.goal.current ?? 0) + delta));
        this.loading = false;
        this.updateProgressBar();
      },
      error: (err) => {
        console.error('Erreur de mise à jour :', err);
        this.loading = false;
      },
    });
  }

  toggleChildrenVisibility(): void {
    this.showChildren = !this.showChildren;
    this.expandedChange.emit({ id: this.goal.id, expanded: this.showChildren });
  }
}
