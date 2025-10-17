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

  loading = false;
  progressWidth = '0%';

  constructor(private goalService: GoalService) {}

  ngOnChanges(): void {
    this.updateProgressBar();
  }

  ngAfterViewInit(): void {
    this.updateProgressBar();
  }

  /** 🔥 Gère l'animation fluide et la visibilité à 100% */
  private updateProgressBar(): void {
    const progress = this.calculateProgress(this.goal);

    // On force Angular à redessiner avant d'appliquer la nouvelle largeur
    requestAnimationFrame(() => {
      this.progressWidth = progress.toFixed(2) + '%';
    });
  }

  calculateProgress(goal: Goal): number {
    if (!goal || goal.target === 0) return 0;
    const ratio = (goal.current / goal.target) * 100;
    // clamp entre 0 et 100
    return Math.min(Math.max(ratio, 0), 100);
  }

  get sortedSubGoals(): Goal[] {
    if (!this.goal.subGoals) return [];
    return [...this.goal.subGoals].sort((a, b) => {
      const progressA = this.calculateProgress(a);
      const progressB = this.calculateProgress(b);
      const aDone = progressA >= 100;
      const bDone = progressB >= 100;
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      return progressA - progressB;
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
        this.goal.current = Math.max(0, Math.min(this.goal.target, this.goal.current + delta));
        this.loading = false;
        this.updateProgressBar(); // ✅ met à jour visuellement la largeur
      },
      error: (err) => {
        console.error('Erreur de mise à jour :', err);
        this.loading = false;
      },
    });
  }

  toggleChildrenVisibility(): void {
    this.showChildren = !this.showChildren;
  }
}
