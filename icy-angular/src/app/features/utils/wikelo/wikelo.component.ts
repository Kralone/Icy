
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { WikeloService } from '../../../core/services/wikelo/wikelo.service';
import { WikeloShip } from '../../../model/wikelo-ship.model';
import { UserService } from '../../../core/services/user/user.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { Ship } from '../../../model/ship.model';
import { GoalService } from '../../../core/services/goal/goal.service';
import { User } from '../../../model/user.model';
import { Goal } from '../../../model/goal.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { utilityRouteFor } from '../utility-route-context';

@Component({
  standalone: true,
  selector: 'app-wikelo',
  imports: [FormsModule, RouterLink],
  templateUrl: './wikelo.component.html',
  styleUrl: './wikelo.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('detailsExpand', [
      transition(':enter', [
        style({ height: '0px', opacity: 0, transform: 'translateY(-6px)' }),
        animate('280ms cubic-bezier(0.22, 1, 0.36, 1)', style({ height: '*', opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, transform: 'translateY(0)' }),
        animate('220ms cubic-bezier(0.4, 0, 1, 1)', style({ height: '0px', opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ]
})
export class WikeloComponent implements OnInit {
  ships: WikeloShip[] = [];
  catalogShips: Ship[] = [];
  users: User[] = [];
  searchTerm = '';
  expandedShipName: string | null = null;
  selectedGoalShip: WikeloShip | null = null;
  isGoalModalOpen = false;
  goalAssignUserInput = '';
  goalAssignUserId: string | null = null;
  goalCreateStatus = '';
  isCreatingGoal = false;
  isLoading = true;
  isRescraping = false;
  errorMessage = '';
  canRescrape = false;

  constructor(
    private wikeloService: WikeloService,
    private userService: UserService,
    private shipService: ShipService,
    private goalService: GoalService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.resolveCanRescrape();
    this.loadCatalogShips();
    this.loadShips();
  }

  get lastScrapedAt(): string | null {
    if (!this.ships.length) return null;
    const sorted = [...this.ships].sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    return sorted[0]?.scrapedAt ?? null;
  }

  get backToMenuLink(): string {
    return utilityRouteFor(this.router.url);
  }

  get filteredShips(): WikeloShip[] {
    const normalizedSearch = this.normalizeName(this.searchTerm);
    if (!normalizedSearch) return this.ships;

    return this.ships.filter((ship) => {
      const name = this.normalizeName(ship.shipName);
      const components = this.normalizeName(ship.componentsText ?? '');
      const cost = this.normalizeName(ship.costText ?? '');
      return name.includes(normalizedSearch) || components.includes(normalizedSearch) || cost.includes(normalizedSearch);
    });
  }

  get searchSuggestions(): string[] {
    const normalizedSearch = this.normalizeName(this.searchTerm);
    if (!normalizedSearch) {
      return this.ships.slice(0, 8).map((ship) => ship.shipName);
    }

    return this.ships
      .map((ship) => ship.shipName)
      .filter((shipName) => this.normalizeName(shipName).includes(normalizedSearch))
      .slice(0, 8);
  }

  getShipImage(shipName: string): string | null {
    return this.getCatalogShip(shipName)?.imageUrl ?? null;
  }

  getCatalogShip(shipName: string): Ship | null {
    const normalizedTarget = this.normalizeName(shipName);

    const exact = this.catalogShips.find((ship) => this.normalizeName(ship.name) === normalizedTarget);
    if (exact) return exact;

    const includes = this.catalogShips.find((ship) => {
      const current = this.normalizeName(ship.name);
      return current.includes(normalizedTarget) || normalizedTarget.includes(current);
    });
    return includes ?? null;
  }

  toggleDetails(shipName: string): void {
    this.expandedShipName = this.expandedShipName === shipName ? null : shipName;
  }

  isExpanded(shipName: string): boolean {
    return this.expandedShipName === shipName;
  }

  summarize(value: string | null | undefined, maxLength = 120): string {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  toParts(value: string | null | undefined): string[] {
    return (value ?? '')
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  toCommaParts(value: string | null | undefined): string[] {
    return (value ?? '')
      .replace(/\|/g, ',')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  getReputationTier(reputationText: string | null | undefined): number {
    const text = (reputationText ?? '').trim();
    if (!text) return 0;

    const matched = text.match(/(\d+)/);
    const score = matched ? Number.parseInt(matched[1], 10) : 0;
    if (score >= 900) return 2;
    if (score >= 1) return 1;
    return 0;
  }

  getPreviewComponents(value: string | null | undefined, limit = 4): string[] {
    return this.toParts(value).slice(0, limit);
  }

  getRemainingComponentCount(value: string | null | undefined, limit = 4): number {
    return Math.max(0, this.toParts(value).length - limit);
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  openGoalModal(ship: WikeloShip): void {
    this.selectedGoalShip = ship;
    this.goalAssignUserInput = '';
    this.goalAssignUserId = null;
    this.goalCreateStatus = '';
    this.isGoalModalOpen = true;
  }

  closeGoalModal(): void {
    this.isGoalModalOpen = false;
    this.selectedGoalShip = null;
    this.goalAssignUserInput = '';
    this.goalAssignUserId = null;
  }

  onGoalUserInputChange(): void {
    const value = this.goalAssignUserInput.trim().toLowerCase();
    if (!value) {
      this.goalAssignUserId = null;
      return;
    }
    const matchedUser = this.users.find((user) => (user.username ?? '').toLowerCase() === value);
    this.goalAssignUserId = matchedUser?.id ?? null;
  }

  getGoalPreviewIngredients(): Array<{ name: string; target: number }> {
    if (!this.selectedGoalShip) return [];
    return this.toCommaParts(this.selectedGoalShip.costText).map((part) => this.parseIngredient(part));
  }

  async confirmCreateGoal(): Promise<void> {
    if (!this.selectedGoalShip || this.isCreatingGoal) return;

    this.goalCreateStatus = '';
    this.isCreatingGoal = true;
    try {
      const ingredients = this.getGoalPreviewIngredients();
      const parentPayload = {
        name: `Wikelo - ${this.selectedGoalShip.shipName}`,
        description: `Objectif Wikelo pour ${this.selectedGoalShip.shipName}`,
        target: Math.max(ingredients.length, 1),
        current: 0,
        parentId: null,
        pinned: false,
        userId: this.goalAssignUserId
      };

      const parentGoal = await firstValueFrom(this.goalService.addGoal(parentPayload));
      const parentId = this.resolveGoalIdFromResponse(parentGoal)
        ?? await this.resolveCreatedParentId(parentPayload.name, this.goalAssignUserId);

      if (!parentId) {
        throw new Error('Creation du parent impossible (id manquant).');
      }

      for (const ingredient of ingredients) {
        const childPayload = {
          name: ingredient.name,
          description: `Ingredient Wikelo pour ${this.selectedGoalShip.shipName}`,
          target: ingredient.target,
          current: 0,
          parentId,
          pinned: false,
          userId: this.goalAssignUserId
        };
        await firstValueFrom(this.goalService.addGoal(childPayload));
      }

      this.goalCreateStatus = 'Objectif cree avec succes.';
      this.closeGoalModal();
    } catch (error) {
      console.error(error);
      this.goalCreateStatus = 'Echec de creation de l objectif.';
    } finally {
      this.isCreatingGoal = false;
    }
  }

  loadShips(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.wikeloService.getShips()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.ships = response.data ?? [];
          this.expandedShipName = null;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les donnees Wikelo.';
        }
      });
  }

  triggerRescrape(): void {
    if (!this.canRescrape || this.isRescraping) return;

    const confirmed = window.confirm('Rescraper les donnees Wikelo maintenant ? Cette action va remplacer les donnees en base.');
    if (!confirmed) return;

    this.errorMessage = '';
    this.isRescraping = true;
    this.wikeloService.rescrapeShips()
      .pipe(finalize(() => this.isRescraping = false))
      .subscribe({
        next: (response) => {
          this.ships = response.data ?? [];
          this.expandedShipName = null;
        },
        error: () => {
          this.errorMessage = 'Le rescrape a echoue.';
        }
      });
  }

  private resolveCanRescrape(): void {
    if (!this.authService.hasToken()) {
      this.canRescrape = false;
      return;
    }

    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.canRescrape = roles.includes('ADMIN') || roles.includes('OFFICIER');
        if (this.canRescrape) {
          this.loadUsers();
        }
      },
      error: () => {
        this.canRescrape = false;
      }
    });
  }

  private loadCatalogShips(): void {
    this.shipService.getAllShips().subscribe({
      next: (response) => {
        this.catalogShips = response.data ?? [];
      },
      error: () => {
        this.catalogShips = [];
      }
    });
  }

  private loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response?.data ?? [];
      },
      error: () => {
        this.users = [];
      }
    });
  }

  private normalizeName(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private parseIngredient(rawValue: string): { name: string; target: number } {
    const cleaned = (rawValue ?? '').trim();
    const matched = cleaned.match(/^(\d+)\s*[xX]\s*(.+)$/);
    if (matched) {
      return {
        target: Number.parseInt(matched[1], 10),
        name: matched[2].trim()
      };
    }
    return { name: cleaned, target: 1 };
  }

  private resolveGoalIdFromResponse(response: any): number | null {
    const directId = Number(response?.id);
    if (Number.isFinite(directId) && directId > 0) return directId;

    const dataId = Number(response?.data?.id);
    if (Number.isFinite(dataId) && dataId > 0) return dataId;

    const nestedId = Number(response?.goal?.id);
    if (Number.isFinite(nestedId) && nestedId > 0) return nestedId;

    return null;
  }

  private async resolveCreatedParentId(name: string, userId: string | null): Promise<number | null> {
    const normalizedName = (name ?? '').trim();
    for (let attempt = 0; attempt < 3; attempt++) {
      const goals = await firstValueFrom(this.goalService.getAllGoals());
      const matches = (goals ?? [])
        .filter((goal: Goal) =>
          goal.parentId === null
          && (goal.name ?? '').trim() === normalizedName
          && (goal.userId ?? null) === (userId ?? null))
        .sort((left, right) => {
          const leftDate = new Date(left.createdAt ?? 0).getTime();
          const rightDate = new Date(right.createdAt ?? 0).getTime();
          if (rightDate !== leftDate) return rightDate - leftDate;
          return (right.id ?? 0) - (left.id ?? 0);
        });

      if (matches.length) return matches[0].id;
      await this.wait(120);
    }

    return null;
  }

  private wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
