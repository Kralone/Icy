import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Goal } from '../../model/goal.model';
import { GoalService } from '../../core/services/goal/goal.service';
import { GoalSubComponent } from './goal-sub/goal-sub.component';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-goal',
  standalone: true,
  imports: [CommonModule, FormsModule, GoalSubComponent, LoadingOverlayComponent],
  templateUrl: './goal.component.html',
})
export class GoalComponent implements OnInit {

  goals: Goal[] = [];
  displayGoals: Goal[] = [];

  isAdmin = false;
  isLoading = true;

  // UI
  search = '';
  showCompleted = true;

  /** ✅ Etat d'expansion persistant (clé = goal.id) */
  expandedById: Record<number, boolean> = {};

  constructor(
    private goalService: GoalService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.reloadGoals();

    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  reloadGoals(): void {
    this.isLoading = true;
    this.goalService.getAllGoals().subscribe(goals => {
      this.goals = goals ?? [];
      this.isLoading = false;
      this.recomputeDisplay();
    });
  }

  clearSearch(): void {
    this.search = '';
    this.showCompleted = true;
    this.recomputeDisplay();
  }

  /** ✅ appelé par les GoalSub (toggle individuel) */
  onExpandedChange(e: { id: number; expanded: boolean }): void {
    this.expandedById[e.id] = e.expanded;
  }

  recomputeDisplay(): void {
    const roots = this.goals.filter(g => g.parentId === null);

    const prepared = roots
      .map(r => this.prepareTree(r))
      .filter((g): g is Goal => !!g);

    this.displayGoals = this.sortRootGoals(prepared);
  }

  /** Prépare l’arbre (recherche, filtre, tri des sous-goals) */
  private prepareTree(goal: Goal): Goal | null {
    if (!goal) return null;

    const cloned: Goal = {
      ...goal,
      // ✅ réinjecte l'état depuis la map (pas depuis les clones)
      __expanded: this.expandedById[goal.id],
      subGoals: goal.subGoals ? [...goal.subGoals] : [],
    };

    const children = (cloned.subGoals ?? [])
      .map(c => this.prepareTree(c))
      .filter((g): g is Goal => !!g);

    cloned.subGoals = this.sortGoalsStrict(children);

    if (!this.showCompleted && this.isDone(cloned)) {
      if ((cloned.subGoals?.length ?? 0) === 0) return null;
    }

    const q = this.normalizeText(this.search);
    if (!q) return cloned;

    const selfMatch =
      this.normalizeText(cloned.name).includes(q) ||
      this.normalizeText((cloned as any).description).includes(q);

    const childMatch = (cloned.subGoals?.length ?? 0) > 0;

    return (selfMatch || childMatch) ? cloned : null;
  }

  /** Terminé ? */
  private isDone(g: Goal): boolean {
    if ((g as any).completed !== undefined) return !!(g as any).completed;
    if (!g || (g as any).target <= 0) return false;
    return (g as any).current >= (g as any).target;
  }

  /** Sous-goals : non-finis → finis → alpha */
  private sortGoalsStrict(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => {
      const aDone = this.isDone(a);
      const bDone = this.isDone(b);

      if (aDone !== bDone) return aDone ? 1 : -1;

      return this.normalizeText(a.name).localeCompare(this.normalizeText(b.name));
    });
  }

  /** Main goals : pinned → non-finis → finis → alpha */
  private sortRootGoals(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => {
      const aPinned = !!a.pinned;
      const bPinned = !!b.pinned;

      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const aDone = this.isDone(a);
      const bDone = this.isDone(b);

      if (aDone !== bDone) return aDone ? 1 : -1;

      return this.normalizeText(a.name).localeCompare(this.normalizeText(b.name));
    });
  }

  private normalizeText(value: any): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  expandAll(): void {
    this.setExpandState(this.goals, true);
    this.recomputeDisplay();
  }

  collapseAll(): void {
    this.setExpandState(this.goals, false);
    this.recomputeDisplay();
  }

  private setExpandState(goals: Goal[], state: boolean): void {
    for (const g of goals) {
      this.expandedById[g.id] = state;
      if (g.subGoals?.length) {
        this.setExpandState(g.subGoals, state);
      }
    }
  }
}
