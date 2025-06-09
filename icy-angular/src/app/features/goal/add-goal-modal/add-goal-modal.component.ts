import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-add-goal-modal',
  templateUrl: './add-goal-modal.component.html',
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class AddGoalModalComponent implements OnChanges {
  @Input() allGoals: any[] = [];
  @Output() submitGoal = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  selectedParentId: number | null = null;
  selectedSubParentId: number | null = null;
  flatGoals: any[] = [];

  goal: {
    name: string;
    description: string;
    target: number;
    parentId: number | null;
  } = {
    name: '',
    description: '',
    target: 0,
    parentId: null
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allGoals']) {
      this.flatGoals = this.flattenGoals(this.allGoals);
    }
  }

  flattenGoals(goals: any[]): any[] {
    const flat: any[] = [];
    for (const goal of goals) {
      flat.push(goal);
      if (goal.subGoals?.length) {
        flat.push(...this.flattenGoals(goal.subGoals));
      }
    }
    return flat;
  }

  get isFormValid(): boolean {
    return !!this.goal.name && this.goal.target > 0;
  }

  getRootGoals(): any[] {
    return this.flatGoals.filter(g => g.parentId === null);
  }

  getFilteredSubGoals(): any[] {
    return this.flatGoals.filter(g => g.parentId === this.selectedParentId);
  }

  submit() {
    this.goal.parentId = this.selectedSubParentId ?? this.selectedParentId ?? null;
    this.submitGoal.emit(this.goal);
  }

  closeModal() {
    this.close.emit();
  }
}
