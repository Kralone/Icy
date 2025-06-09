import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Goal} from '../../model/goal.model';
import {GoalService} from '../../core/services/goal/goal.service';
import {GoalSubComponent} from './goal-sub/goal-sub.component';
import {LoadingOverlayComponent} from '../../shared/loading-overlay/loading-overlay.component';
import {AddGoalModalComponent} from './add-goal-modal/add-goal-modal.component';


@Component({
  selector: 'app-goal',
  standalone: true,
  imports: [CommonModule, GoalSubComponent, GoalSubComponent, LoadingOverlayComponent, AddGoalModalComponent],
  templateUrl: './goal.component.html',
})
export class GoalComponent implements OnInit {
  goals: Goal[] = [];
  isAdmin = true; // à adapter selon ton auth
  isLoading = true;

  showAddModal = false;
  selectedParentId: number | null = null;

  constructor(private goalService: GoalService) {}

  ngOnInit(): void {
    this.goalService.getAllGoals().subscribe(goals => {
      this.goals = this.sortGoals(goals);
      this.isLoading = false;
    });
  }

  sortGoals(goals: Goal[]): Goal[] {
    return goals
      .filter(g => g.parentId === null)
      .sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return this.calculateProgress(b) - this.calculateProgress(a);
      });
  }

  calculateProgress(goal: Goal): number {
    return goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
  }

  handleAddGoal(data: any) {
    this.goalService.addGoal(data).subscribe(() => this.loadGoals());
  }

  loadGoals() {
    this.goalService.getAllGoals().subscribe();
  }
}
