import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalService } from '../../../core/services/goal/goal.service';
import { Goal } from '../../../model/goal.model';

@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-sub.component.html',
})
export class GoalSubComponent {
  @Input() goal!: Goal;
  @Input() isAdmin = false;
  @Input() depth = 0;
  @Output() refresh = new EventEmitter<void>();
  @Input() showChildren = true;

  loading = false;

  constructor(private goalService: GoalService) {}

  calculateProgress(goal: Goal): number {
    if (!goal || goal.target === 0) return 0;
    return Math.min(100, (goal.current / goal.target) * 100);
  }

  get sortedSubGoals(): Goal[] {
    if (!this.goal.subGoals) return [];

    return [...this.goal.subGoals].sort((a, b) => {
      const progressA = this.calculateProgress(a);
      const progressB = this.calculateProgress(b);

      // Objectifs à 100% vont toujours en bas
      const aIsDone = progressA === 100;
      const bIsDone = progressB === 100;

      if (aIsDone && !bIsDone) return 1;
      if (!aIsDone && bIsDone) return -1;

      return progressA - progressB;
    });
  }


  togglePinned() {
    this.goalService.togglePinned(this.goal.id).subscribe(() => this.refresh.emit());
  }

  deleteGoal() {
    this.goalService.deleteGoal(this.goal.id).subscribe(() => this.refresh.emit());
  }

  increment(goalId: number, delta: number) {
    if (this.loading) return;

    this.loading = true;
    this.goalService.incrementGoal(goalId, delta).subscribe({
      next: () => {
        this.goal.current += delta;
        this.loading = false;
      },
      error: (err) => {
        console.error("Erreur de mise à jour :", err);
        this.loading = false;
      }
    });
  }

  toggleChildrenVisibility() {
    this.showChildren = !this.showChildren;
  }
}
