import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MiningSheet } from '../../../../core/services/mining/mining-sheet.service';

@Component({
  standalone: true,
  selector: 'app-mining-sheets-history-panel',
  imports: [CommonModule],
  templateUrl: './mining-sheets-history-panel.component.html',
  styleUrl: './mining-sheets-history-panel.component.css'
})
export class MiningSheetsHistoryPanelComponent {
  @Input() historySheets: MiningSheet[] = [];
  expandedSheetId: string | null = null;

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
