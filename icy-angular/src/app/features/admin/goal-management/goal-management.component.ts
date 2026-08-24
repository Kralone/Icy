import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoalService } from '../../../core/services/goal/goal.service';
import { Goal } from '../../../model/goal.model';
import { GoalTemplate } from '../../../model/goal-template.model';
import { UserService } from '../../../core/services/user/user.service';
import { User } from '../../../model/user.model';
import { firstValueFrom } from 'rxjs';

type FlatNode = { goal: Goal; depth: number };
type TemplateFlatNode = { template: GoalTemplate; depth: number };
type TemplateDraftNode = {
  id?: number;
  tempId: number;
  name: string;
  description: string;
  target: number;
  children: TemplateDraftNode[];
};

@Component({
  selector: 'app-goal-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './goal-management.component.html',
})
export class GoalManagementComponent implements OnInit {
  goals: Goal[] = [];

  // Roots only
  rootGoals: Goal[] = [];
  activeRootGoals: Goal[] = [];
  completedMainRootGoals: Goal[] = [];
  paginatedRoots: Goal[] = [];

  // Templates
  templates: GoalTemplate[] = [];
  templateRoots: GoalTemplate[] = [];
  openedTemplateRootId: number | null = null;

  // Users
  users: User[] = [];

  // Fold: only one root open at a time
  openedRootId: number | null = null;
  completedMainSectionOpen = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;

  // Parent selection (2 lists)
  selectedRootId: number | null = null;
  subGoalsForSelectedRoot: Goal[] = [];

  // Form
  editingGoal: Goal | null = null;
  form = {
    name: '',
    description: '',
    target: 1,
    current: 0,
    parentId: null as number | null,
    pinned: false,
    userId: null as string | null,
  };
  formUserInput = '';

  templateDraftRoot: TemplateDraftNode = this.createDraftRoot();
  private nextTemplateTempId = 2;
  editingTemplateTreeRootId: number | null = null;
  templateApplyUserInput = '';
  templateApplyUserId: string | null = null;

  constructor(private goalService: GoalService, private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadGoals({ preserveUiState: true });
    this.loadTemplates();
  }

  // ----------------- Smooth scroll (utilisé seulement quand demandé) -----------------
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  isDone(goal: any): boolean {
    const doneByValue = (goal?.current ?? 0) >= (goal?.target ?? 0);
    const doneByFlag = !!goal?.completed;
    const children = goal?.subGoals ?? [];
    const doneByChildren = children.length > 0 && children.every((child: Goal) => this.isDone(child));
    return doneByValue || doneByFlag || doneByChildren;
  }

  getInitial(value?: string | null): string {
    const text = (value ?? '').trim();
    if (!text) return '?';
    return text.charAt(0).toUpperCase();
  }

  // ----------------- Load + preserve UI state -----------------
  loadGoals(opts?: { preserveUiState?: boolean }): void {
    const preserve = !!opts?.preserveUiState;

    // snapshot UI state
    const prevOpenedRootId = preserve ? this.openedRootId : null;
    const prevPage = preserve ? this.currentPage : 1;

    this.goalService.getAllGoals().subscribe((goals) => {
      this.goals = goals ?? [];
      this.rootGoals = this.sortGoalsAlphaDoneLast(
        this.goals.filter((g) => g.parentId === null)
      );
      this.activeRootGoals = this.rootGoals.filter((g) => !this.isDone(g));
      this.completedMainRootGoals = this.rootGoals.filter((g) => this.isDone(g));

      // clamp page (au cas où la liste a changé)
      this.currentPage = Math.min(Math.max(prevPage, 1), this.totalPages);

      // pagination SANS forcer fold
      this.updatePagination({ preserveOpened: true });

      // restore opened root if still visible on current page
      if (prevOpenedRootId != null) {
        const stillVisible =
          this.paginatedRoots.some((r) => r.id === prevOpenedRootId) ||
          this.completedMainRootGoals.some((r) => r.id === prevOpenedRootId);
        this.openedRootId = stillVisible ? prevOpenedRootId : null;
      } else if (!preserve) {
        this.openedRootId = null;
      }

      // si on était en train de choisir un root dans le form, on recalcule la 2e liste
      if (this.selectedRootId) {
        const root = this.rootGoals.find((r) => r.id === this.selectedRootId);
        this.subGoalsForSelectedRoot = root?.subGoals ?? [];
      }
    });
  }

  loadTemplates(): void {
    this.goalService.getAllTemplates().subscribe((templates) => {
      this.templates = templates ?? [];
      this.templateRoots = this.sortTemplatesAlpha(
        this.templates.filter((t) => t.parentId === null)
      );
    });
  }

  loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (res) => {
        this.users = res?.data ?? [];
      },
      error: (err) => console.error('Erreur chargement users:', err),
    });
  }

  // ----------------- Pagination (roots only) -----------------
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.activeRootGoals.length / this.itemsPerPage));
  }

  updatePagination(opts?: { preserveOpened?: boolean }): void {
    const preserveOpened = !!opts?.preserveOpened;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedRoots = this.activeRootGoals.slice(start, end);

    // Important : ne pas forcer fold ici, sinon ça replie à chaque refresh
    if (!preserveOpened) {
      this.openedRootId = null;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination({ preserveOpened: false });
      this.scrollToTop();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination({ preserveOpened: false });
      this.scrollToTop();
    }
  }

  // ----------------- Fold -----------------
  toggleRoot(root: Goal): void {
    // only one opened at a time
    this.openedRootId = this.openedRootId === root.id ? null : root.id;
    // pas de reload, juste scroll smooth comme demandé
    this.scrollToTop();
  }

  isRootOpen(root: Goal): boolean {
    return this.openedRootId === root.id;
  }

  toggleCompletedMainSection(): void {
    this.completedMainSectionOpen = !this.completedMainSectionOpen;
  }

  // ----------------- Hierarchy rendering -----------------
  getVisibleTree(root: Goal): FlatNode[] {
    const out: FlatNode[] = [];

    const walk = (node: Goal, depth: number) => {
      out.push({ goal: node, depth });
      this.sortGoalsAlphaDoneLast(node.subGoals ?? [])
        .forEach((c) => walk(c, depth + 1));
    };

    this.sortGoalsAlphaDoneLast(root.subGoals ?? []).forEach((c) => walk(c, 1));

    return out;
  }

  // ----------------- Parent selection (2 lists) -----------------
  onRootParentChange(): void {
    if (!this.selectedRootId) {
      this.subGoalsForSelectedRoot = [];
      this.form.parentId = null;
      return;
    }

    const root = this.rootGoals.find((g) => g.id === this.selectedRootId);
    this.subGoalsForSelectedRoot = root?.subGoals ?? [];

    // default: directly under root
    this.form.parentId = this.selectedRootId;
  }

  // ----------------- CRUD (refresh only list, keep unfold) -----------------
  createOrUpdateGoal(): void {
    const name = this.form.name.trim();
    if (!name || Number(this.form.target) <= 0) return;

    const payload: any = {
      name,
      description: (this.form.description ?? '').trim(),
      target: Number(this.form.target),
      current: Number(this.form.current ?? 0),
      parentId: this.form.parentId,
      pinned: !!this.form.pinned,
      userId: this.form.userId,
    };

    const req = this.editingGoal
      ? this.goalService.updateGoal(this.editingGoal.id, payload)
      : this.goalService.addGoal(payload);

    req.subscribe({
      next: () => {
        // on garde le root ouvert + page
        // (mais on ferme le form d’édition en reset)
        this.resetForm();
        this.loadGoals({ preserveUiState: true });
        this.scrollToTop();
      },
      error: (err) => {
        console.error('Erreur create/update goal:', err);
      },
    });
  }

  editGoal(goal: Goal): void {
    this.editingGoal = goal;

    this.form = {
      name: goal.name ?? '',
      description: (goal as any).description ?? '',
      target: (goal as any).target ?? 1,
      current: (goal as any).current ?? 0,
      parentId: goal.parentId ?? null,
      pinned: !!(goal as any).pinned,
      userId: (goal as any).userId ?? null,
    };
    this.formUserInput = (goal as any).username ?? '';

    // Setup 2 lists properly (root list + its subs)
    // On cherche le root dans la page courante si possible, sinon on laisse la sélection libre
    const rootId = this.findRootIdFor(goal.id);
    this.selectedRootId = rootId;
    this.onRootParentChange();

    // parentId réel (root / sub / null)
    this.form.parentId = goal.parentId ?? null;

    this.scrollToTop();
  }

  deleteGoal(id: number, name: string): void {
    if (!confirm(`Supprimer "${name}" ?`)) return;

    this.goalService.deleteGoal(id).subscribe({
      next: () => {
        this.loadGoals({ preserveUiState: true });
        this.scrollToTop();
      },
      error: (err) => console.error('Erreur suppression goal:', err),
    });
  }

  deleteTemplate(id: number, name: string): void {
    if (!confirm(`Supprimer le template "${name}" ?`)) return;

    this.goalService.deleteTemplate(id).subscribe({
      next: () => {
        if (this.editingTemplateTreeRootId === id) {
          this.resetTemplateDraft();
        }
        this.loadTemplates();
        this.scrollToTop();
      },
      error: (err) => console.error('Erreur suppression template:', err),
    });
  }

  editTemplate(template: GoalTemplate): void {
    this.editingTemplateTreeRootId = template.id;
    this.templateDraftRoot = this.mapTemplateToDraft(template);
    this.nextTemplateTempId = this.getMaxTempId(this.templateDraftRoot) + 1;
    this.scrollToTop();
  }

  applyTemplate(template: GoalTemplate): void {
    this.goalService.applyTemplate(template.id, { userId: this.templateApplyUserId }).subscribe({
      next: () => {
        this.loadGoals({ preserveUiState: true });
        this.scrollToTop();
      },
      error: (err) => console.error('Erreur application template:', err),
    });
  }

  createTemplateTree(): void {
    if (!this.isTemplateDraftValid(this.templateDraftRoot)) return;

    if (this.editingTemplateTreeRootId != null) {
      this.updateTemplateTree();
      return;
    }

    const payload = this.mapDraftToPayload(this.templateDraftRoot);
    this.goalService.addTemplateTree(payload).subscribe({
      next: () => {
        this.resetTemplateDraft();
        this.loadTemplates();
        this.scrollToTop();
      },
      error: (err) => console.error('Erreur creation template:', err),
    });
  }

  resetForm(): void {
    this.editingGoal = null;
    this.selectedRootId = null;
    this.subGoalsForSelectedRoot = [];
    this.formUserInput = '';
    this.form = {
      name: '',
      description: '',
      target: 1,
      current: 0,
      parentId: null,
      pinned: false,
      userId: null,
    };
  }

  // ----------------- Root finder for edit -----------------
  private findRootIdFor(goalId: number): number | null {
    for (const r of this.rootGoals) {
      if (r.id === goalId) return r.id;
      if (this.containsId(r.subGoals ?? [], goalId)) return r.id;
    }
    return null;
  }

  private containsTemplateId(nodes: GoalTemplate[], id: number): boolean {
    for (const n of nodes) {
      if (n.id === id) return true;
      if (n.subTemplates?.length && this.containsTemplateId(n.subTemplates, id)) return true;
    }
    return false;
  }

  private containsId(nodes: Goal[], id: number): boolean {
    for (const n of nodes) {
      if (n.id === id) return true;
      if (n.subGoals?.length && this.containsId(n.subGoals, id)) return true;
    }
    return false;
  }

  private sortGoalsAlphaDoneLast(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => {
      const aDone = this.isDone(a);
      const bDone = this.isDone(b);

      // 1️⃣ non terminés avant terminés
      if (aDone !== bDone) return aDone ? 1 : -1;

      // 2️⃣ alpha strict A → Z
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  private sortTemplatesAlpha(templates: GoalTemplate[]): GoalTemplate[] {
    return [...templates].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }

  toggleTemplateRoot(root: GoalTemplate): void {
    this.openedTemplateRootId = this.openedTemplateRootId === root.id ? null : root.id;
    this.scrollToTop();
  }

  isTemplateRootOpen(root: GoalTemplate): boolean {
    return this.openedTemplateRootId === root.id;
  }

  getVisibleTemplateTree(root: GoalTemplate): TemplateFlatNode[] {
    const out: TemplateFlatNode[] = [];

    const walk = (node: GoalTemplate, depth: number) => {
      out.push({ template: node, depth });
      this.sortTemplatesAlpha(node.subTemplates ?? []).forEach((c) => walk(c, depth + 1));
    };

    this.sortTemplatesAlpha(root.subTemplates ?? []).forEach((c) => walk(c, 1));

    return out;
  }

  private createDraftRoot(): TemplateDraftNode {
    return {
      tempId: 1,
      name: '',
      description: '',
      target: 1,
      children: [],
    };
  }

  addTemplateChild(node: TemplateDraftNode): void {
    node.children.push({
      tempId: this.nextTemplateTempId++,
      name: '',
      description: '',
      target: 1,
      children: [],
    });
  }

  removeTemplateNode(node: TemplateDraftNode): void {
    if (node === this.templateDraftRoot) return;
    this.templateDraftRoot.children = this.removeDraftNode(this.templateDraftRoot.children, node.tempId);
  }

  private removeDraftNode(nodes: TemplateDraftNode[], tempId: number): TemplateDraftNode[] {
    return nodes
      .filter((n) => n.tempId !== tempId)
      .map((n) => ({
        ...n,
        children: this.removeDraftNode(n.children, tempId),
      }));
  }

  resetTemplateDraft(): void {
    this.templateDraftRoot = this.createDraftRoot();
    this.nextTemplateTempId = 2;
    this.editingTemplateTreeRootId = null;
  }

  isTemplateDraftValid(node: TemplateDraftNode): boolean {
    if (!node.name?.trim() || Number(node.target) <= 0) return false;
    return node.children.every((child) => this.isTemplateDraftValid(child));
  }

  private mapDraftToPayload(node: TemplateDraftNode): any {
    return {
      name: node.name.trim(),
      description: (node.description ?? '').trim(),
      target: Number(node.target),
      subTemplates: (node.children ?? []).map((child) => this.mapDraftToPayload(child)),
    };
  }

  private mapTemplateToDraft(node: GoalTemplate): TemplateDraftNode {
    return {
      id: node.id,
      tempId: this.nextTemplateTempId++,
      name: node.name ?? '',
      description: node.description ?? '',
      target: node.target ?? 1,
      children: (node.subTemplates ?? []).map((child) => this.mapTemplateToDraft(child)),
    };
  }

  private getMaxTempId(node: TemplateDraftNode): number {
    const childrenMax = (node.children ?? []).reduce((acc, child) => Math.max(acc, this.getMaxTempId(child)), node.tempId);
    return Math.max(node.tempId, childrenMax);
  }

  private updateTemplateTree(): void {
    this.updateTemplateTreeAsync().catch((err) => {
      console.error('Erreur mise à jour template:', err);
    });
  }

  private async updateTemplateTreeAsync(): Promise<void> {
    await this.updateTemplateNode(this.templateDraftRoot, null);
    this.resetTemplateDraft();
    this.loadTemplates();
    this.scrollToTop();
  }

  private async updateTemplateNode(node: TemplateDraftNode, parentId: number | null): Promise<void> {
    if (!node.id) {
      throw new Error('Edition invalide: un noeud du template n’a pas d’identifiant.');
    }

    await firstValueFrom(this.goalService.updateTemplate(node.id, {
      name: node.name.trim(),
      description: (node.description ?? '').trim(),
      target: Number(node.target),
      parentId,
    }));

    for (const child of node.children ?? []) {
      await this.updateTemplateNode(child, node.id);
    }
  }

  onUserInputChange(): void {
    this.form.userId = this.resolveUserId(this.formUserInput);
  }

  onTemplateApplyUserInputChange(): void {
    this.templateApplyUserId = this.resolveUserId(this.templateApplyUserInput);
  }

  private resolveUserId(input: string): string | null {
    const value = (input ?? '').trim();
    if (!value) return null;
    const lowered = value.toLowerCase();
    const user = this.users.find((u) => (u.username ?? '').toLowerCase() === lowered);
    return user ? user.id : null;
  }

}
