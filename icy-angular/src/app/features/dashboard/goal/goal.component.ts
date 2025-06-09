import { Component, OnInit } from '@angular/core';
import {Goal} from '../../../model/goal.model';
import {GoalService} from '../../../core/services/goal/goal.service';
import {CommonModule} from '@angular/common';

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
    this.goalService.getAllGoals().subscribe({
      next: (goals) => {
        this.goals = this.sortByProgress(goals);
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

  sortByProgress(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => {
      const progressA = this.calculateProgress(a);
      const progressB = this.calculateProgress(b);

      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return progressB - progressA;
    });
  }
}
