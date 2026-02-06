import { Component, EventEmitter, Input, Output, OnChanges, AfterViewInit, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalService } from '../../../core/services/goal/goal.service';
import { Goal } from '../../../model/goal.model';

@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-sub.component.html',
})
export class GoalSubComponent implements OnChanges, AfterViewInit, DoCheck {
  @Input() goal!: Goal;
  @Input() isAdmin = false;
  @Input() depth = 0;
  @Input() showChildren = true;
  @Input() parentCompleted = false;

  @Output() refresh = new EventEmitter<void>();
  @Output() expandedChange = new EventEmitter<{ id: number; expanded: boolean }>();
  @Output() progressChange = new EventEmitter<void>();

  loading = false;
  progressWidth = '0%';
  progressValue = 0;
  progressLabelLeft = 0;
  progressLabelAlign: 'left' | 'center' | 'right' = 'center';
  private hasAnimated = false;
  private lastGoalId: number | null = null;
  private lastTotals: { current: number; target: number } | null = null;

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

  ngDoCheck(): void {
    if (!this.goal) return;
    const totals = this.getTotalProgress(this.goal);
    if (!this.lastTotals || totals.current !== this.lastTotals.current || totals.target !== this.lastTotals.target) {
      this.updateProgressBar();
    }
  }

  private updateProgressBar(): void {
    const totals = this.getTotalProgress(this.goal);
    this.lastTotals = { current: totals.current, target: totals.target };
    const progress = totals.target === 0 ? 0 : (totals.current / totals.target) * 100;
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

  isDone(goal: Goal): boolean {
    if (!goal) return false;
    if ((goal as any).completed === true) return true;
    const total = this.getTotalProgress(goal);
    if (total.target <= 0) return false;
    return total.current >= total.target;
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
        this.progressChange.emit();
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

  onChildRefresh(): void {
    this.updateProgressBar();
    this.refresh.emit();
  }

  onChildProgress(): void {
    this.updateProgressBar();
    this.progressChange.emit();
  }
}
