
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { ItemCatalogItem } from '../../../../../../core/services/item/item-catalog.service';
import { HttpClient } from '@angular/common/http';
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

interface MiningCatalogRow {
  id: number; name: string; manufacturer: string | null; description: string | null;
  imageUrl: string | null; focus: string | null; scu: number | null;
  size: string | null; crew: string | null; flightReady: boolean | null;
  sourceImageUrl: string | null; sourceUrl: string | null; gameVersion: string | null; updatedAt: string | null;
  kind: 'ship' | 'gadget' | 'mining_laser' | 'module' | 'cargo_pod';
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
  private catalogMetadata = new Map<number, MiningCatalogRow>();
  selectedGadget: ItemCatalogItem | null = null;
  private toolsSubscription?: Subscription;
  private routeQuerySubscription?: Subscription;


  constructor(
    private readonly http: HttpClient,


    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {

    this.loadUnifiedCatalog();

    this.applyRequestedState();
    this.routeQuerySubscription = this.route.queryParamMap.subscribe((queryMap) => {
      this.applyRequestedState(queryMap);
    });
  }

  private loadUnifiedCatalog(): void {
    this.shipsLoading = this.modulesLoading = this.toolsLoading = true;
    this.shipsError = this.modulesError = this.toolsError = '';
    this.shipsSubscription = this.http.get<{data: MiningCatalogRow[]}>('/api/front/resources/mining-equipment').subscribe({
      next: ({data}) => {
        const rows = data ?? [];
        this.catalogMetadata = new Map(rows.map(row => [row.id, row]));
        this.miningShips = rows.filter(row => row.kind === 'ship').map(row => ({
          id: row.id, name: row.name, brand: {name: row.manufacturer ?? ''},
          imageUrl: row.imageUrl ?? '', focus: row.focus ?? '', scu: row.scu,
          size: row.size ?? undefined, crew: row.crew ?? '', notes: row.description ?? undefined
        }));
        const item = (row: MiningCatalogRow): ItemCatalogItem => ({
          id: row.id, name: row.name, manufacturer: row.manufacturer, imageUrl: row.imageUrl,
          description: row.description, stats: null,
          category: {id: row.id, name: ({gadget: 'Gadget de minage', mining_laser: 'Tête de minage', module: 'Module de minage', cargo_pod: 'Sac cargo', ship: 'Vaisseau'})[row.kind]}
        });
        this.miningModuleItems = rows.filter(row => ['mining_laser', 'module', 'cargo_pod'].includes(row.kind)).map(item);
        this.miningGadgetItems = rows.filter(row => row.kind === 'gadget').map(item);
        this.shipsLoading = this.modulesLoading = this.toolsLoading = false;
      },
      error: () => {
        this.shipsLoading = this.modulesLoading = this.toolsLoading = false;
        this.shipsError = this.modulesError = this.toolsError = 'Impossible de charger le catalogue de minage.';
      }
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

  itemProvenance(id: number | undefined): string {
    const row = id === undefined ? undefined : this.catalogMetadata.get(id);
    return `${row?.gameVersion || 'Version non renseignée'} · ${row?.updatedAt ? this.formatDate(row.updatedAt) : 'Date source inconnue'}`;
  }

  formatDate(value: string | null): string {
    if (!value) return 'date non renseignée';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fr-FR');
  }

  formatScu(value: number | null | undefined): string {
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

  private moduleType(item: ItemCatalogItem): ModuleFilterId | null {
    const category = (item.category?.name ?? '').toLowerCase();
    if (category.includes('tête de minage')) {
      return 'mining_laser';
    }
    if (category.includes('sac cargo')) {
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
