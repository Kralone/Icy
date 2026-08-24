
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MiningSheet,
  MiningSheetSale,
  MiningSheetSaleTransfer,
  MiningSheetSettlement
} from '../../../../core/services/mining/mining-sheet.service';

interface SaleDeclarationEntry {
  sheetId: string;
  creditAuec: number;
}

interface SalePreviewPayout {
  userId: string;
  username: string;
  amountAuec: number;
}

interface SaleSankeyNode {
  id: string;
  label: string;
  side: 'SOURCE' | 'MIDDLE' | 'TARGET';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  valueAuec: number;
}

interface SaleSankeyLink {
  id: string;
  segment: 'LEFT' | 'RIGHT';
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  amountAuec: number;
  path: string;
  color: string;
  opacity: number;
  valueLabelX: number;
  valueLabelY: number;
  valueLabelAnchor: 'start' | 'end';
}

interface SaleSankeyDiagram {
  width: number;
  height: number;
  totalAuec: number;
  nodes: SaleSankeyNode[];
  links: SaleSankeyLink[];
}

interface SaleSankeyBuildOptions {
  sourceUserId: string | null;
  sourceUsername: string | null;
  historicalSaleIdBySheetId?: Map<string, string>;
}

type SaleGroupSortKey = 'LAST_DEPOSIT' | 'SHEET_NAME' | 'TOTAL_DECLARED' | 'TOTAL_TO_REVERSE';
type SaleGroupSortDirection = 'ASC' | 'DESC';

interface SaleSheetGroupRow {
  sheet: MiningSheet;
  lastDepositAt: string | null;
  depositsCount: number;
  beneficiariesCount: number;
  totalDeclaredAuec: number;
  totalToReverseAuec: number;
}

@Component({
  selector: 'app-mining-sheets-sales',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mining-sheets-sales.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mining-sheets-sales.component.css'
})
export class MiningSheetsSalesComponent implements OnChanges {
  @Input({ required: true }) sheet!: MiningSheet;
  @Input() saleSheets: MiningSheet[] = [];
  @Input() selectedSheetId: string | null = null;
  @Input() currentUserId: string | null = null;
  @Input() currentUsername = '';
  @Input() declarationVersion = 0;
  @Input() saving = false;

  @Output() declareSales = new EventEmitter<SaleDeclarationEntry[]>();

  selectedSheetIds = new Set<string>();
  selectedSankeySheetIds = new Set<string>();
  declarationAmountInput = '';
  groupSearchInput = '';
  groupSortKey: SaleGroupSortKey = 'LAST_DEPOSIT';
  groupSortDirection: SaleGroupSortDirection = 'DESC';
  focusedGroupSheetId: string | null = null;
  private sankeySelectionTouched = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['saleSheets'] || changes['selectedSheetId']) {
      this.pruneSelection();
      this.applyDefaultSelection();
      this.pruneSankeySelection();
      this.applyDefaultSankeySelection();
    }
    if (changes['declarationVersion'] && !changes['declarationVersion'].firstChange) {
      this.declarationAmountInput = '';
    }
  }

  get selectedSaleSheets(): MiningSheet[] {
    return this.openSaleSheets.filter((saleSheet) => this.selectedSheetIds.has(saleSheet.id));
  }

  get selectedSankeySheets(): MiningSheet[] {
    return this.openSaleSheets.filter((saleSheet) => this.selectedSankeySheetIds.has(saleSheet.id));
  }

  get openSaleSheets(): MiningSheet[] {
    return this.saleSheets.filter((saleSheet) => saleSheet.status === 'OPEN');
  }

  get visibleSaleGroupRows(): SaleSheetGroupRow[] {
    const query = this.normalizeSearch(this.groupSearchInput);
    const rows = this.openSaleSheets
      .map((saleSheet) => this.toSaleGroupRow(saleSheet))
      .filter((row) => this.matchesGroupSearch(row, query));
    rows.sort((left, right) => this.compareGroupRows(left, right));
    return rows;
  }

  get effectiveFocusedGroupSheetId(): string | null {
    const rows = this.visibleSaleGroupRows;
    if (!rows.length) {
      return null;
    }
    if (this.focusedGroupSheetId && rows.some((row) => row.sheet.id === this.focusedGroupSheetId)) {
      return this.focusedGroupSheetId;
    }
    return rows[0].sheet.id;
  }

  get displayedSaleGroupRows(): SaleSheetGroupRow[] {
    const rows = this.visibleSaleGroupRows;
    const focusedId = this.effectiveFocusedGroupSheetId;
    if (!focusedId) {
      return [];
    }
    return rows.filter((row) => row.sheet.id === focusedId);
  }

  get declarationAmountAuec(): number {
    return this.parsePositiveInteger(this.declarationAmountInput);
  }

  get allocatedEntries(): SaleDeclarationEntry[] {
    return this.allocateDeclarationAcrossSelectedSheets(this.declarationAmountAuec);
  }

  get plannedSheetsCount(): number {
    return this.allocatedEntries.length;
  }

  get plannedTotalAuec(): number {
    return this.allocatedEntries.reduce((sum, entry) => sum + entry.creditAuec, 0);
  }

  get sankeyDiagram(): SaleSankeyDiagram | null {
    return this.buildGlobalDepositsSankeyDiagram(this.selectedSankeySheets);
  }

  get sankeyScopeLabel(): string {
    const total = this.openSaleSheets.length;
    const selected = this.selectedSankeySheets.length;
    if (total <= 0) {
      return '0 fiche';
    }
    if (selected === total) {
      return 'toutes les fiches ouvertes';
    }
    return `${selected} fiche(s) selectionnee(s)`;
  }

  get sankeyEmptyMessage(): string {
    if (!this.openSaleSheets.length) {
      return 'Aucune fiche ouverte n\'est disponible pour le diagramme.';
    }
    if (!this.selectedSankeySheets.length) {
      return 'Selectionne au moins une fiche pour afficher le diagramme.';
    }
    return 'Aucun depot declare sur les fiches selectionnees pour le moment.';
  }

  trackSale(_: number, sale: MiningSheetSale): string {
    return sale.id;
  }

  trackSheet(_: number, saleSheet: MiningSheet): string {
    return saleSheet.id;
  }

  trackSaleGroupRow(_: number, row: SaleSheetGroupRow): string {
    return row.sheet.id;
  }

  trackSettlement(_: number, settlement: MiningSheetSettlement): string {
    return settlement.userId;
  }

  trackTransfer(_: number, transfer: MiningSheetSaleTransfer): string {
    return `${transfer.fromUserId}-${transfer.toUserId}-${transfer.amountAuec}`;
  }

  trackSankeyNode(_: number, node: SaleSankeyNode): string {
    return node.id;
  }

  trackSankeyLink(_: number, link: SaleSankeyLink): string {
    return link.id;
  }

  saleSheetName(sheetId: string): string {
    return this.saleSheets.find((saleSheet) => saleSheet.id === sheetId)?.sheetName ?? sheetId;
  }

  isSheetSelected(sheetId: string): boolean {
    return this.selectedSheetIds.has(sheetId);
  }

  setSheetSelection(sheetId: string, selected: boolean): void {
    if (!sheetId) {
      return;
    }
    if (selected) {
      this.selectedSheetIds.add(sheetId);
      return;
    }
    this.selectedSheetIds.delete(sheetId);
  }

  isSankeySheetSelected(sheetId: string): boolean {
    return this.selectedSankeySheetIds.has(sheetId);
  }

  setSankeySheetSelection(sheetId: string, selected: boolean): void {
    if (!sheetId) {
      return;
    }
    this.sankeySelectionTouched = true;
    if (selected) {
      this.selectedSankeySheetIds.add(sheetId);
      return;
    }
    this.selectedSankeySheetIds.delete(sheetId);
  }

  selectAllSheets(): void {
    this.selectedSheetIds = new Set(this.openSaleSheets.map((saleSheet) => saleSheet.id));
  }

  clearSelectedSheets(): void {
    this.selectedSheetIds = new Set<string>();
  }

  selectAllSankeySheets(): void {
    this.sankeySelectionTouched = true;
    this.selectedSankeySheetIds = new Set(this.openSaleSheets.map((saleSheet) => saleSheet.id));
  }

  clearSelectedSankeySheets(): void {
    this.sankeySelectionTouched = true;
    this.selectedSankeySheetIds = new Set<string>();
  }

  onDeclarationAmountChange(rawValue: string): void {
    const digits = (rawValue ?? '').replace(/\D/g, '');
    this.declarationAmountInput = digits;
  }

  onGroupSearchChange(rawValue: string): void {
    this.groupSearchInput = (rawValue ?? '').trimStart();
  }

  onFocusedGroupChange(sheetId: string): void {
    this.focusedGroupSheetId = sheetId || null;
  }

  toggleGroupSortDirection(): void {
    this.groupSortDirection = this.groupSortDirection === 'DESC' ? 'ASC' : 'DESC';
  }

  get groupSortDirectionLabel(): string {
    return this.groupSortDirection === 'DESC' ? 'Decroissant' : 'Croissant';
  }

  rowTotalTransfersAuec(sheet: MiningSheet): number {
    return (sheet.summary?.saleTransfers ?? [])
      .reduce((sum, transfer) => sum + this.safePositive(transfer.amountAuec), 0);
  }

  isDeclarationInvalid(): boolean {
    return this.allocatedEntries.length === 0;
  }

  submitSales(): void {
    const entries = this.allocatedEntries;
    if (!entries.length) {
      return;
    }
    this.declareSales.emit(entries);
  }

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

  toDisplayDateTime(isoDateTime: string): string {
    if (!isoDateTime) {
      return '-';
    }
    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return isoDateTime;
    }
    return parsed.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR').format(value).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  }

  formatSigned(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    if (value === 0) {
      return '0';
    }
    const sign = value > 0 ? '+' : '-';
    return `${sign}${this.formatNumber(Math.abs(value))}`;
  }

  sankeyLabelX(node: SaleSankeyNode): number {
    if (node.side === 'SOURCE') {
      return node.x - 10;
    }
    if (node.side === 'MIDDLE') {
      return node.x + (node.width / 2);
    }
    return node.x + node.width + 10;
  }

  sankeyLabelY(node: SaleSankeyNode): number {
    if (node.side === 'MIDDLE') {
      return node.y - 8;
    }
    return node.y + (node.height / 2);
  }

  sankeyLabelAnchor(node: SaleSankeyNode): 'start' | 'middle' | 'end' {
    if (node.side === 'SOURCE') {
      return 'end';
    }
    if (node.side === 'MIDDLE') {
      return 'middle';
    }
    return 'start';
  }

  private pruneSelection(): void {
    const allowedSheetIds = new Set(this.openSaleSheets.map((saleSheet) => saleSheet.id));
    const next = new Set<string>();
    for (const sheetId of this.selectedSheetIds) {
      if (allowedSheetIds.has(sheetId)) {
        next.add(sheetId);
      }
    }
    this.selectedSheetIds = next;
  }

  private applyDefaultSelection(): void {
    if (this.selectedSheetIds.size > 0) {
      return;
    }
    const selectedIsOpen = this.openSaleSheets.some((saleSheet) => saleSheet.id === this.selectedSheetId);
    const defaultId = selectedIsOpen ? this.selectedSheetId : (this.openSaleSheets[0]?.id ?? null);
    if (defaultId) {
      this.selectedSheetIds.add(defaultId);
    }
  }

  private pruneSankeySelection(): void {
    const allowedSheetIds = new Set(this.openSaleSheets.map((saleSheet) => saleSheet.id));
    const next = new Set<string>();
    for (const sheetId of this.selectedSankeySheetIds) {
      if (allowedSheetIds.has(sheetId)) {
        next.add(sheetId);
      }
    }
    this.selectedSankeySheetIds = next;
  }

  private applyDefaultSankeySelection(): void {
    if (this.selectedSankeySheetIds.size > 0) {
      return;
    }
    if (this.sankeySelectionTouched) {
      return;
    }
    this.selectedSankeySheetIds = new Set(this.openSaleSheets.map((saleSheet) => saleSheet.id));
  }

  private parsePositiveInteger(value: string | null | undefined): number {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) {
      return 0;
    }
    const parsed = Number(digits);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  private safePositive(value: number | null | undefined): number {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.floor(value));
  }

  private safeSigned(value: number | null | undefined): number {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return 0;
    }
    return Math.trunc(value);
  }

  private safeUsername(value: string | null | undefined): string {
    const safe = (value ?? '').trim();
    return safe || '-';
  }

  private safeSheetWeight(sheet: MiningSheet): number {
    return this.safePositive(sheet?.summary?.totalEstimatedAuec);
  }

  private toSaleGroupRow(sheet: MiningSheet): SaleSheetGroupRow {
    const safeSales = [...(sheet.sales ?? [])];
    let lastDepositAt: string | null = null;
    if (safeSales.length) {
      safeSales.sort((left, right) => this.compareSalesChronology(right, left));
      lastDepositAt = safeSales[0]?.declaredAt ?? null;
    }

    return {
      sheet,
      lastDepositAt,
      depositsCount: safeSales.length,
      beneficiariesCount: (sheet.summary?.saleSettlements ?? []).length,
      totalDeclaredAuec: this.safePositive(sheet.summary?.totalDeclaredSalesAuec),
      totalToReverseAuec: this.rowTotalTransfersAuec(sheet)
    };
  }

  private matchesGroupSearch(row: SaleSheetGroupRow, query: string): boolean {
    if (!query) {
      return true;
    }
    const fields = [
      row.sheet.sheetName,
      row.sheet.refineryLocation,
      row.sheet.saleLocation,
      row.sheet.operationDate
    ];
    return fields
      .map((field) => this.normalizeSearch(field))
      .some((field) => field.includes(query));
  }

  private normalizeSearch(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private compareGroupRows(left: SaleSheetGroupRow, right: SaleSheetGroupRow): number {
    let result = 0;
    if (this.groupSortKey === 'SHEET_NAME') {
      result = left.sheet.sheetName.localeCompare(right.sheet.sheetName, 'fr', { sensitivity: 'base' });
    } else if (this.groupSortKey === 'TOTAL_DECLARED') {
      result = left.totalDeclaredAuec - right.totalDeclaredAuec;
    } else if (this.groupSortKey === 'TOTAL_TO_REVERSE') {
      result = left.totalToReverseAuec - right.totalToReverseAuec;
    } else {
      result = this.compareDateValues(left.lastDepositAt, right.lastDepositAt);
    }

    if (result !== 0) {
      return this.groupSortDirection === 'ASC' ? result : -result;
    }

    const fallbackDate = this.compareDateValues(left.sheet.operationDate, right.sheet.operationDate);
    if (fallbackDate !== 0) {
      return -fallbackDate;
    }

    return left.sheet.sheetName.localeCompare(right.sheet.sheetName, 'fr', { sensitivity: 'base' });
  }

  private compareDateValues(left: string | null | undefined, right: string | null | undefined): number {
    const leftTime = Date.parse(left ?? '');
    const rightTime = Date.parse(right ?? '');
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);
    if (leftValid && rightValid) {
      return leftTime - rightTime;
    }
    if (leftValid && !rightValid) {
      return 1;
    }
    if (!leftValid && rightValid) {
      return -1;
    }
    return 0;
  }

  private allocateDeclarationAcrossSelectedSheets(totalAuec: number): SaleDeclarationEntry[] {
    const safeTotal = this.safePositive(totalAuec);
    const selectedSheets = this.selectedSaleSheets;
    if (!selectedSheets.length || safeTotal <= 0) {
      return [];
    }

    const weightedSheets = selectedSheets.map((saleSheet) => ({
      sheet: saleSheet,
      weight: this.safeSheetWeight(saleSheet)
    }));
    const totalWeight = weightedSheets.reduce((sum, row) => sum + row.weight, 0);

    if (totalWeight <= 0) {
      const base = Math.floor(safeTotal / selectedSheets.length);
      const remainder = safeTotal % selectedSheets.length;
      return selectedSheets
        .map((saleSheet, index) => ({
          sheetId: saleSheet.id,
          creditAuec: base + (index < remainder ? 1 : 0)
        }))
        .filter((entry) => entry.creditAuec > 0);
    }

    const rows = weightedSheets.map((row) => {
      const rawShare = (row.weight * safeTotal) / totalWeight;
      const baseShare = Math.floor(rawShare);
      const remainder = rawShare - baseShare;
      return {
        sheet: row.sheet,
        share: baseShare,
        remainder
      };
    });

    let assigned = rows.reduce((sum, row) => sum + row.share, 0);
    let remaining = Math.max(0, safeTotal - assigned);
    rows.sort((left, right) => {
      if (left.remainder !== right.remainder) {
        return right.remainder - left.remainder;
      }
      return left.sheet.sheetName.localeCompare(right.sheet.sheetName, 'fr', { sensitivity: 'base' });
    });

    for (let index = 0; index < remaining && index < rows.length; index += 1) {
      rows[index].share += 1;
      assigned += 1;
    }

    return rows
      .map((row) => ({
        sheetId: row.sheet.id,
        creditAuec: row.share
      }))
      .filter((entry) => entry.creditAuec > 0);
  }

  private computeIncrementalBeneficiaries(
    sheet: MiningSheet,
    additionalCreditAuec: number,
    declarantUserId: string | null,
    declarantUsername: string | null
  ): SalePreviewPayout[] {
    const safeDeclarantUserId = declarantUserId ?? 'declarer:self';
    const safeDeclarantUsername = this.safeUsername(declarantUsername) === '-' ? 'Declarant' : this.safeUsername(declarantUsername);
    const basePoolAuec = this.safePositive(sheet.summary?.totalDeclaredSalesAuec);
    const baseDeclaredByUser = this.computeDeclaredByUser(sheet);

    return this.computeIncrementalBeneficiariesFromBase(
      sheet,
      additionalCreditAuec,
      safeDeclarantUserId,
      safeDeclarantUsername,
      basePoolAuec,
      baseDeclaredByUser
    );
  }

  private computeHistoricalBeneficiariesForSale(sheet: MiningSheet, saleId: string): SalePreviewPayout[] {
    if (!saleId) {
      return [];
    }
    const orderedSales = [...(sheet.sales ?? [])].sort((left, right) => this.compareSalesChronology(left, right));
    const targetIndex = orderedSales.findIndex((sale) => sale.id === saleId);
    if (targetIndex < 0) {
      return [];
    }

    const targetSale = orderedSales[targetIndex];
    const declarantUserId = targetSale.declaredBy?.id ?? 'declarer:self';
    const declarantUsername = this.safeUsername(targetSale.declaredBy?.username) === '-'
      ? 'Declarant'
      : this.safeUsername(targetSale.declaredBy?.username);
    const targetAmount = this.safePositive(targetSale.creditAuec);
    if (targetAmount <= 0) {
      return [];
    }

    let basePoolAuec = 0;
    const baseDeclaredByUser = new Map<string, number>();
    for (let index = 0; index < targetIndex; index += 1) {
      const sale = orderedSales[index];
      const amount = this.safePositive(sale.creditAuec);
      if (amount <= 0) {
        continue;
      }
      basePoolAuec += amount;
      const userId = sale.declaredBy?.id;
      if (!userId) {
        continue;
      }
      baseDeclaredByUser.set(userId, (baseDeclaredByUser.get(userId) ?? 0) + amount);
    }

    return this.computeIncrementalBeneficiariesFromBase(
      sheet,
      targetAmount,
      declarantUserId,
      declarantUsername,
      basePoolAuec,
      baseDeclaredByUser
    );
  }

  private computeIncrementalBeneficiariesFromBase(
    sheet: MiningSheet,
    additionalCreditAuec: number,
    declarantUserId: string,
    declarantUsername: string,
    basePoolAuec: number,
    baseDeclaredByUser: Map<string, number>
  ): SalePreviewPayout[] {
    const settlements = sheet.summary?.saleSettlements ?? [];
    const safeAdditional = this.safePositive(additionalCreditAuec);
    if (safeAdditional <= 0) {
      return [];
    }

    const declarantKeepLabel = `${declarantUsername} (conserve)`;
    if (!settlements.length) {
      return [{
        userId: declarantUserId,
        username: declarantKeepLabel,
        amountAuec: safeAdditional
      }];
    }

    const currentPool = this.safePositive(basePoolAuec);
    const nextPool = currentPool + safeAdditional;
    const currentPayoutMap = this.computeFullPayoutMapForPool(settlements, currentPool);
    const nextPayoutMap = this.computeFullPayoutMapForPool(settlements, nextPool);
    const usernamesByUserId = this.buildUsernamesByUserId(sheet, declarantUserId, declarantUsername);

    const currentDeclaredByUser = new Map(baseDeclaredByUser);
    const nextDeclaredByUser = new Map(currentDeclaredByUser);
    nextDeclaredByUser.set(declarantUserId, (nextDeclaredByUser.get(declarantUserId) ?? 0) + safeAdditional);

    const currentTransfers = this.buildTransfersFromBalances(currentDeclaredByUser, currentPayoutMap, usernamesByUserId);
    const nextTransfers = this.buildTransfersFromBalances(nextDeclaredByUser, nextPayoutMap, usernamesByUserId);

    const currentByReceiver = new Map<string, number>();
    for (const transfer of currentTransfers) {
      if (transfer.fromUserId !== declarantUserId || transfer.toUserId === declarantUserId) {
        continue;
      }
      currentByReceiver.set(transfer.toUserId, (currentByReceiver.get(transfer.toUserId) ?? 0) + transfer.amountAuec);
    }

    const nextByReceiver = new Map<string, { username: string; amountAuec: number }>();
    for (const transfer of nextTransfers) {
      if (transfer.fromUserId !== declarantUserId || transfer.toUserId === declarantUserId) {
        continue;
      }
      const row = nextByReceiver.get(transfer.toUserId);
      if (!row) {
        nextByReceiver.set(transfer.toUserId, {
          username: transfer.toUsername,
          amountAuec: transfer.amountAuec
        });
      } else {
        row.amountAuec += transfer.amountAuec;
      }
    }

    const rows: SalePreviewPayout[] = [];
    let outgoingToOthers = 0;
    for (const [receiverUserId, receiver] of nextByReceiver.entries()) {
      const baseAmount = currentByReceiver.get(receiverUserId) ?? 0;
      const delta = receiver.amountAuec - baseAmount;
      if (delta <= 0) {
        continue;
      }
      rows.push({
        userId: receiverUserId,
        username: receiver.username,
        amountAuec: delta
      });
      outgoingToOthers += delta;
    }

    const declarantKept = Math.max(0, safeAdditional - outgoingToOthers);
    if (declarantKept > 0) {
      rows.push({
        userId: declarantUserId,
        username: declarantKeepLabel,
        amountAuec: declarantKept
      });
    }

    return rows.sort((left, right) => {
      if (left.amountAuec !== right.amountAuec) {
        return right.amountAuec - left.amountAuec;
      }
      return left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' });
    });
  }

  private computeFullPayoutMapForPool(settlements: MiningSheetSettlement[], payoutPoolAuec: number): Map<string, number> {
    const saleShareByUser = this.allocateSaleShareByUser(settlements, payoutPoolAuec);
    const payouts = new Map<string, number>();
    for (const settlement of settlements) {
      const saleShare = saleShareByUser.get(settlement.userId) ?? 0;
      const compensation = this.safeSigned(settlement.compensationAuec);
      payouts.set(settlement.userId, saleShare + compensation);
    }
    return payouts;
  }

  private computeDeclaredByUser(sheet: MiningSheet): Map<string, number> {
    const declaredByUser = new Map<string, number>();
    for (const sale of sheet.sales ?? []) {
      const saleUserId = sale?.declaredBy?.id;
      if (!saleUserId) {
        continue;
      }
      const amount = this.safePositive(sale?.creditAuec);
      declaredByUser.set(saleUserId, (declaredByUser.get(saleUserId) ?? 0) + amount);
    }
    return declaredByUser;
  }

  private buildUsernamesByUserId(
    sheet: MiningSheet,
    declarantUserId: string,
    declarantUsername: string
  ): Map<string, string> {
    const usernamesByUserId = new Map<string, string>();
    for (const settlement of sheet.summary?.saleSettlements ?? []) {
      usernamesByUserId.set(settlement.userId, this.safeUsername(settlement.username));
    }
    for (const sale of sheet.sales ?? []) {
      const saleUserId = sale?.declaredBy?.id;
      if (!saleUserId) {
        continue;
      }
      usernamesByUserId.set(saleUserId, this.safeUsername(sale.declaredBy?.username));
    }
    usernamesByUserId.set(declarantUserId, declarantUsername);
    return usernamesByUserId;
  }

  private compareSalesChronology(left: MiningSheetSale, right: MiningSheetSale): number {
    const leftTime = Date.parse(left?.declaredAt ?? '');
    const rightTime = Date.parse(right?.declaredAt ?? '');
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);
    if (leftValid && rightValid && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (leftValid && !rightValid) {
      return -1;
    }
    if (!leftValid && rightValid) {
      return 1;
    }
    return (left?.id ?? '').localeCompare(right?.id ?? '', 'fr', { sensitivity: 'base' });
  }

  private buildTransfersFromBalances(
    declaredByUser: Map<string, number>,
    payoutByUser: Map<string, number>,
    usernamesByUserId: Map<string, string>
  ): { fromUserId: string; fromUsername: string; toUserId: string; toUsername: string; amountAuec: number }[] {
    const allUserIds = new Set<string>([...declaredByUser.keys(), ...payoutByUser.keys()]);
    const payers: { userId: string; username: string; amountAuec: number }[] = [];
    const receivers: { userId: string; username: string; amountAuec: number }[] = [];

    for (const userId of allUserIds) {
      const declared = declaredByUser.get(userId) ?? 0;
      const payout = payoutByUser.get(userId) ?? 0;
      const balance = declared - payout;
      const username = this.safeUsername(usernamesByUserId.get(userId));
      if (balance > 0) {
        payers.push({ userId, username, amountAuec: balance });
      } else if (balance < 0) {
        receivers.push({ userId, username, amountAuec: Math.abs(balance) });
      }
    }

    payers.sort((left, right) => {
      const userOrder = left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' });
      if (userOrder !== 0) {
        return userOrder;
      }
      return left.userId.localeCompare(right.userId, 'fr', { sensitivity: 'base' });
    });
    receivers.sort((left, right) => {
      const userOrder = left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' });
      if (userOrder !== 0) {
        return userOrder;
      }
      return left.userId.localeCompare(right.userId, 'fr', { sensitivity: 'base' });
    });

    const transfers: { fromUserId: string; fromUsername: string; toUserId: string; toUsername: string; amountAuec: number }[] = [];
    let receiverIndex = 0;
    for (const payer of payers) {
      let remainingToPay = payer.amountAuec;
      while (remainingToPay > 0 && receiverIndex < receivers.length) {
        const receiver = receivers[receiverIndex];
        if (receiver.amountAuec <= 0) {
          receiverIndex += 1;
          continue;
        }
        const transferAmount = Math.min(remainingToPay, receiver.amountAuec);
        if (transferAmount > 0) {
          transfers.push({
            fromUserId: payer.userId,
            fromUsername: payer.username,
            toUserId: receiver.userId,
            toUsername: receiver.username,
            amountAuec: transferAmount
          });
        }
        remainingToPay -= transferAmount;
        receiver.amountAuec -= transferAmount;
        if (receiver.amountAuec === 0) {
          receiverIndex += 1;
        }
      }
    }

    return transfers;
  }

  private allocateSaleShareByUser(settlements: MiningSheetSettlement[], payoutPoolAuec: number): Map<string, number> {
    const allocations = new Map<string, number>();
    if (!settlements.length) {
      return allocations;
    }

    const safePool = this.safePositive(payoutPoolAuec);
    const totalGross = settlements.reduce((sum, settlement) => sum + this.safePositive(settlement.grossEstimateAuec), 0);

    if (totalGross <= 0) {
      const baseShare = Math.floor(safePool / settlements.length);
      const remainder = safePool % settlements.length;
      for (let index = 0; index < settlements.length; index += 1) {
        allocations.set(settlements[index].userId, baseShare + (index < remainder ? 1 : 0));
      }
      return allocations;
    }

    const remainders: { userId: string; username: string; remainder: number }[] = [];
    let assigned = 0;

    for (const settlement of settlements) {
      const gross = this.safePositive(settlement.grossEstimateAuec);
      const rawShare = (gross * safePool) / totalGross;
      const baseShare = Math.floor(rawShare);
      const remainder = rawShare - baseShare;
      allocations.set(settlement.userId, baseShare);
      assigned += baseShare;
      remainders.push({
        userId: settlement.userId,
        username: this.safeUsername(settlement.username),
        remainder
      });
    }

    const remaining = Math.max(0, safePool - assigned);
    remainders.sort((left, right) => {
      if (left.remainder !== right.remainder) {
        return right.remainder - left.remainder;
      }
      return left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' });
    });

    for (let index = 0; index < remaining && index < remainders.length; index += 1) {
      const userId = remainders[index].userId;
      allocations.set(userId, (allocations.get(userId) ?? 0) + 1);
    }

    return allocations;
  }

  private buildGlobalDepositsSankeyDiagram(sheets: MiningSheet[]): SaleSankeyDiagram | null {
    const openSheets = [...(sheets ?? [])].filter((sheet) => sheet.status === 'OPEN');
    if (!openSheets.length) {
      return null;
    }

    const sourceById = new Map<string, { sourceId: string; label: string; valueAuec: number }>();
    const targetById = new Map<string, { targetId: string; label: string; valueAuec: number }>();
    const linkByKey = new Map<string, { sourceId: string; targetId: string; amountAuec: number }>();

    const sortedSheets = [...openSheets].sort((left, right) => this.compareDateValues(right.operationDate, left.operationDate));
    for (const saleSheet of sortedSheets) {
      for (const transfer of saleSheet.summary?.saleTransfers ?? []) {
        const amount = this.safePositive(transfer.amountAuec);
        if (amount <= 0) {
          continue;
        }
        const sourceId = `user:${transfer.fromUserId}`;
        const targetId = `user:${transfer.toUserId}`;
        const sourceLabel = this.safeUsername(transfer.fromUsername);
        const targetLabel = this.safeUsername(transfer.toUsername);

        const source = sourceById.get(sourceId);
        if (!source) {
          sourceById.set(sourceId, {
            sourceId,
            label: sourceLabel,
            valueAuec: amount
          });
        } else {
          source.valueAuec += amount;
        }

        const target = targetById.get(targetId);
        if (!target) {
          targetById.set(targetId, {
            targetId,
            label: targetLabel,
            valueAuec: amount
          });
        } else {
          target.valueAuec += amount;
        }

        const linkKey = `${sourceId}|${targetId}`;
        const existingLink = linkByKey.get(linkKey);
        if (!existingLink) {
          linkByKey.set(linkKey, {
            sourceId,
            targetId,
            amountAuec: amount
          });
        } else {
          existingLink.amountAuec += amount;
        }
      }
    }

    if (!linkByKey.size || !sourceById.size || !targetById.size) {
      return null;
    }

    const sourceRows = [...sourceById.values()]
      .sort((left, right) => {
        if (left.valueAuec !== right.valueAuec) {
          return right.valueAuec - left.valueAuec;
        }
        return left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' });
      });
    const targetRows = [...targetById.values()]
      .sort((left, right) => {
        if (left.valueAuec !== right.valueAuec) {
          return right.valueAuec - left.valueAuec;
        }
        return left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' });
      });

    const totalAuec = sourceRows.reduce((sum, row) => sum + row.valueAuec, 0);
    if (totalAuec <= 0) {
      return null;
    }

    const width = 1240;
    const height = 500;
    const nodeWidth = 12;
    const marginTop = 24;
    const marginBottom = 24;
    const sourceX = 92;
    const targetX = 1136;
    const innerHeight = height - marginTop - marginBottom;
    const sourceGap = sourceRows.length > 1 ? 18 : 0;
    const targetGap = targetRows.length > 1 ? 18 : 0;
    const sourceUsable = Math.max(40, innerHeight - sourceGap * Math.max(0, sourceRows.length - 1));
    const targetUsable = Math.max(40, innerHeight - targetGap * Math.max(0, targetRows.length - 1));
    const fillRatio = 0.72;
    const scale = (Math.min(sourceUsable, targetUsable) * fillRatio) / totalAuec;

    if (!Number.isFinite(scale) || scale <= 0) {
      return null;
    }

    const sourceNodes: SaleSankeyNode[] = [];
    const targetNodes: SaleSankeyNode[] = [];
    const sourceNodeById = new Map<string, SaleSankeyNode>();
    const targetNodeById = new Map<string, SaleSankeyNode>();
    const sourceColorById = new Map<string, string>();

    let sourceY = marginTop + Math.max(0, (innerHeight - (totalAuec * scale + sourceGap * Math.max(0, sourceRows.length - 1))) / 2);
    for (let index = 0; index < sourceRows.length; index += 1) {
      const source = sourceRows[index];
      const color = this.sankeyColor(index);
      const node: SaleSankeyNode = {
        id: source.sourceId,
        label: source.label,
        side: 'SOURCE',
        x: sourceX,
        y: sourceY,
        width: nodeWidth,
        height: source.valueAuec * scale,
        color,
        valueAuec: source.valueAuec
      };
      sourceNodes.push(node);
      sourceNodeById.set(node.id, node);
      sourceColorById.set(node.id, color);
      sourceY += node.height + sourceGap;
    }

    let targetY = marginTop + Math.max(0, (innerHeight - (totalAuec * scale + targetGap * Math.max(0, targetRows.length - 1))) / 2);
    for (const target of targetRows) {
      const node: SaleSankeyNode = {
        id: target.targetId,
        label: target.label,
        side: 'TARGET',
        x: targetX,
        y: targetY,
        width: nodeWidth,
        height: target.valueAuec * scale,
        color: '#334155',
        valueAuec: target.valueAuec
      };
      targetNodes.push(node);
      targetNodeById.set(node.id, node);
      targetY += node.height + targetGap;
    }

    const links: SaleSankeyLink[] = [];
    const sourceOutgoingOffsetById = new Map<string, number>();
    const targetIncomingOffsetById = new Map<string, number>();
    const directLinks = [...linkByKey.values()]
      .filter((link) => link.amountAuec > 0)
      .sort((left, right) => {
        const leftSourceLabel = sourceById.get(left.sourceId)?.label ?? left.sourceId;
        const rightSourceLabel = sourceById.get(right.sourceId)?.label ?? right.sourceId;
        const sourceOrder = leftSourceLabel.localeCompare(rightSourceLabel, 'fr', { sensitivity: 'base' });
        if (sourceOrder !== 0) {
          return sourceOrder;
        }
        const leftTargetLabel = targetById.get(left.targetId)?.label ?? left.targetId;
        const rightTargetLabel = targetById.get(right.targetId)?.label ?? right.targetId;
        return leftTargetLabel.localeCompare(rightTargetLabel, 'fr', { sensitivity: 'base' });
      });

    for (const link of directLinks) {
      const sourceNode = sourceNodeById.get(link.sourceId);
      const targetNode = targetNodeById.get(link.targetId);
      if (!sourceNode || !targetNode) {
        continue;
      }

      const widthValue = link.amountAuec * scale;
      if (widthValue <= 0) {
        continue;
      }
      const sourceOffset = sourceOutgoingOffsetById.get(link.sourceId) ?? 0;
      const targetOffset = targetIncomingOffsetById.get(link.targetId) ?? 0;
      const startX = sourceNode.x + sourceNode.width;
      const endX = targetNode.x;
      const startY = sourceNode.y + sourceOffset + widthValue / 2;
      const endY = targetNode.y + targetOffset + widthValue / 2;
      const linkColor = sourceColorById.get(link.sourceId) ?? '#38bdf8';

      links.push({
        id: `${link.sourceId}-${link.targetId}-${link.amountAuec}-direct`,
        segment: 'RIGHT',
        sourceId: link.sourceId,
        targetId: link.targetId,
        sourceLabel: sourceNode.label,
        targetLabel: targetNode.label,
        amountAuec: link.amountAuec,
        path: this.buildSankeyRibbonPath(startX, startY, endX, endY, widthValue, 0.24),
        color: linkColor,
        opacity: 0.64,
        valueLabelX: endX - 18,
        valueLabelY: endY,
        valueLabelAnchor: 'end'
      });

      sourceOutgoingOffsetById.set(link.sourceId, sourceOffset + widthValue);
      targetIncomingOffsetById.set(link.targetId, targetOffset + widthValue);
    }

    if (!links.length) {
      return null;
    }

    return {
      width,
      height,
      totalAuec,
      nodes: [...sourceNodes, ...targetNodes],
      links
    };
  }

  private buildSankeyDiagram(entries: SaleDeclarationEntry[], options: SaleSankeyBuildOptions): SaleSankeyDiagram | null {
    if (!entries.length) {
      return null;
    }

    const sheetById = new Map(this.saleSheets.map((saleSheet) => [saleSheet.id, saleSheet]));
    sheetById.set(this.sheet.id, this.sheet);
    const sourceUserId = options.sourceUserId ?? 'declarer:self';
    const sourceId = options.sourceUserId ? `declarer:${options.sourceUserId}` : 'declarer:self';
    const sourceLabel = this.safeUsername(options.sourceUsername) === '-' ? 'Declarant' : this.safeUsername(options.sourceUsername);
    const historicalSaleIdBySheetId = options.historicalSaleIdBySheetId ?? new Map<string, string>();

    const middleRows: {
      middleId: string;
      label: string;
      valueAuec: number;
      color: string;
      payouts: SalePreviewPayout[];
    }[] = [];
    const targetById = new Map<string, { label: string; valueAuec: number }>();
    let totalAuec = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const saleSheet = sheetById.get(entry.sheetId);
      if (!saleSheet) {
        continue;
      }
      const historicalSaleId = historicalSaleIdBySheetId.get(entry.sheetId);
      const payouts = historicalSaleId
        ? this.computeHistoricalBeneficiariesForSale(saleSheet, historicalSaleId)
        : this.computeIncrementalBeneficiaries(saleSheet, entry.creditAuec, sourceUserId, sourceLabel);
      const distributed = payouts.reduce((sum, payout) => sum + this.safePositive(payout.amountAuec), 0);
      if (distributed <= 0) {
        continue;
      }

      totalAuec += distributed;
      middleRows.push({
        middleId: `sheet:${saleSheet.id}`,
        label: saleSheet.sheetName,
        valueAuec: distributed,
        color: this.sankeyColor(index),
        payouts
      });

      for (const payout of payouts) {
        const targetId = `user:${payout.userId}`;
        const amount = this.safePositive(payout.amountAuec);
        if (amount <= 0) {
          continue;
        }
        const target = targetById.get(targetId);
        if (!target) {
          targetById.set(targetId, { label: payout.username, valueAuec: amount });
        } else {
          target.valueAuec += amount;
        }
      }
    }

    if (!middleRows.length || totalAuec <= 0) {
      return null;
    }

    const targetRows = [...targetById.entries()]
      .map(([targetId, target]) => ({
        targetId,
        label: target.label,
        valueAuec: target.valueAuec
      }))
      .sort((left, right) => {
        if (left.valueAuec !== right.valueAuec) {
          return right.valueAuec - left.valueAuec;
        }
        return left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' });
      });

    if (!targetRows.length) {
      return null;
    }

    const width = 1280;
    const height = 500;
    const nodeWidth = 12;
    const marginTop = 24;
    const marginBottom = 24;
    const sourceX = 92;
    const middleX = 614;
    const targetX = 1136;
    const innerHeight = height - marginTop - marginBottom;
    const middleGap = middleRows.length > 1 ? 24 : 0;
    const targetGap = targetRows.length > 1 ? 20 : 0;
    const middleUsable = Math.max(40, innerHeight - middleGap * Math.max(0, middleRows.length - 1));
    const targetUsable = Math.max(40, innerHeight - targetGap * Math.max(0, targetRows.length - 1));
    const fillRatio = 0.64;
    const scale = (Math.min(innerHeight, middleUsable, targetUsable) * fillRatio) / totalAuec;

    if (!Number.isFinite(scale) || scale <= 0) {
      return null;
    }

    const sourceNode: SaleSankeyNode = {
      id: sourceId,
      label: sourceLabel,
      side: 'SOURCE',
      x: sourceX,
      y: marginTop + Math.max(0, (innerHeight - totalAuec * scale) / 2),
      width: nodeWidth,
      height: totalAuec * scale,
      color: '#0ea5e9',
      valueAuec: totalAuec
    };

    const middleNodes: SaleSankeyNode[] = [];
    const targetNodes: SaleSankeyNode[] = [];
    const middleNodeById = new Map<string, SaleSankeyNode>();
    const targetNodeById = new Map<string, SaleSankeyNode>();

    let middleY = marginTop + Math.max(0, (innerHeight - (totalAuec * scale + middleGap * Math.max(0, middleRows.length - 1))) / 2);
    for (const middle of middleRows) {
      const node: SaleSankeyNode = {
        id: middle.middleId,
        label: middle.label,
        side: 'MIDDLE',
        x: middleX,
        y: middleY,
        width: nodeWidth,
        height: middle.valueAuec * scale,
        color: middle.color,
        valueAuec: middle.valueAuec
      };
      middleNodes.push(node);
      middleNodeById.set(node.id, node);
      middleY += node.height + middleGap;
    }

    let targetY = marginTop + Math.max(0, (innerHeight - (totalAuec * scale + targetGap * Math.max(0, targetRows.length - 1))) / 2);
    for (const target of targetRows) {
      const node: SaleSankeyNode = {
        id: target.targetId,
        label: target.label,
        side: 'TARGET',
        x: targetX,
        y: targetY,
        width: nodeWidth,
        height: target.valueAuec * scale,
        color: '#334155',
        valueAuec: target.valueAuec
      };
      targetNodes.push(node);
      targetNodeById.set(node.id, node);
      targetY += node.height + targetGap;
    }

    const links: SaleSankeyLink[] = [];
    const sourceOffsetById = new Map<string, number>([[sourceId, 0]]);
    const middleIncomingOffsetById = new Map<string, number>();

    for (const middle of middleRows) {
      const middleNode = middleNodeById.get(middle.middleId);
      if (!middleNode) {
        continue;
      }
      const sourceOffset = sourceOffsetById.get(sourceId) ?? 0;
      const middleOffset = middleIncomingOffsetById.get(middle.middleId) ?? 0;
      const widthValue = middle.valueAuec * scale;
      const startX = sourceNode.x + sourceNode.width;
      const endX = middleNode.x;
      const startY = sourceNode.y + sourceOffset + widthValue / 2;
      const endY = middleNode.y + middleOffset + widthValue / 2;

      links.push({
        id: `${sourceId}-${middle.middleId}-${middle.valueAuec}-left`,
        segment: 'LEFT',
        sourceId,
        targetId: middle.middleId,
        sourceLabel: sourceLabel,
        targetLabel: middle.label,
        amountAuec: middle.valueAuec,
        path: this.buildSankeyRibbonPath(startX, startY, endX, endY, widthValue, 0.16),
        color: middle.color,
        opacity: 0.48,
        valueLabelX: startX + 18,
        valueLabelY: startY,
        valueLabelAnchor: 'start'
      });

      sourceOffsetById.set(sourceId, sourceOffset + widthValue);
      middleIncomingOffsetById.set(middle.middleId, middleOffset + widthValue);
    }

    const middleOutgoingOffsetById = new Map<string, number>();
    const targetIncomingOffsetById = new Map<string, number>();

    for (const middle of middleRows) {
      const middleNode = middleNodeById.get(middle.middleId);
      if (!middleNode) {
        continue;
      }
      const payouts = [...middle.payouts].sort((left, right) => {
        if (left.amountAuec !== right.amountAuec) {
          return right.amountAuec - left.amountAuec;
        }
        return left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' });
      });

      for (const payout of payouts) {
        const amount = this.safePositive(payout.amountAuec);
        if (amount <= 0) {
          continue;
        }
        const targetId = `user:${payout.userId}`;
        const targetNode = targetNodeById.get(targetId);
        if (!targetNode) {
          continue;
        }

        const widthValue = amount * scale;
        const middleOffset = middleOutgoingOffsetById.get(middle.middleId) ?? 0;
        const targetOffset = targetIncomingOffsetById.get(targetId) ?? 0;
        const startX = middleNode.x + middleNode.width;
        const endX = targetNode.x;
        const startY = middleNode.y + middleOffset + widthValue / 2;
        const endY = targetNode.y + targetOffset + widthValue / 2;

        links.push({
          id: `${middle.middleId}-${targetId}-${amount}-${middleOffset.toFixed(3)}-${targetOffset.toFixed(3)}`,
          segment: 'RIGHT',
          sourceId: middle.middleId,
          targetId,
          sourceLabel: middle.label,
          targetLabel: payout.username,
          amountAuec: amount,
          path: this.buildSankeyRibbonPath(startX, startY, endX, endY, widthValue, 0.18),
          color: middle.color,
          opacity: 0.64,
          valueLabelX: endX - 18,
          valueLabelY: endY,
          valueLabelAnchor: 'end'
        });

        middleOutgoingOffsetById.set(middle.middleId, middleOffset + widthValue);
        targetIncomingOffsetById.set(targetId, targetOffset + widthValue);
      }
    }

    return {
      width,
      height,
      totalAuec,
      nodes: [sourceNode, ...middleNodes, ...targetNodes],
      links
    };
  }

  private buildSankeyRibbonPath(
    startX: number,
    startCenterY: number,
    endX: number,
    endCenterY: number,
    thickness: number,
    curveRatio: number
  ): string {
    const safeThickness = Math.max(1, thickness);
    const startTopY = startCenterY - safeThickness / 2;
    const startBottomY = startCenterY + safeThickness / 2;
    const endTopY = endCenterY - safeThickness / 2;
    const endBottomY = endCenterY + safeThickness / 2;
    const curve = Math.max(12, Math.abs(endX - startX) * curveRatio);

    return [
      `M ${startX} ${startTopY}`,
      `C ${startX + curve} ${startTopY}, ${endX - curve} ${endTopY}, ${endX} ${endTopY}`,
      `L ${endX} ${endBottomY}`,
      `C ${endX - curve} ${endBottomY}, ${startX + curve} ${startBottomY}, ${startX} ${startBottomY}`,
      'Z'
    ].join(' ');
  }

  private sankeyColor(index: number): string {
    const palette = ['#2dd4bf', '#38bdf8', '#22c55e', '#f59e0b', '#f97316', '#a78bfa', '#14b8a6', '#ec4899'];
    return palette[index % palette.length];
  }
}
