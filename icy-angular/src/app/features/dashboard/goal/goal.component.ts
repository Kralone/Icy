import { Component, OnInit } from '@angular/core';
import { Goal } from '../../../model/goal.model';
import { GoalService } from '../../../core/services/goal/goal.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-goal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal.component.html',
})
export class GoalComponent implements OnInit {
  goals: Goal[] = [];
  isLoading = true;

  constructor(private goalService: GoalService) {}

  ngOnInit(): void {
    this.goalService.getPinnedGoal().subscribe({
      next: (goal) => {
        this.goals = goal ? [goal] : [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  calculateProgress(goal: Goal): number {
    return goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  }
}
