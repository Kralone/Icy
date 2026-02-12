import { Component, EventEmitter, Input, Output, OnChanges, AfterViewInit, DoCheck, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalService } from '../../../core/services/goal/goal.service';
import { Goal } from '../../../model/goal.model';
import { GoalParticipation } from '../../../model/goal-participation.model';
import { GoalParticipationSummary } from '../../../model/goal-participation-summary.model';

@Component({
  selector: 'app-goal-sub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './goal-sub.component.html',
})
export class GoalSubComponent implements OnChanges, AfterViewInit, DoCheck {
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
  progressWidth = '0%';
  progressValue = 0;
  progressLabelLeft = 0;
  progressLabelAlign: 'left' | 'center' | 'right' = 'center';
  progressLabelLeftValue = '0%';
  progressLabelTransform = 'translateX(0)';
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
  hoveredCombinedIndex: number | null = null;
  tooltipVisible = false;
  tooltipX = 0;
  tooltipLeftPercent = 0;
  tooltipUser: GoalParticipationSummary | null = null;
  tooltipColor = '#22d3ee';
  @ViewChild('combinedTooltip') combinedTooltipRef?: ElementRef<HTMLDivElement>;
  private hasAnimated = false;
  private lastGoalId: number | null = null;
  private lastTotals: { current: number; target: number } | null = null;

  constructor(private goalService: GoalService) {}

  ngOnChanges(): void {
    if (this.goal?.id !== this.lastGoalId) {
      this.lastGoalId = this.goal?.id ?? null;
      this.hasAnimated = false;
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

  ngAfterViewInit(): void {
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
    this.lastTotals = { current: totals.current, target: totals.target };
    const progress = totals.target === 0 ? 0 : (totals.current / totals.target) * 100;
    const clamped = Math.min(100, Math.max(0, progress));
    const labelLeft = clamped <= 6 ? 0 : clamped >= 94 ? 100 : clamped;
    this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
    const widthValue = clamped.toFixed(2) + '%';
    if (this.depth > 0) {
      this.progressLabelLeftValue = clamped <= 0 ? '2%' : widthValue;
      this.progressLabelTransform = 'translateX(-100%)';
    } else {
      this.progressLabelLeftValue = `${labelLeft}%`;
      this.progressLabelTransform = this.getLabelTransform();
    }

    if (this.disableAnimation) {
      this.progressWidth = widthValue;
      this.progressValue = clamped;
      this.progressLabelLeft = labelLeft;
      this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
      this.hasAnimated = true;
      return;
    }

    if (!this.hasAnimated) {
      this.progressWidth = '0%';
      this.progressValue = 0;
      this.progressLabelLeft = 4;
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.progressWidth = widthValue;
          this.progressValue = clamped;
          this.progressLabelLeft = labelLeft;
          this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
          if (this.depth > 0) {
            this.progressLabelLeftValue = clamped <= 0 ? '2%' : widthValue;
            this.progressLabelTransform = 'translateX(-100%)';
          } else {
            this.progressLabelLeftValue = `${labelLeft}%`;
            this.progressLabelTransform = this.getLabelTransform();
          }
          this.hasAnimated = true;
        }, 350);
      });
      return;
    }

    this.progressWidth = widthValue;
    this.progressValue = clamped;
    this.progressLabelLeft = labelLeft;
    this.progressLabelAlign = clamped <= 6 ? 'left' : clamped >= 94 ? 'right' : 'center';
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
    if (!goal.subGoals?.length) {
      return { current: goal.current ?? 0, target: goal.target ?? 0 };
    }
    return goal.subGoals.reduce(
      (acc, child) => {
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
    return !goal?.subGoals || goal.subGoals.length === 0;
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
        console.error('Erreur de mise à jour :', err);
        this.loading = false;
      },
    });
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
    this.goalService.getParticipations(this.goal.id).subscribe({
      next: (participations) => {
        this.participations = participations ?? [];
        this.participationsLoaded = true;
        this.participationsLoading = false;
      },
      error: (err) => {
        console.error('Erreur de chargement des participations :', err);
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
        console.error('Erreur de chargement des participations globales :', err);
        this.combinedLoading = false;
      },
    });
  }

  formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.max(0, value).toFixed(0)}%`;
  }

  getLabelTransform(): string {
    if (this.progressLabelAlign === 'center') return 'translateX(-50%)';
    if (this.progressLabelAlign === 'right') return 'translateX(-100%)';
    return 'translateX(0)';
  }

  setCombinedHover(index: number | null): void {
    this.hoveredCombinedIndex = index;
  }

  showCombinedTooltip(user: GoalParticipationSummary, color: string, index: number): void {
    this.tooltipVisible = true;
    this.tooltipUser = user;
    this.tooltipColor = color;
    const width = this.getCombinedPercent(user);
    const start = this.getCombinedStartPercent(index);
    const center = start + width / 2;
    this.tooltipLeftPercent = Math.max(0, Math.min(100, (this.progressValue * center) / 100));
  }

  moveCombinedTooltip(event: MouseEvent): void {
    return;
  }

  hideCombinedTooltip(): void {
    this.tooltipVisible = false;
    this.tooltipUser = null;
    this.tooltipColor = '#22d3ee';
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
}
