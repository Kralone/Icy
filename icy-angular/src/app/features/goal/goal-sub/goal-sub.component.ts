import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {GoalService} from '../../../core/services/goal/goal.service';
import {Goal} from '../../../model/goal.model';


@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-sub.component.html',
})
export class GoalSubComponent {
  @Input() goal!: Goal;
  @Input() isAdmin = false;
  @Output() refresh = new EventEmitter<void>();

  loading = false;

  constructor(private goalService: GoalService) {}

  calculateProgress(goal: Goal): number {
    return goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
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

}
