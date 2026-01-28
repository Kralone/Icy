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

  constructor(private goalService: GoalService) {}

  ngOnChanges(): void {
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
    requestAnimationFrame(() => {
      this.progressWidth = progress.toFixed(2) + '%';
    });
  }

  calculateProgress(goal: Goal): number {
    if (!goal || goal.target === 0) return 0;
    const ratio = (goal.current / goal.target) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  }

  isDone(goal: Goal): boolean {
    if ((goal as any).completed !== undefined) return !!(goal as any).completed;
    if (!goal || goal.target <= 0) return false;
    return (goal.current ?? 0) >= (goal.target ?? 0);
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
