import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { MiningSheet } from '../../../../core/services/mining/mining-sheet.service';

interface MaterialPieSlice {
  userId: string;
  username: string;
  totalScu: number;
  percent: number;
  startRatio: number;
  sweepRatio: number;
  color: string;
  ores: MiningSheet['summary']['userMaterials'][number]['ores'];
}

@Component({
  standalone: true,
  selector: 'app-mining-sheets-summary',
  imports: [CommonModule],
  templateUrl: './mining-sheets-summary.component.html',
  styleUrl: './mining-sheets-summary.component.css'
})
export class MiningSheetsSummaryComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) sheet!: MiningSheet;

  hoveredMaterialUserId: string | null = null;
  readonly materialPieCenter = 70;
  readonly materialPieRadius = 58;
  readonly materialPieCircumference = 2 * Math.PI * this.materialPieRadius;
  nowMs = Date.now();
  private remainingSecondsAnchorMs = Date.now();
  private timerHandle?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timerHandle = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sheet']) {
      this.remainingSecondsAnchorMs = Date.now();
      this.nowMs = this.remainingSecondsAnchorMs;
    }
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = undefined;
    }
  }

  trackMaterialSlice(_: number, slice: MaterialPieSlice): string {
    return slice.userId;
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR').format(value).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  }

  formatNegativeAmount(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return `-${this.formatNumber(Math.abs(value))}`;
  }

  formatSignedAmount(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    if (value === 0) {
      return '0';
    }
    const sign = value > 0 ? '+' : '-';
    return `${sign}${this.formatNumber(Math.abs(value))}`;
  }

  payoutTone(value: number | null | undefined): 'positive' | 'negative' | 'neutral' {
    if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
      return 'neutral';
    }
    return value > 0 ? 'positive' : 'negative';
  }

  valueHeatStyle(value: number | null | undefined, min: number, max: number): { [key: string]: string } {
    if (value === null || value === undefined || Number.isNaN(value) || max <= min) {
      return { color: '#e2e8f0' };
    }
    const clamped = Math.min(max, Math.max(min, value));
    const ratio = (clamped - min) / (max - min);
    const hue = Math.round(ratio * 120);
    return { color: `hsl(${hue} 88% 66%)` };
  }

  negativeCostStyle(value: number | null | undefined): { [key: string]: string } {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { color: '#e2e8f0' };
    }
    return { color: value > 0 ? '#f87171' : '#e2e8f0' };
  }

  signedHeatStyle(value: number | null | undefined, maxAbs: number): { [key: string]: string } {
    if (value === null || value === undefined || Number.isNaN(value) || maxAbs <= 0) {
      return { color: '#e2e8f0' };
    }
    const clamped = Math.max(-maxAbs, Math.min(maxAbs, value));
    const ratio = (clamped + maxAbs) / (2 * maxAbs);
    const hue = Math.round(ratio * 120);
    return { color: `hsl(${hue} 88% 66%)` };
  }

  maxSettlementPayoutAbs(summary: MiningSheet['summary'] | null | undefined): number {
    if (!summary?.settlements?.length) {
      return 0;
    }
    return summary.settlements
      .map((item) => Math.abs(item.payoutAuec ?? 0))
      .reduce((max, value) => Math.max(max, value), 0);
  }

  materialPieSlices(summary: MiningSheet['summary'] | null | undefined): MaterialPieSlice[] {
    const materials = summary?.userMaterials ?? [];
    if (!materials.length) {
      return [];
    }
    const sorted = [...materials].sort((left, right) => (right.totalScu ?? 0) - (left.totalScu ?? 0));
    const totals = sorted.map((item) => Math.max(0, Number(item.totalScu ?? 0)));
    const globalTotal = totals.reduce((sum, value) => sum + value, 0);
    const fallbackRatio = sorted.length > 0 ? 1 / sorted.length : 0;

    let cursor = 0;
    return sorted.map((item, index) => {
      const rawRatio = globalTotal > 0 ? totals[index] / globalTotal : fallbackRatio;
      const normalized = Math.max(0, Math.min(1, rawRatio));
      const sweepRatio = index === sorted.length - 1 ? Math.max(0, 1 - cursor) : normalized;
      const slice: MaterialPieSlice = {
        userId: item.userId,
        username: item.username,
        totalScu: totals[index],
        percent: sweepRatio * 100,
        startRatio: cursor,
        sweepRatio,
        color: this.sliceColor(index, sorted.length),
        ores: item.ores ?? []
      };
      cursor += sweepRatio;
      return slice;
    });
  }

  activeMaterialSliceFromSlices(slices: MaterialPieSlice[]): MaterialPieSlice | null {
    if (!slices.length) {
      return null;
    }
    if (!this.hoveredMaterialUserId) {
      return slices[0];
    }
    return slices.find((slice) => slice.userId === this.hoveredMaterialUserId) ?? slices[0];
  }

  activeMaterialSlicesForRender(slices: MaterialPieSlice[]): MaterialPieSlice[] {
    const active = this.activeMaterialSliceFromSlices(slices);
    return active ? [active] : [];
  }

  setHoveredMaterialUser(userId: string | null): void {
    this.hoveredMaterialUserId = userId;
  }

  materialPieStrokeDasharray(slice: MaterialPieSlice): string {
    const length = Math.max(0, Math.min(1, slice.sweepRatio)) * this.materialPieCircumference;
    return `${length} ${this.materialPieCircumference}`;
  }

  materialPieStrokeDashoffset(slice: MaterialPieSlice): number {
    return -Math.max(0, Math.min(1, slice.startRatio)) * this.materialPieCircumference;
  }

  longestRemainingSeconds(sheet: MiningSheet): number {
    const fromSummary = sheet.summary?.longestRemainingSeconds;
    if (fromSummary !== null && fromSummary !== undefined && Number.isFinite(fromSummary) && fromSummary >= 0) {
      const elapsedSeconds = Math.max(0, Math.floor((this.nowMs - this.remainingSecondsAnchorMs) / 1000));
      return Math.max(0, Math.floor(fromSummary) - elapsedSeconds);
    }

    const elapsedSeconds = Math.max(0, Math.floor((this.nowMs - this.remainingSecondsAnchorMs) / 1000));
    const fromJobs = (sheet.jobs ?? [])
      .map((job) => {
        if (job.remainingSeconds !== null && job.remainingSeconds !== undefined && Number.isFinite(job.remainingSeconds)) {
          return Math.max(0, Math.floor(job.remainingSeconds) - elapsedSeconds);
        }
        if (job.finishAt) {
          const finishTs = Date.parse(job.finishAt);
          if (!Number.isNaN(finishTs)) {
            return Math.max(0, Math.floor((finishTs - this.nowMs) / 1000));
          }
        }
        return null;
      })
      .filter((value): value is number => value !== null)
      .reduce((max, value) => Math.max(max, value), 0);
    return Math.max(0, fromJobs);
  }

  formatDuration(totalSeconds: number | null): string {
    if (totalSeconds === null || totalSeconds < 0 || !Number.isFinite(totalSeconds)) {
      return '-';
    }
    const seconds = Math.floor(totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map((item) => item.toString().padStart(2, '0')).join(':');
  }

  private sliceColor(index: number, total: number): string {
    if (total <= 1) {
      return 'hsl(120 78% 52%)';
    }
    const ratio = Math.max(0, Math.min(1, index / Math.max(1, total - 1)));
    const hue = Math.round(ratio * 120);
    return `hsl(${hue} 78% 54%)`;
  }
}
