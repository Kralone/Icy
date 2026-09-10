import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MiningSheet, MiningSheetSale } from '../../../../core/services/mining/mining-sheet.service';

interface SaleDeclarationEntry { sheetId: string; creditAuec: number; }

@Component({
  selector: 'app-mining-sheets-sales', standalone: true, imports: [FormsModule],
  templateUrl: './mining-sheets-sales.component.html',
  styleUrl: './mining-sheets-sales.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class MiningSheetsSalesComponent implements OnChanges {
  @Input({ required: true }) sheet!: MiningSheet;
  @Input() saleSheets: MiningSheet[] = [];
  @Input() selectedSheetId: string | null = null;
  @Input() currentUserId: string | null = null;
  @Input() currentUsername = '';
  @Input() declarationVersion = 0;
  @Input() saving = false;
  @Input() completedSaleEntries: SaleDeclarationEntry[] = [];
  @Output() declareSales = new EventEmitter<SaleDeclarationEntry[]>();

  selectedSheetIds = new Set<string>();
  declarationAmountInput = '';
  historyScope = 'current';
  private initialized = false;
  private submitted = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || changes['selectedSheetId']) {
      this.initialized = true;
      this.selectedSheetIds = new Set(this.openSaleSheets
        .filter(item => item.id === (this.selectedSheetId ?? this.sheet?.id)).map(item => item.id));
      this.declarationAmountInput = '';
    } else if (changes['saleSheets']) {
      const allowed = new Set(this.openSaleSheets.map(item => item.id));
      this.selectedSheetIds = new Set([...this.selectedSheetIds].filter(id => allowed.has(id)));
    }
    if (changes['completedSaleEntries'] && !changes['completedSaleEntries'].firstChange && this.completedSaleEntries.length) {
      const completed = this.completedSaleEntries.reduce((sum, entry) => sum + entry.creditAuec, 0);
      const remaining = Math.max(0, this.declarationAmountAuec - completed);
      this.declarationAmountInput = remaining ? String(remaining) : '';
      for (const entry of this.completedSaleEntries) this.selectedSheetIds.delete(entry.sheetId);
      this.submitted = false;
    }
    if (changes['declarationVersion'] && !changes['declarationVersion'].firstChange) {
      this.declarationAmountInput = '';
      this.submitted = false;
    }
    if (changes['saving'] && !this.saving) this.submitted = false;
  }

  get openSaleSheets(): MiningSheet[] {
    return this.saleSheets.filter(item => item.status === 'OPEN');
  }
  get selectedSaleSheets(): MiningSheet[] {
    return this.openSaleSheets.filter(item => this.selectedSheetIds.has(item.id));
  }
  get declarationAmountAuec(): number {
    const raw = this.declarationAmountInput.replace(/[\s\u00a0\u202f]/g, '');
    if (!/^\d+$/.test(raw)) return 0;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  }
  get totalWeight(): number {
    return this.selectedSaleSheets.reduce((sum, item) => sum + this.weight(item), 0);
  }
  get allocationRows(): {sheet: MiningSheet; creditAuec: number}[] {
    const sheets = this.selectedSaleSheets;
    const amount = this.declarationAmountAuec;
    if (!sheets.length || !amount) return sheets.map(sheet => ({sheet, creditAuec: 0}));
    // Integer largest remainders preserve the received total, even for large safe integers.
    const weights = sheets.map(sheet => BigInt(this.weight(sheet)));
    const estimatedWeight = weights.reduce((sum, value) => sum + value, 0n);
    const denominator = estimatedWeight || BigInt(sheets.length);
    const rows = sheets.map((sheet, index) => {
      const numerator = BigInt(amount) * (estimatedWeight ? weights[index] : 1n);
      return {sheet, index, creditAuec: Number(numerator / denominator), remainder: numerator % denominator};
    });
    let remaining = amount - rows.reduce((sum, row) => sum + row.creditAuec, 0);
    const byRemainder = [...rows].sort((a, b) => a.remainder === b.remainder
      ? (estimatedWeight ? a.sheet.sheetName.localeCompare(b.sheet.sheetName, 'fr', {sensitivity: 'base'}) : a.index - b.index)
      : a.remainder > b.remainder ? -1 : 1);
    for (const row of byRemainder) {
      if (remaining-- <= 0) break;
      row.creditAuec++;
    }
    return rows.map(({sheet, creditAuec}) => ({sheet, creditAuec}));
  }
  get allocatedEntries(): SaleDeclarationEntry[] {
    return this.allocationRows.filter(row => row.creditAuec > 0)
      .map(row => ({sheetId: row.sheet.id, creditAuec: row.creditAuec}));
  }
  get validationMessage(): string {
    if (!this.currentUserId) return 'Le vendeur connecté doit être identifié.';
    if (!this.selectedSaleSheets.length) return 'Sélectionnez au moins une fiche concernée par cette vente.';
    if (!this.declarationAmountAuec) return 'Saisissez un montant entier positif en aUEC.';
    return '';
  }
  get hasZeroAllocation(): boolean {
    return this.declarationAmountAuec > 0 && this.allocationRows.some(row => row.creditAuec === 0);
  }
  get historyRows(): {sheet: MiningSheet; sale: MiningSheetSale}[] {
    const unique = new Map(this.saleSheets.map(item => [item.id, item]));
    if (this.sheet) unique.set(this.sheet.id, this.sheet);
    return [...unique.values()]
      .filter(item => this.historyScope === 'all' || item.id === this.sheet?.id)
      .flatMap(sheet => (sheet.sales ?? []).map(sale => ({sheet, sale})))
      .sort((a, b) => (Date.parse(b.sale.declaredAt) || 0) - (Date.parse(a.sale.declaredAt) || 0));
  }
  get historyTotal(): number {
    return this.historyRows.reduce((sum, row) => sum + row.sale.creditAuec, 0);
  }
  weight(sheet: MiningSheet): number {
    const value = sheet.summary?.totalEstimatedAuec;
    return Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0;
  }
  isSheetSelected(id: string): boolean { return this.selectedSheetIds.has(id); }
  setSheetSelection(id: string, selected: boolean): void {
    if (this.saving || this.submitted || !this.openSaleSheets.some(item => item.id === id)) return;
    if (selected) this.selectedSheetIds.add(id);
    else this.selectedSheetIds.delete(id);
  }
  clearSelectedSheets(): void {
    if (!this.saving && !this.submitted) this.selectedSheetIds.clear();
  }
  onDeclarationAmountChange(value: string): void {
    if (!this.saving && !this.submitted) this.declarationAmountInput = value ?? '';
  }
  isDeclarationInvalid(): boolean { return !!this.validationMessage || this.submitted; }
  submitSales(): void {
    if (this.saving || this.isDeclarationInvalid()) return;
    this.submitted = true;
    this.declareSales.emit(this.allocatedEntries);
  }
  formatNumber(value: number | null | undefined): string {
    return value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('fr-FR').format(value);
  }
  toDisplayDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
  }
  toDisplayDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
