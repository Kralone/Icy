
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MiningSheet } from '../../../../core/services/mining/mining-sheet.service';

@Component({
  standalone: true,
  selector: 'app-mining-sheets-history-panel',
  imports: [],
  templateUrl: './mining-sheets-history-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mining-sheets-history-panel.component.css'
})
export class MiningSheetsHistoryPanelComponent {
  @Input() historySheets: MiningSheet[] = [];
  expandedSheetId: string | null = null;
  panelExpanded = false;
  page = 1;
  readonly pageSize = 5;

  get pagedSheets(): MiningSheet[] {
    const start = (this.page - 1) * this.pageSize;
    return this.historySheets.slice(start, start + this.pageSize);
  }
  get pageCount(): number { return Math.max(1, Math.ceil(this.historySheets.length / this.pageSize)); }
  togglePanel(): void { this.panelExpanded = !this.panelExpanded; if (!this.panelExpanded) this.expandedSheetId = null; }
  setPage(page: number): void { this.page = Math.min(Math.max(1, page), this.pageCount); this.expandedSheetId = null; }

  toDisplayDate(isoDate: string): string {
    if (!isoDate) {
      return '-';
    }
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return isoDate;
    }
    return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  toggleSheet(sheetId: string): void {
    this.expandedSheetId = this.expandedSheetId === sheetId ? null : sheetId;
  }

  isExpanded(sheetId: string): boolean {
    return this.expandedSheetId === sheetId;
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR').format(value).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  }

  formatNegative(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return `-${this.formatNumber(Math.abs(value))}`;
  }
}
