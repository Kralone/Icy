
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { ItemCatalogItem, ItemCatalogService } from '../../../../../../core/services/item/item-catalog.service';
import { ShipService } from '../../../../../../core/services/ship/ship.service';
import { Ship } from '../../../../../../model/ship.model';
import {
  FitTabId,
  ModuleFilterId,
  normalizeFitTabId,
  normalizeModuleFilterId
} from '../../resources-guide-link.utils';

interface FitTabOption {
  id: FitTabId;
  title: string;
  subtitle: string;
  imageUrl: string;
}

interface MockToolRow {
  name: string;
  role: string;
  note: string;
}

interface ParsedStatLine {
  label: string;
  value: string | null;
}

interface ModuleFilterOption {
  id: ModuleFilterId;
  label: string;
}

@Component({
  selector: 'front-resources-fit-panel',
  standalone: true,
  imports: [],
  templateUrl: './resources-fit-panel.component.html',
  styleUrl: './resources-fit-panel.component.css'
})
export class ResourcesFitPanelComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('gadgetDialog') gadgetDialog?: ElementRef<HTMLDialogElement>;
  @Input() requestedTab: string | null = null;
  @Input() requestedModuleFilter: string | null = null;

  activeTab: FitTabId = 'ships';
  readonly fitTabs: FitTabOption[] = [
    {
      id: 'ships',
      title: 'Vaisseaux',
      subtitle: 'Fleet de minage',
      imageUrl: '/assets/images/home/activities/mining.jpg'
    },
    {
      id: 'modules',
      title: 'Modules',
      subtitle: 'Tetes et modules',
      imageUrl: 'https://media.starcitizen.tools/2/20/Helix_I_-_Terminal_Display_-_3.10.2.png'
    },
    {
      id: 'tools',
      title: 'Gadgets de minage',
      subtitle: 'Outils terrain',
      imageUrl: 'https://media.starcitizen.tools/9/97/Optimax_in-game_cutout_-_Mesh_BG_SCT_logo.jpg'
    }
  ];

  shipsLoading = false;
  shipsError = '';
  miningShips: Ship[] = [];
  private shipsSubscription?: Subscription;

  modulesLoading = false;
  modulesError = '';
  miningModuleItems: ItemCatalogItem[] = [];
  activeModuleFilter: ModuleFilterId = 'all';
  readonly moduleFilters: ModuleFilterOption[] = [
    { id: 'all', label: 'Tous' },
    { id: 'mining_laser', label: 'Tetes de minage' },
    { id: 'cargo_pod', label: 'Sacs cargo' }
  ];
  toolsLoading = false;
  toolsError = '';
  miningGadgetItems: ItemCatalogItem[] = [];
  selectedGadget: ItemCatalogItem | null = null;
  private toolsSubscription?: Subscription;
  private routeQuerySubscription?: Subscription;

  readonly toolRows: MockToolRow[] = [
    { name: 'Multitool + OreBit', role: 'Minage FPS', note: 'Essentiel pour extraction grottes et avant-postes' },
    { name: 'TruHold Tractor Beam', role: 'Manutention', note: 'Manipulation caisses et cargo en sortie de run' },
    { name: 'Pyro RYT / medpen', role: 'Survie', note: 'Gestion oxygene, blessures et mobilite terrain' },
    { name: 'Armure avec sac', role: 'Logistique perso', note: 'Capacite de transport durant les sorties FPS' }
  ];

  constructor(
    private readonly shipService: ShipService,
    private readonly itemCatalogService: ItemCatalogService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadMiningShips();
    this.loadMiningTools();
    this.applyRequestedState();
    this.routeQuerySubscription = this.route.queryParamMap.subscribe((queryMap) => {
      this.applyRequestedState(queryMap);
    });
  }

  ngOnDestroy(): void {
    if (this.shipsSubscription) {
      this.shipsSubscription.unsubscribe();
      this.shipsSubscription = undefined;
    }
    if (this.toolsSubscription) {
      this.toolsSubscription.unsubscribe();
      this.toolsSubscription = undefined;
    }
    if (this.routeQuerySubscription) {
      this.routeQuerySubscription.unsubscribe();
      this.routeQuerySubscription = undefined;
    }
    this.setPageScrollLocked(false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestedTab'] || changes['requestedModuleFilter']) {
      this.applyRequestedState();
    }
  }

  setActiveTab(tab: FitTabId): void {
    this.activeTab = tab;
  }

  trackShip(_: number, ship: Ship): string {
    return `${ship.id}-${ship.name}`;
  }

  trackName(_: number, row: { name: string }): string {
    return row.name;
  }

  trackTab(_: number, tab: FitTabOption): FitTabId {
    return tab.id;
  }

  trackModuleFilter(_: number, filter: ModuleFilterOption): ModuleFilterId {
    return filter.id;
  }

  setActiveModuleFilter(filter: ModuleFilterId): void {
    this.activeModuleFilter = filter;
  }

  filteredMiningModuleItems(): ItemCatalogItem[] {
    if (this.activeModuleFilter === 'all') {
      return this.miningModuleItems;
    }
    return this.miningModuleItems.filter((item) => this.moduleType(item) === this.activeModuleFilter);
  }

  openGadgetDetails(item: ItemCatalogItem): void {
    this.selectedGadget = item;
    this.setPageScrollLocked(true);
    setTimeout(() => {
      const dialog = this.gadgetDialog?.nativeElement;
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    });
  }

  closeGadgetDetails(): void {
    const dialog = this.gadgetDialog?.nativeElement;
    if (dialog && dialog.open) {
      dialog.close();
      return;
    }
    this.selectedGadget = null;
    this.setPageScrollLocked(false);
  }

  onGadgetDialogClosed(): void {
    this.selectedGadget = null;
    this.setPageScrollLocked(false);
  }

  onGadgetDialogClick(event: MouseEvent): void {
    const dialog = this.gadgetDialog?.nativeElement;
    if (dialog && event.target === dialog) {
      this.closeGadgetDetails();
    }
  }

  brandName(ship: Ship): string {
    return ship.brand?.name ?? 'Marque inconnue';
  }

  formatScu(value: number | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  formatStatLines(stats: string | null | undefined): ParsedStatLine[] {
    if (!stats) {
      return [];
    }

    return stats
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf(':');
        if (separatorIndex === -1) {
          return { label: part, value: null };
        }
        const label = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        return { label: label || part, value: value || null };
      });
  }

  private loadMiningShips(): void {
    this.shipsLoading = true;
    this.shipsError = '';

    this.shipsSubscription = this.shipService.getAllShips().subscribe({
      next: (response) => {
        const ships = response?.data ?? [];
        this.miningShips = ships
          .filter((ship) => this.isMiningShip(ship) && ship.flightReady === true)
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
        this.shipsLoading = false;
      },
      error: () => {
        this.shipsLoading = false;
        this.shipsError = 'Impossible de charger les vaisseaux de minage depuis le backend.';
      }
    });
  }

  private loadMiningTools(): void {
    this.modulesLoading = true;
    this.toolsLoading = true;
    this.modulesError = '';
    this.toolsError = '';

    this.toolsSubscription = this.itemCatalogService.listFrontItems().subscribe({
      next: (response) => {
        const items = response?.data ?? [];
        this.miningModuleItems = items
          .filter((item) => this.isMiningModule(item))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
        this.miningGadgetItems = items
          .filter((item) => this.isMiningGadget(item))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
        this.modulesLoading = false;
        this.toolsLoading = false;
      },
      error: () => {
        this.modulesLoading = false;
        this.toolsLoading = false;
        this.modulesError = 'Impossible de charger les modules de minage depuis le backend.';
        this.toolsError = 'Impossible de charger les outils de minage depuis le backend.';
      }
    });
  }

  private isMiningShip(ship: Ship): boolean {
    const focus = (ship.focus ?? '').toLowerCase();
    return focus.includes('mining') || focus.includes('mine') || focus.includes('minage') || focus.includes('extract');
  }

  private isMiningGadget(item: ItemCatalogItem): boolean {
    const category = (item.category?.name ?? '').toLowerCase();
    return category.includes('gadget') && category.includes('mining');
  }

  private isMiningModule(item: ItemCatalogItem): boolean {
    const category = (item.category?.name ?? '').toLowerCase();
    return category.includes('mining laser') || category.includes('cargo pod');
  }

  private moduleType(item: ItemCatalogItem): ModuleFilterId | null {
    const category = (item.category?.name ?? '').toLowerCase();
    if (category.includes('mining laser')) {
      return 'mining_laser';
    }
    if (category.includes('cargo pod')) {
      return 'cargo_pod';
    }
    return null;
  }

  private setPageScrollLocked(locked: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  private applyRequestedState(queryMap?: ParamMap): void {
    const routeQueryMap = queryMap ?? this.route.snapshot.queryParamMap;
    const requestedFilter = normalizeModuleFilterId(this.requestedModuleFilter)
      ?? normalizeModuleFilterId(routeQueryMap.get('fitFilter'));
    const requestedTab = normalizeFitTabId(this.requestedTab)
      ?? normalizeFitTabId(routeQueryMap.get('fitTab'));

    if (requestedFilter) {
      this.activeModuleFilter = requestedFilter;
      this.activeTab = 'modules';
      return;
    }

    if (requestedTab) {
      this.activeTab = requestedTab;
    }
  }
}
