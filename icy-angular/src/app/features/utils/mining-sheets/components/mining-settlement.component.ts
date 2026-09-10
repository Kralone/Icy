import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MiningSheetSummary } from '../../../../core/services/mining/mining-sheet.service';

@Component({
  selector: 'app-mining-settlement',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './mining-settlement.component.html',
  styleUrl: './mining-settlement.component.css'
})
export class MiningSettlementComponent {
  @Input({ required: true }) summary!: MiningSheetSummary;
  mode: 'sales' | 'estimate' = 'sales';

  get rows() {
    return this.mode === 'sales' ? this.summary.saleSettlements : this.summary.settlements;
  }

  get revenue(): number {
    return this.mode === 'sales' ? this.summary.totalDeclaredSalesAuec : this.summary.totalEstimatedAuec;
  }

  get hasSales(): boolean {
    return this.summary.totalDeclaredSalesAuec > 0;
  }
}
