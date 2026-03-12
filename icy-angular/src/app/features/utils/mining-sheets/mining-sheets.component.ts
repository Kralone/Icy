import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  MiningJobType,
  MiningSheet,
  MiningSheetJob,
  MiningSheetJobPayload,
  MiningSheetService,
  MiningSheetUpsertPayload,
} from '../../../core/services/mining/mining-sheet.service';
import { UserService } from '../../../core/services/user/user.service';
import { User } from '../../../model/user.model';
import { ApiResponse } from '../../../model/api-response.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { WebSocketService } from '../../../core/services/websocket/websocket.service';
import { MiningSheetsHistoryPanelComponent } from './components/mining-sheets-history-panel.component';
import { MiningSheetsCreateModalComponent } from './components/mining-sheets-create-modal.component';
import { MiningSheetsAdminModalComponent } from './components/mining-sheets-admin-modal.component';
import { MiningSheetsSummaryComponent } from './components/mining-sheets-summary.component';

interface SheetFormState {
  sheetName: string;
  operationDate: string;
  refineryLocation: string;
  saleLocation: string;
  memberIds: string[];
  memberSearch: string;
}

interface JobOreDraft {
  oreName: string;
  quantityCscu: number | null;
  includeInSale: boolean;
}

interface JobDraft {
  type: MiningJobType;
  ownerUserId: string | null;
  refineryMethod: string;
  durationText: string;
  costAuec: number | null;
  costText: string;
  ores: JobOreDraft[];
}

@Component({
  standalone: true,
  selector: 'app-mining-sheets',
  imports: [
    CommonModule,
    FormsModule,
    MiningSheetsHistoryPanelComponent,
    MiningSheetsCreateModalComponent,
    MiningSheetsAdminModalComponent,
    MiningSheetsSummaryComponent
  ],
  templateUrl: './mining-sheets.component.html',
  styleUrl: './mining-sheets.component.css'
})
export class MiningSheetsComponent implements OnInit, OnDestroy {
  readonly baseOreNames: string[] = [
    'Agricium',
    'Aluminum',
    'Aphorite',
    'Beryl',
    'Bexalite',
    'Borase',
    'Copper',
    'Corundum',
    'Diamond',
    'Dolivine',
    'Gold',
    'Hadanite',
    'Hephaestanite',
    'Ice',
    'Iron',
    'Janalite',
    'Laranite',
    'Lindinium',
    'Quantanium',
    'Quartz',
    'Ricite',
    'Savrilium',
    'Silicon',
    'Stileron',
    'Taranite',
    'Tin',
    'Titanium',
    'Torite',
    'Tungsten'
  ];

  readonly refiningMethods: string[] = [
    'Cormack Method',
    'Dinyx Solvention',
    'Electrostarolysis',
    'Ferron Exchange',
    'Gaskin Process',
    'Kazen Winnowing',
    'Pyrometric Chromalysis',
    'Thermonatic Deposition',
    'XCR Reaction'
  ];

  loading = true;
  saving = false;
  errorMessage = '';
  actionError = '';

  users: User[] = [];
  sheets: MiningSheet[] = [];
  selectedSheet: MiningSheet | null = null;

  isAdmin = false;
  currentUserId: string | null = null;

  showCreateModal = false;
  showAdminSettingsModal = false;
  createForm: SheetFormState = this.createEmptySheetForm();
  sheetEditForm: SheetFormState | null = null;
  saleLocationSuggestions: string[] = [];
  private saleLocationSearchHandle?: ReturnType<typeof setTimeout>;

  expandedJobIds = new Set<string>();
  jobDraftById = new Map<string, JobDraft>();
  newJobDraft: JobDraft | null = null;
  jobTypeFilter: 'ALL' | MiningJobType = 'ALL';
  jobOwnerFilterUserId = '';
  currentJobPage = 1;
  readonly jobPageSize = 5;

  nowMs = Date.now();
  private timerHandle?: ReturnType<typeof setInterval>;
  private durationCursorByDraft = new WeakMap<JobDraft, number>();
  private remainingSecondsAnchorMs = Date.now();
  private miningRealtimeSubscription?: Subscription;

  constructor(
    private readonly miningSheetService: MiningSheetService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.resolveCurrentUserId();
    this.loadPermissions();
    this.loadUsers();
    this.loadSheets();
    this.connectRealtimeUpdates();
    this.timerHandle = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = undefined;
    }
    if (this.saleLocationSearchHandle) {
      clearTimeout(this.saleLocationSearchHandle);
      this.saleLocationSearchHandle = undefined;
    }
    if (this.miningRealtimeSubscription) {
      this.miningRealtimeSubscription.unsubscribe();
      this.miningRealtimeSubscription = undefined;
    }
    this.webSocketService.disconnectMiningSheets();
  }

  get activeSheets(): MiningSheet[] {
    return this.sheets.filter((sheet) => sheet.status !== 'FINALIZED');
  }

  get historySheets(): MiningSheet[] {
    return this.sheets.filter((sheet) => sheet.status === 'FINALIZED');
  }

  get selectedActiveSheetId(): string {
    return this.selectedSheet?.id ?? '';
  }

  trackSheet(_: number, sheet: MiningSheet): string {
    return sheet.id;
  }

  trackJob(_: number, job: MiningSheetJob): string {
    return job.id;
  }

  trackUser(_: number, user: User): string {
    return user.id;
  }

  openCreateModal(): void {
    this.actionError = '';
    this.showCreateModal = true;
    this.createForm = this.createEmptySheetForm();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createForm = this.createEmptySheetForm();
    this.saleLocationSuggestions = [];
  }

  createSheet(): void {
    if (!this.isAdmin || this.saving) {
      return;
    }

    const payload = this.toSheetPayload(this.createForm);
    if (!payload) {
      return;
    }

    this.saving = true;
    this.actionError = '';
    this.miningSheetService.createSheet(payload).subscribe({
      next: (sheet) => {
        this.applySheetUpdate(sheet);
        this.openSheet(sheet);
        this.closeCreateModal();
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Creation impossible.');
        this.saving = false;
      }
    });
  }

  openSheet(sheet: MiningSheet): void {
    this.actionError = '';
    this.selectedSheet = sheet;
    this.sheetEditForm = this.toSheetForm(sheet);
    this.expandedJobIds.clear();
    this.jobDraftById.clear();
    this.newJobDraft = null;
    this.jobTypeFilter = 'ALL';
    this.jobOwnerFilterUserId = '';
    this.currentJobPage = 1;
  }

  selectActiveSheet(sheetId: string): void {
    if (!sheetId) {
      this.closeSheet();
      return;
    }
    const found = this.activeSheets.find((sheet) => sheet.id === sheetId);
    if (found) {
      this.openSheet(found);
    }
  }

  closeSheet(): void {
    this.selectedSheet = null;
    this.sheetEditForm = null;
    this.showAdminSettingsModal = false;
    this.expandedJobIds.clear();
    this.jobDraftById.clear();
    this.newJobDraft = null;
    this.jobTypeFilter = 'ALL';
    this.jobOwnerFilterUserId = '';
    this.currentJobPage = 1;
    this.actionError = '';
  }

  openAdminSettingsModal(): void {
    if (!this.isAdmin || !this.selectedSheet) {
      return;
    }
    this.sheetEditForm = this.toSheetForm(this.selectedSheet);
    this.showAdminSettingsModal = true;
  }

  closeAdminSettingsModal(): void {
    this.showAdminSettingsModal = false;
    this.saleLocationSuggestions = [];
  }

  saveSheetEdits(): void {
    if (!this.selectedSheet || !this.sheetEditForm || !this.isAdmin || this.saving) {
      return;
    }

    const payload = this.toSheetPayload(this.sheetEditForm);
    if (!payload) {
      return;
    }

    this.saving = true;
    this.actionError = '';
    this.miningSheetService.updateSheet(this.selectedSheet.id, payload).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Mise a jour impossible.');
        this.saving = false;
      }
    });
  }

  lockSelectedSheet(): void {
    if (!this.selectedSheet || !this.isAdmin || this.saving) {
      return;
    }
    this.saving = true;
    this.actionError = '';
    this.miningSheetService.lockSheet(this.selectedSheet.id).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Verrouillage impossible.');
        this.saving = false;
      }
    });
  }

  unlockSelectedSheet(): void {
    if (!this.selectedSheet || !this.isAdmin || this.saving) {
      return;
    }
    this.saving = true;
    this.actionError = '';
    this.miningSheetService.unlockSheet(this.selectedSheet.id).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Deverrouillage impossible.');
        this.saving = false;
      }
    });
  }

  finalizeSelectedSheet(): void {
    if (!this.selectedSheet || !this.isAdmin || this.saving) {
      return;
    }

    const ongoingRefineryJobs = this.countOngoingRefineryJobs(this.selectedSheet);
    if (ongoingRefineryJobs > 0) {
      const confirmMessage = ongoingRefineryJobs === 1
        ? 'Un job de raffinage est encore en cours. Es-tu sur de vouloir finaliser cette fiche ?'
        : `${ongoingRefineryJobs} jobs de raffinage sont encore en cours. Es-tu sur de vouloir finaliser cette fiche ?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    this.saving = true;
    this.actionError = '';
    this.miningSheetService.finalizeSheet(this.selectedSheet.id).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Finalisation impossible.');
        this.saving = false;
      }
    });
  }

  toggleJob(job: MiningSheetJob): void {
    if (this.expandedJobIds.has(job.id)) {
      this.expandedJobIds.delete(job.id);
      return;
    }
    this.expandedJobIds.add(job.id);
    if (!this.jobDraftById.has(job.id)) {
      this.jobDraftById.set(job.id, this.toJobDraft(job));
    }
  }

  isJobExpanded(jobId: string): boolean {
    return this.expandedJobIds.has(jobId);
  }

  resetJobDraft(job: MiningSheetJob): void {
    this.jobDraftById.set(job.id, this.toJobDraft(job));
    this.expandedJobIds.delete(job.id);
  }

  startNewJob(type: MiningJobType): void {
    if (!this.selectedSheet || !this.selectedSheet.editableByCurrentUser || this.selectedSheet.status !== 'OPEN') {
      return;
    }
    this.actionError = '';
    this.newJobDraft = this.createEmptyJobDraft(type);
  }

  cancelNewJob(): void {
    this.newJobDraft = null;
  }

  saveNewJob(): void {
    if (!this.selectedSheet || !this.newJobDraft || this.saving) {
      return;
    }
    const payload = this.toJobPayload(this.newJobDraft);
    if (!payload) {
      return;
    }

    this.saving = true;
    this.actionError = '';
    this.miningSheetService.createJob(this.selectedSheet.id, payload).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.newJobDraft = null;
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Creation du job impossible.');
        this.saving = false;
      }
    });
  }

  saveJob(job: MiningSheetJob): void {
    if (!this.selectedSheet || this.saving) {
      return;
    }
    const draft = this.jobDraftById.get(job.id);
    if (!draft) {
      return;
    }
    const payload = this.toJobPayload(draft);
    if (!payload) {
      return;
    }

    this.saving = true;
    this.actionError = '';
    this.miningSheetService.updateJob(this.selectedSheet.id, job.id, payload).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.expandedJobIds.delete(job.id);
        this.jobDraftById.delete(job.id);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Mise a jour du job impossible.');
        this.saving = false;
      }
    });
  }

  deleteJob(job: MiningSheetJob): void {
    if (!this.selectedSheet || this.saving) {
      return;
    }
    this.saving = true;
    this.actionError = '';
    this.miningSheetService.deleteJob(this.selectedSheet.id, job.id).subscribe({
      next: (updated) => {
        this.applySheetUpdate(updated);
        this.expandedJobIds.delete(job.id);
        this.jobDraftById.delete(job.id);
        this.saving = false;
      },
      error: (error) => {
        this.actionError = this.extractError(error, 'Suppression du job impossible.');
        this.saving = false;
      }
    });
  }

  memberSuggestions(form: SheetFormState): User[] {
    const query = this.normalize(form.memberSearch);
    return this.users
      .filter((user) => !form.memberIds.includes(user.id))
      .filter((user) => !query || this.normalize(user.username).includes(query))
      .slice(0, 8);
  }

  addMember(form: SheetFormState, user: User): void {
    if (!form.memberIds.includes(user.id)) {
      form.memberIds = [...form.memberIds, user.id];
    }
    form.memberSearch = '';
  }

  removeMember(form: SheetFormState, userId: string): void {
    form.memberIds = form.memberIds.filter((id) => id !== userId);
  }

  selectedMembers(form: SheetFormState): User[] {
    const idSet = new Set(form.memberIds);
    return this.users.filter((user) => idSet.has(user.id));
  }

  onSaleLocationSearchChange(form: SheetFormState, value: string): void {
    form.saleLocation = value;
    if (this.saleLocationSearchHandle) {
      clearTimeout(this.saleLocationSearchHandle);
      this.saleLocationSearchHandle = undefined;
    }
    const query = (value ?? '').trim();
    if (query.length < 2) {
      this.saleLocationSuggestions = [];
      return;
    }
    this.saleLocationSearchHandle = setTimeout(() => {
      this.miningSheetService.suggestSaleLocations(query).subscribe({
        next: (rows) => {
          this.saleLocationSuggestions = rows ?? [];
        },
        error: () => {
          this.saleLocationSuggestions = [];
        }
      });
      this.saleLocationSearchHandle = undefined;
    }, 180);
  }

  selectSaleLocation(form: SheetFormState, location: string): void {
    form.saleLocation = location;
    this.saleLocationSuggestions = [];
  }

  addOreRow(target: JobDraft): void {
    target.ores = [...target.ores, { oreName: '', quantityCscu: null, includeInSale: true }];
  }

  removeOreRow(target: JobDraft, index: number): void {
    target.ores = target.ores.filter((_, i) => i !== index);
  }

  onCostInputChange(target: JobDraft, rawValue: string): void {
    const digitsOnly = (rawValue ?? '').replace(/\D/g, '');
    const normalizedDigits = digitsOnly.replace(/^0+(?=\d)/, '');
    target.costText = this.formatCostInput(normalizedDigits);
    target.costAuec = normalizedDigits ? Number(normalizedDigits) : 0;
  }

  onDurationFocus(target: JobDraft, input: HTMLInputElement): void {
    if (!target.durationText) {
      target.durationText = '0h00';
    }
    this.durationCursorByDraft.set(target, 0);
    this.focusDurationDigit(target, input);
  }

  onDurationKeydown(target: JobDraft, event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key;
    if (key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      this.applyDurationBackspace(target);
      this.focusDurationDigit(target, input);
      return;
    }
    if (!/^\d$/.test(key)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this.applyDurationDigit(target, key);
    this.focusDurationDigit(target, input);
  }

  usersForSheetOwners(sheet: MiningSheet): User[] {
    const ids = new Set(sheet.members.map((member) => member.id));
    return this.users.filter((user) => ids.has(user.id));
  }

  usersForJobFilter(sheet: MiningSheet): MiningSheet['jobs'][number]['owner'][] {
    const byId = new Map<string, MiningSheet['jobs'][number]['owner']>();
    for (const job of sheet.jobs ?? []) {
      if (job.owner?.id && !byId.has(job.owner.id)) {
        byId.set(job.owner.id, job.owner);
      }
    }
    return [...byId.values()].sort((left, right) => left.username.localeCompare(right.username, 'fr', { sensitivity: 'base' }));
  }

  setJobTypeFilter(value: 'ALL' | MiningJobType): void {
    this.jobTypeFilter = value;
    this.currentJobPage = 1;
  }

  setJobOwnerFilter(value: string): void {
    this.jobOwnerFilterUserId = value ?? '';
    this.currentJobPage = 1;
  }

  filteredJobs(sheet: MiningSheet): MiningSheetJob[] {
    const jobs = [...(sheet.jobs ?? [])];
    const typeFiltered = this.jobTypeFilter === 'ALL'
      ? jobs
      : jobs.filter((job) => job.type === this.jobTypeFilter);
    const ownerFiltered = this.jobOwnerFilterUserId
      ? typeFiltered.filter((job) => job.owner?.id === this.jobOwnerFilterUserId)
      : typeFiltered;
    return ownerFiltered.sort((left, right) => {
      const rank = (type: MiningJobType): number => {
        if (type === 'REFINERY') return 0;
        if (type === 'FUEL') return 1;
        if (type === 'REPAIR') return 2;
        return 3;
      };
      const typeDiff = rank(left.type) - rank(right.type);
      if (typeDiff !== 0) {
        return typeDiff;
      }
      return left.owner.username.localeCompare(right.owner.username, 'fr', { sensitivity: 'base' });
    });
  }

  paginatedJobs(sheet: MiningSheet): MiningSheetJob[] {
    const filtered = this.filteredJobs(sheet);
    const page = this.currentJobPageFor(sheet);
    const start = (page - 1) * this.jobPageSize;
    return filtered.slice(start, start + this.jobPageSize);
  }

  totalJobPages(sheet: MiningSheet): number {
    const total = this.filteredJobs(sheet).length;
    return Math.max(1, Math.ceil(total / this.jobPageSize));
  }

  displayedJobCount(sheet: MiningSheet): number {
    return this.paginatedJobs(sheet).length;
  }

  filteredJobCount(sheet: MiningSheet): number {
    return this.filteredJobs(sheet).length;
  }

  currentJobPageFor(sheet: MiningSheet): number {
    return Math.min(Math.max(1, this.currentJobPage), this.totalJobPages(sheet));
  }

  goToPreviousJobPage(sheet: MiningSheet): void {
    const page = this.currentJobPageFor(sheet);
    if (page <= 1) {
      return;
    }
    this.currentJobPage = page - 1;
  }

  goToNextJobPage(sheet: MiningSheet): void {
    const page = this.currentJobPageFor(sheet);
    const maxPage = this.totalJobPages(sheet);
    if (page >= maxPage) {
      return;
    }
    this.currentJobPage = page + 1;
  }

  memberName(userId: string): string {
    return this.users.find((user) => user.id === userId)?.username ?? userId;
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

  jobRemainingSeconds(job: MiningSheetJob): number | null {
    const serverRemaining = job.remainingSeconds;
    if (serverRemaining !== null && serverRemaining !== undefined && Number.isFinite(serverRemaining)) {
      const elapsedSeconds = Math.max(0, Math.floor((this.nowMs - this.remainingSecondsAnchorMs) / 1000));
      return Math.max(0, Math.floor(serverRemaining) - elapsedSeconds);
    }

    if (!job.finishAt) {
      return null;
    }
    const finish = Date.parse(job.finishAt);
    if (Number.isNaN(finish)) {
      return null;
    }
    return Math.max(0, Math.floor((finish - this.nowMs) / 1000));
  }

  availableOreNames(sheet: MiningSheet): string[] {
    const names = new Set<string>();
    for (const name of this.baseOreNames) {
      const normalized = (name ?? '').trim();
      if (normalized) {
        names.add(normalized);
      }
    }
    for (const ore of sheet.summary?.ores ?? []) {
      const name = (ore.oreName ?? '').trim();
      if (name) {
        names.add(name);
      }
    }
    for (const ore of sheet.summary?.keptOres ?? []) {
      const name = (ore.oreName ?? '').trim();
      if (name) {
        names.add(name);
      }
    }
    for (const job of sheet.jobs ?? []) {
      for (const ore of job.ores ?? []) {
        const name = (ore.oreName ?? '').trim();
        if (name) {
          names.add(name);
        }
      }
    }
    return [...names].sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
  }

  statusLabel(status: MiningSheet['status']): string {
    if (status === 'OPEN') return 'Ouvert';
    if (status === 'LOCKED') return 'Verrouillé';
    return 'Finalisé';
  }

  jobTypeLabel(type: MiningJobType): string {
    if (type === 'REFINERY') return 'Raffinage';
    if (type === 'FUEL') return 'Carburant';
    if (type === 'REPAIR') return 'Réparation';
    return 'Matériel';
  }

  draftForJob(jobId: string): JobDraft | null {
    return this.jobDraftById.get(jobId) ?? null;
  }

  private loadSheets(showLoading = true): void {
    if (showLoading) {
      this.loading = true;
      this.errorMessage = '';
    }
    this.miningSheetService.listSheets().subscribe({
      next: (sheets) => {
        this.sheets = this.sortSheets(sheets);
        this.remainingSecondsAnchorMs = Date.now();
        if (this.selectedSheet) {
          this.selectedSheet = this.sheets.find((sheet) => sheet.id === this.selectedSheet?.id) ?? null;
          if (this.selectedSheet) {
            this.sheetEditForm = this.toSheetForm(this.selectedSheet);
          } else {
            this.sheetEditForm = null;
            this.expandedJobIds.clear();
            this.jobDraftById.clear();
            this.newJobDraft = null;
          }
        } else {
          const firstActive = this.sheets.find((sheet) => sheet.status !== 'FINALIZED') ?? null;
          this.selectedSheet = firstActive;
          this.sheetEditForm = firstActive ? this.toSheetForm(firstActive) : null;
        }
        if (showLoading) {
          this.loading = false;
        }
      },
      error: (error) => {
        if (showLoading) {
          this.errorMessage = this.extractError(error, 'Impossible de charger les fiches de minage.');
          this.loading = false;
        }
      }
    });
  }

  private loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (response: ApiResponse<User[]>) => {
        this.users = response?.data ?? [];
      },
      error: () => {
        this.users = [];
      }
    });
  }

  private loadPermissions(): void {
    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.isAdmin = roles.includes('ADMIN');
      },
      error: () => {
        this.isAdmin = false;
      }
    });
  }

  private resolveCurrentUserId(): void {
    try {
      this.currentUserId = this.authService.getUserIdFromToken();
    } catch {
      this.currentUserId = null;
    }
  }

  private toSheetPayload(form: SheetFormState): MiningSheetUpsertPayload | null {
    const sheetName = (form.sheetName ?? '').trim();
    const operationDate = (form.operationDate ?? '').trim();
    const refineryLocation = (form.refineryLocation ?? '').trim();
    const saleLocation = (form.saleLocation ?? '').trim();
    const memberIds = form.memberIds.filter((id) => !!id);

    if (!sheetName) {
      this.actionError = 'Le nom de fiche est obligatoire.';
      return null;
    }
    if (!operationDate) {
      this.actionError = 'La date est obligatoire.';
      return null;
    }
    if (!refineryLocation) {
      this.actionError = 'Le lieu de raffinage est obligatoire.';
      return null;
    }
    if (!memberIds.length) {
      this.actionError = 'Ajoutez au moins un membre.';
      return null;
    }

    return {
      sheetName,
      operationDate,
      refineryLocation,
      saleLocation: saleLocation || null,
      memberIds
    };
  }

  private toJobPayload(draft: JobDraft): MiningSheetJobPayload | null {
    const durationMinutes = draft.type === 'REFINERY'
      ? this.parseDurationToMinutes(draft.durationText)
      : null;
    const refineryMethod = this.normalizeNullableRefineryMethod(draft.refineryMethod);

    if (draft.type === 'REFINERY' && durationMinutes === null) {
      this.actionError = 'La duree doit etre au format HHhmm (ex: 01h30).';
      return null;
    }
    if (draft.type === 'REFINERY' && !refineryMethod) {
      this.actionError = 'Selectionnez une methode de raffinage.';
      return null;
    }

    const payload: MiningSheetJobPayload = {
      type: draft.type,
      ownerUserId: this.currentUserId,
      refineryMethod,
      durationMinutes,
      costAuec: this.parseCostInput(draft.costText),
      publishedAt: null,
      notes: null,
      ores: null
    };

    if (!payload.ownerUserId) {
      this.actionError = 'Impossible de determiner le proprietaire (utilisateur connecte).';
      return null;
    }

    if (draft.type === 'REFINERY') {
      const ores = draft.ores
        .map((ore) => ({
          oreName: ore.oreName.trim(),
          quantityCscu: Number(ore.quantityCscu ?? 0),
          includeInSale: ore.includeInSale !== false
        }))
        .filter((ore) => !!ore.oreName && Number.isFinite(ore.quantityCscu) && ore.quantityCscu > 0);

      if (!ores.length) {
        this.actionError = 'Un job de raffinage doit contenir au moins un minerai.';
        return null;
      }
      payload.ores = ores;
    } else {
      payload.ores = [];
      payload.refineryMethod = null;
      payload.durationMinutes = null;
    }

    return payload;
  }

  private toSheetForm(sheet: MiningSheet): SheetFormState {
    return {
      sheetName: sheet.sheetName ?? '',
      operationDate: sheet.operationDate,
      refineryLocation: sheet.refineryLocation,
      saleLocation: sheet.saleLocation ?? '',
      memberIds: sheet.members.map((member) => member.id),
      memberSearch: ''
    };
  }

  private createEmptySheetForm(): SheetFormState {
    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const day = localDate.getDate().toString().padStart(2, '0');
    const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
    const hours = localDate.getHours().toString().padStart(2, '0');
    const minutes = localDate.getMinutes().toString().padStart(2, '0');
    return {
      sheetName: `Fiche ${day}/${month} ${hours}:${minutes}`,
      operationDate: isoDate,
      refineryLocation: '',
      saleLocation: '',
      memberIds: [],
      memberSearch: ''
    };
  }

  private toJobDraft(job: MiningSheetJob): JobDraft {
    const refineryMethod = this.normalizeNullableRefineryMethod(job.refineryMethod) ?? (this.refiningMethods[0] ?? '');
    return {
      type: job.type,
      ownerUserId: job.owner?.id ?? null,
      refineryMethod,
      durationText: this.toDurationInput(job.durationMinutes),
      costAuec: job.costAuec ?? 0,
      costText: this.formatCostInput(String(Math.max(0, Math.floor(job.costAuec ?? 0)))),
      ores: (job.ores ?? []).map((ore) => ({
        oreName: ore.oreName,
        quantityCscu: ore.quantityCscu,
        includeInSale: ore.includeInSale !== false
      }))
    };
  }

  private createEmptyJobDraft(type: MiningJobType): JobDraft {
    const ownerId = this.resolveDefaultOwnerId();
    return {
      type,
      ownerUserId: ownerId,
      refineryMethod: this.refiningMethods[0] ?? '',
      durationText: type === 'REFINERY' ? '01h00' : '',
      costAuec: 0,
      costText: '0',
      ores: type === 'REFINERY' ? [{ oreName: '', quantityCscu: null, includeInSale: true }] : []
    };
  }

  private resolveDefaultOwnerId(): string | null {
    const selected = this.selectedSheet;
    if (!selected) {
      return this.currentUserId;
    }
    const memberIds = selected.members.map((member) => member.id);
    if (this.currentUserId && memberIds.includes(this.currentUserId)) {
      return this.currentUserId;
    }
    return memberIds[0] ?? null;
  }

  private toDurationInput(durationMinutes: number | null | undefined): string {
    const safe = Math.max(0, Number(durationMinutes ?? 0));
    const hours = Math.floor(safe / 60).toString();
    const minutes = (safe % 60).toString().padStart(2, '0');
    return `${hours}h${minutes}`;
  }

  private parseDurationToMinutes(value: string): number | null {
    const raw = (value ?? '').trim();
    const match = raw.match(/^(\d{1,3})h([0-5]\d)$/i);
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }

  private formatCostInput(rawDigits: string): string {
    const clean = (rawDigits ?? '').replace(/\D/g, '');
    if (!clean) {
      return '';
    }
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private parseCostInput(value: string): number {
    const digits = (value ?? '').replace(/\D/g, '');
    if (!digits) {
      return 0;
    }
    return Number(digits);
  }

  private applyDurationDigit(target: JobDraft, digit: string): void {
    const current = this.toDurationDigits(target.durationText);
    const cursor = this.durationCursorByDraft.get(target) ?? 0;
    const next = `${current.slice(0, cursor)}${digit}${current.slice(cursor + 1)}`;
    target.durationText = this.durationDigitsToText(next);
    this.durationCursorByDraft.set(target, Math.min(3, cursor + 1));
  }

  private applyDurationBackspace(target: JobDraft): void {
    const current = this.toDurationDigits(target.durationText);
    const cursor = this.durationCursorByDraft.get(target) ?? 0;
    const position = Math.max(0, cursor - 1);
    const next = `${current.slice(0, position)}0${current.slice(position + 1)}`;
    target.durationText = this.durationDigitsToText(next);
    this.durationCursorByDraft.set(target, position);
  }

  private toDurationDigits(value: string): string {
    const raw = (value ?? '').trim();
    const match = raw.match(/^(\d{1,3})h([0-5]\d)$/i);
    if (!match) {
      return '0000';
    }
    const hours = Math.max(0, Math.min(99, Number(match[1] ?? '0')));
    const minutes = Number(match[2] ?? '0');
    const hh = hours.toString().padStart(2, '0');
    const mm = Math.max(0, Math.min(59, minutes)).toString().padStart(2, '0');
    return `${hh}${mm}`;
  }

  private durationDigitsToText(digits: string): string {
    const safe = (digits ?? '').replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
    const hours = Number(safe.slice(0, 2)).toString();
    const minutes = safe.slice(2, 4);
    return `${hours}h${minutes}`;
  }

  private focusDurationDigit(target: JobDraft, input: HTMLInputElement): void {
    const cursor = this.durationCursorByDraft.get(target) ?? 0;
    const indexes = [0, 1, 3, 4];
    const index = indexes[Math.max(0, Math.min(3, cursor))] ?? 0;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(index, index + 1);
    });
  }

  private countOngoingRefineryJobs(sheet: MiningSheet): number {
    return (sheet.jobs ?? []).filter((job) => {
      if (job.type !== 'REFINERY') {
        return false;
      }
      const remaining = this.jobRemainingSeconds(job);
      return remaining !== null && remaining > 0;
    }).length;
  }

  private normalizeNullableRefineryMethod(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      return null;
    }
    return this.refiningMethods.includes(normalized) ? normalized : null;
  }

  private applySheetUpdate(updated: MiningSheet): void {
    this.remainingSecondsAnchorMs = Date.now();
    const nextSheets = this.sheets.filter((sheet) => sheet.id !== updated.id);
    nextSheets.push(updated);
    this.sheets = this.sortSheets(nextSheets);

    if (this.selectedSheet?.id === updated.id) {
      if (updated.status === 'FINALIZED') {
        this.closeSheet();
        const firstActive = this.sheets.find((sheet) => sheet.status !== 'FINALIZED') ?? null;
        if (firstActive) {
          this.openSheet(firstActive);
        }
        return;
      }
      this.selectedSheet = updated;
      this.sheetEditForm = this.toSheetForm(updated);
      this.syncJobDrafts(updated);
    }
  }

  private syncJobDrafts(sheet: MiningSheet): void {
    const validIds = new Set(sheet.jobs.map((job) => job.id));
    for (const key of this.jobDraftById.keys()) {
      if (!validIds.has(key)) {
        this.jobDraftById.delete(key);
        this.expandedJobIds.delete(key);
      }
    }
    for (const job of sheet.jobs) {
      if (this.expandedJobIds.has(job.id)) {
        this.jobDraftById.set(job.id, this.toJobDraft(job));
      }
    }
  }

  private sortSheets(source: MiningSheet[]): MiningSheet[] {
    return [...source].sort((left, right) => {
      const leftDate = Date.parse(left.operationDate);
      const rightDate = Date.parse(right.operationDate);
      if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
        return rightDate - leftDate;
      }
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
  }

  private connectRealtimeUpdates(): void {
    this.webSocketService.connectMiningSheets();
    this.miningRealtimeSubscription = this.webSocketService.listenForMiningSheets().subscribe(() => {
      this.loadSheets(false);
    });
  }

  private extractError(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: string } })?.error?.message;
    if (message && typeof message === 'string') {
      return message;
    }
    return fallback;
  }

  private normalize(value: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
