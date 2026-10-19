import { Component, EventEmitter, Input, Output, OnChanges, DoCheck, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../../core/services/goal/goal.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { Goal, GoalMember } from '../../../model/goal.model';
import { GoalParticipation } from '../../../model/goal-participation.model';
import { GoalParticipationSummary } from '../../../model/goal-participation-summary.model';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';

@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule, FormsModule, AsyncStateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './goal-sub.component.html',
  styleUrl: './goal-sub.component.css',
})
export class GoalSubComponent implements OnChanges, DoCheck {
  @Input() goal!: Goal;
  @Input() isAdmin = false;
  @Input() depth: number = 0;
  @Input() showChildren = true;
  @Input() parentCompleted = false;
  @Input() disableAnimation = false;

  @Output() refresh = new EventEmitter<void>();
  @Output() expandedChange = new EventEmitter<{ id: number; expanded: boolean }>();
  @Output() progressChange = new EventEmitter<{ goalId: number; current: number; delta: number }>();

  loading = false;
  actionError = '';
  participationsError = '';
  combinedError = '';
  progressWidth = '0%';
  progressValue = 0;
  participations: GoalParticipation[] = [];
  participationsLoaded = false;
  participationsLoading = false;
  showParticipations = false;
  combinedParticipations: GoalParticipationSummary[] = [];
  combinedSegments: GoalParticipationSummary[] = [];
  combinedLoaded = false;
  combinedLoading = false;
  showCombinedStack = false;
  combinedTotalDelta = 0;
  batchAmount = 1;
  membershipLoading = false;
  membershipError = '';
  readonly currentUserId: string | null;
  private lastGoalId: number | null = null;
  private lastTotals: { current: number; target: number } | null = null;

  constructor(private goalService: GoalService, authService: AuthService) {
    let userId: string | null = null;
    try {
      userId = authService.getUserIdFromToken();
    } catch {
      userId = null;
    }
    this.currentUserId = userId;
  }

  get members(): GoalMember[] {
    return this.goal?.members ?? [];
  }

  get isMember(): boolean {
    return !!this.currentUserId && this.members.some(m => m.userId === this.currentUserId);
  }

  toggleMembership(): void {
    if (!this.currentUserId || this.membershipLoading) return;
    const leaving = this.isMember;
    this.membershipError = '';
    this.membershipLoading = true;
    const request = leaving ? this.goalService.leaveGoal(this.goal.id) : this.goalService.joinGoal(this.goal.id);
    request.subscribe({
      next: () => {
        this.membershipLoading = false;
        this.goal.members = leaving
          ? this.members.filter(m => m.userId !== this.currentUserId)
          : [...this.members, this.buildCurrentMember()];
      },
      error: () => {
        this.membershipLoading = false;
        this.membershipError = leaving
          ? 'Impossible de retirer votre participation.'
          : 'Impossible d’enregistrer votre participation.';
      },
    });
  }

  /** Placeholder affiché jusqu’au rechargement par WebSocket, qui renvoie le nom et l’avatar réels. */
  private buildCurrentMember(): GoalMember {
    return { userId: this.currentUserId!, username: 'Vous', avatarUrl: null, joinedAt: new Date().toISOString() };
  }

  ngOnChanges(): void {
    if (this.goal?.id !== this.lastGoalId) {
      this.lastGoalId = this.goal?.id ?? null;
      this.participations = [];
      this.participationsLoaded = false;
      this.showParticipations = false;
      this.combinedParticipations = [];
      this.combinedLoaded = false;
      this.showCombinedStack = false;
    }
    const expanded = (this.goal as any).__expanded;
    if (expanded !== undefined) {
      this.showChildren = expanded;
    }
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
    this.lastTotals = totals;
    const progress = totals.target === 0 ? 0 : (totals.current / totals.target) * 100;
    this.progressValue = Math.min(100, Math.max(0, progress));
    this.progressWidth = this.progressValue.toFixed(2) + '%';
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
    const allChildren = (goal as any).__allSubGoals ?? goal.subGoals;
    if (!allChildren?.length) {
      return { current: goal.current ?? 0, target: goal.target ?? 0 };
    }
    return allChildren.reduce(
      (acc: { current: number; target: number }, child: Goal) => {
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

  isLeaf(goal: Goal): boolean {
    return !(goal?.__allSubGoals ?? goal?.subGoals)?.length;
  }

  getInitial(value?: string | null): string {
    const text = (value ?? '').trim();
    if (!text) return '?';
    return text.charAt(0).toUpperCase();
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
    if (!this.isAdmin || this.loading || this.goal.pinned) return;
    this.actionError = '';
    this.loading = true;
    this.goalService.togglePinned(this.goal.id).subscribe({
      next: () => { this.loading = false; this.refresh.emit(); },
      error: () => { this.loading = false; this.actionError = 'Impossible d’épingler cet objectif.'; },
    });
  }

  deleteGoal(): void {
    if (!this.isAdmin || this.loading || !confirm('Supprimer « ' + this.goal.name + ' » et ses sous-objectifs ?')) return;
    this.actionError = '';
    this.loading = true;
    this.goalService.deleteGoal(this.goal.id).subscribe({
      next: () => { this.loading = false; this.refresh.emit(); },
      error: () => { this.loading = false; this.actionError = 'Impossible de supprimer cet objectif.'; },
    });
  }

  increment(goalId: number, delta: number): void {
    if (this.loading || (!this.isAdmin && this.parentCompleted)) return;
    this.actionError = '';
    this.loading = true;

    this.goalService.incrementGoal(goalId, delta).subscribe({
      next: () => {
        const nextCurrent = Math.max(0, Math.min(this.goal.target, (this.goal.current ?? 0) + delta));
        this.goal.current = nextCurrent;
        this.loading = false;
        this.updateProgressBar();
        this.progressChange.emit({ goalId, current: nextCurrent, delta });
        if (this.showParticipations) {
          this.loadParticipations();
        }
        if (this.showCombinedStack) {
          this.loadCombinedParticipations();
        }
      },
      error: (err) => {
        this.actionError = 'La contribution n’a pas été enregistrée. Réessayez.';
        this.loading = false;
      },
    });
  }

  addBatch(): void {
    const amount = Math.floor(Number(this.batchAmount));
    if (!Number.isFinite(amount) || amount < 1) {
      this.batchAmount = 1;
      return;
    }
    const remaining = Math.max(0, (this.goal.target ?? 0) - (this.goal.current ?? 0));
    this.increment(this.goal.id, Math.min(amount, remaining));
    this.batchAmount = 1;
  }

  toggleChildrenVisibility(): void {
    this.showChildren = !this.showChildren;
    this.expandedChange.emit({ id: this.goal.id, expanded: this.showChildren });
  }

  onChildRefresh(): void {
    this.updateProgressBar();
    this.refresh.emit();
  }

  onChildProgress(change: { goalId: number; current: number; delta: number }): void {
    this.updateProgressBar();
    this.progressChange.emit(change);
    if (this.showCombinedStack) {
      this.loadCombinedParticipations();
    }
  }

  toggleParticipations(): void {
    this.showParticipations = !this.showParticipations;
    if (this.showParticipations && !this.participationsLoaded) {
      this.loadParticipations();
    }
  }

  loadParticipations(): void {
    if (!this.goal?.id) return;
    this.participationsLoading = true;
    this.participationsError = '';
    this.goalService.getParticipations(this.goal.id).subscribe({
      next: (participations) => {
        this.participations = participations ?? [];
        this.participationsLoaded = true;
        this.participationsLoading = false;
      },
      error: (err) => {
        this.participationsError = 'Impossible de charger l’historique des contributions.';
        this.participationsLoading = false;
      },
    });
  }

  toggleCombinedStack(): void {
    this.showCombinedStack = !this.showCombinedStack;
    if (this.showCombinedStack && !this.combinedLoaded) {
      this.loadCombinedParticipations();
    }
  }

  loadCombinedParticipations(): void {
    if (!this.goal?.id) return;
    this.combinedLoading = true;
    this.combinedError = '';
    this.goalService.getCombinedParticipations(this.goal.id).subscribe({
      next: (participations) => {
        this.combinedParticipations = participations ?? [];
        this.combinedSegments = this.combinedParticipations.filter((p) => (p?.totalDelta ?? 0) > 0);
        this.combinedTotalDelta = this.combinedSegments.reduce(
          (sum, p) => sum + (p.totalDelta ?? 0),
          0
        );
        this.combinedLoaded = true;
        this.combinedLoading = false;
      },
      error: (err) => {
        this.combinedError = 'Impossible de charger les contributions.';
        this.combinedLoading = false;
      },
    });
  }

  formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.max(0, value).toFixed(0)}%`;
  }

  getSegmentColor(index: number): string {
    const palette = [
      '#22d3ee',
      '#34d399',
      '#60a5fa',
      '#f59e0b',
      '#f472b6',
      '#a78bfa',
      '#f97316',
      '#4ade80',
    ];
    return palette[index % palette.length];
  }

  getSegmentWidth(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  getCombinedPercent(user: GoalParticipationSummary): number {
    const total = this.combinedTotalDelta;
    if (!Number.isFinite(total) || total <= 0) return 0;
    const delta = Math.max(0, user?.totalDelta ?? 0);
    return Math.max(0, Math.min(100, (delta * 100) / total));
  }

  getCombinedStartPercent(index: number): number {
    if (!Number.isFinite(index) || index <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < index && i < this.combinedSegments.length; i += 1) {
      acc += this.getCombinedPercent(this.combinedSegments[i]);
    }
    return acc;
  }

  formatDelta(delta: number): string {
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  getParticipationPercent(p: GoalParticipation): number {
    const current = this.goal?.current ?? 0;
    if (current <= 0) return 0;
    const raw = (p.delta * 100) / current;
    return Math.max(0, Math.min(100, raw));
  }

  trackByGoalId(_: number, goal: Goal): number {
    return goal.id;
  }
}
