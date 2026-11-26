import { CatalogCorrectionsComponent } from '../catalog-corrections/catalog-corrections.component';
import { CatalogIconComponent, CatalogIconKey, FAMILY_ICONS } from '../../../shared/catalog-icon/catalog-icon.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CatalogEntry,
  CatalogGroup,
  CatalogImageFilter,
  CatalogOffer,
  CatalogPage,
  CatalogService,
  CatalogSort,
  CatalogStatusFilter
} from '../../../core/services/catalog/catalog.service';

type FamilyOption = { value: string; label: string; shortLabel: string };

const VIEW_MODE_KEY = 'icy.catalog.viewMode';
export const DEFAULT_FAMILY_TONE = '203 213 225';
export const WIKELO_TONE = '196 181 253';
/** Grands groupes de familles et leur couleur, dans l'ordre d'affichage. */
export const FAMILY_GROUPS: { label: string; tone: string; families: string[] }[] = [
  { label: 'Vaisseaux et véhicules', tone: '34 211 238', families: ['SHIP', 'GROUND_VEHICLE', 'POWER_SUIT'] },
  { label: 'Armement', tone: '248 113 113', families: ['FPS_WEAPON', 'SHIP_WEAPON', 'ARMOR'] },
  { label: 'Équipement', tone: '251 146 60', families: ['SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM'] },
  { label: 'Lieux', tone: '52 211 153', families: ['SYSTEM', 'PLANET', 'MOON', 'CITY', 'STATION', 'JUMP_POINT', 'OUTPOST', 'LOCATION'] },
  { label: 'Ressources', tone: '251 191 36', families: ['COMMODITY'] }
];

@Component({
  selector: 'app-catalog-browser',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CatalogCorrectionsComponent, CatalogIconComponent],
  templateUrl: './catalog-browser.component.html',
  styleUrl: './catalog-browser.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class CatalogBrowserComponent implements OnInit, OnDestroy {
  @ViewChild('catalogTop') catalogTop?: ElementRef<HTMLElement>;

  readonly families: FamilyOption[] = [
    { value: 'SHIP', label: 'Vaisseaux', shortLabel: 'Vaisseaux' },
    { value: 'GROUND_VEHICLE', label: 'Véhicules terrestres', shortLabel: 'Véhicules' },
    { value: 'POWER_SUIT', label: 'Armures motorisées', shortLabel: 'Armures motorisées' },
    { value: 'FPS_WEAPON', label: 'Armes FPS', shortLabel: 'Armes FPS' },
    { value: 'SHIP_WEAPON', label: 'Armes de vaisseau', shortLabel: 'Armes de vaisseau' },
    { value: 'ARMOR', label: 'Armures', shortLabel: 'Armures' },
    { value: 'SHIP_COMPONENT', label: 'Composants', shortLabel: 'Composants' },
    { value: 'MODULE', label: 'Modules', shortLabel: 'Modules' },
    { value: 'TOOL', label: 'Outils', shortLabel: 'Outils' },
    { value: 'ITEM', label: 'Autres objets', shortLabel: 'Objets' },
    { value: 'SYSTEM', label: 'Systèmes', shortLabel: 'Systèmes' },
    { value: 'PLANET', label: 'Planètes', shortLabel: 'Planètes' },
    { value: 'MOON', label: 'Lunes', shortLabel: 'Lunes' },
    { value: 'CITY', label: 'Villes', shortLabel: 'Villes' },
    { value: 'STATION', label: 'Stations', shortLabel: 'Stations' },
    { value: 'JUMP_POINT', label: 'Points de saut', shortLabel: 'Points de saut' },
    { value: 'OUTPOST', label: 'Avant-postes', shortLabel: 'Avant-postes' },
    { value: 'LOCATION', label: 'Autres lieux', shortLabel: 'Lieux' },
    { value: 'COMMODITY', label: 'Ressources et minerais', shortLabel: 'Ressources' }
  ];
  readonly wikeloFamilies = this.families.filter((family) => [
    'SHIP', 'GROUND_VEHICLE', 'POWER_SUIT', 'FPS_WEAPON', 'SHIP_WEAPON',
    'ARMOR', 'SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM'
  ].includes(family.value));
  readonly wikeloTone = WIKELO_TONE;
  readonly standardFamilies = this.families.filter((family) => family.value !== 'SHIP');

  canCorrect = false;
  viewMode: 'grid' | 'list' = 'grid';
  /** Filtres dépliés sur mobile ; sur grand écran, ils restent toujours visibles. */
  filtersOpen = false;
  correctionsOpen = false;
  imageCorrectionOpen = false;

  search = '';
  family = '';
  catalogGroup: CatalogGroup = 'ALL';
  status: CatalogStatusFilter = 'ACTIVE';
  image: CatalogImageFilter = 'ALL';
  source = '';
  sort: CatalogSort = 'name';
  pageSize = 24;

  result: CatalogPage | null = null;
  selectedEntry: CatalogEntry | null = null;
  loading = false;
  error = '';

  private readonly catalogService = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private routeSubscription?: Subscription;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private request?: Subscription;
  private previousBodyOverflow: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly currencyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  ngOnInit(): void {
    try { if (localStorage.getItem(VIEW_MODE_KEY) === 'list') this.viewMode = 'list'; } catch { /* stockage indisponible */ }
    this.catalogService.canCorrect().subscribe(allowed => this.canCorrect = allowed);
    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      const family = params.get('family') || '';
      this.family = this.families.some(option => option.value === family) ? family : '';
      const group = params.get('catalogGroup') || (this.family ? 'STANDARD' : 'ALL');
      this.catalogGroup = ['ALL', 'STANDARD', 'WIKELO', 'PYAM_EXEC', 'BATTAGLIA'].includes(group)
        ? group as CatalogGroup : 'ALL';
      this.search = params.get('q') || '';
      this.load(0, false);
    });
  }

  ngOnDestroy(): void {
    this.closeDetails();
    this.request?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDetails();
  }

  onSearchChange(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(0, false), 280);
  }

  applyFilters(): void {
    this.load(0, false);
  }

  selectFamily(value: string): void {
    this.family = value;
    this.catalogGroup = value ? 'STANDARD' : 'ALL';
    this.load(0, false);
  }

  selectShipGroup(group: Exclude<CatalogGroup, 'ALL' | 'WIKELO'>): void {
    this.family = 'SHIP';
    this.catalogGroup = group;
    this.load(0, false);
  }

  selectWikelo(family = ''): void {
    this.family = family;
    this.catalogGroup = 'WIKELO';
    this.load(0, false);
  }

  resetFilters(): void {
    this.search = '';
    this.family = '';
    this.catalogGroup = 'ALL';
    this.status = 'ACTIVE';
    this.image = 'ALL';
    this.source = '';
    this.sort = 'name';
    this.load(0, false);
  }

  goToPage(page: number): void {
    if (!this.result || page < 0 || page >= this.result.totalPages || page === this.result.page) return;
    this.load(page, true);
  }

  openDetails(entry: CatalogEntry): void {
    this.selectedEntry = entry;
    this.imageCorrectionOpen = false;
    if (this.browser) {
      if (this.previousBodyOverflow === null) this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  closeDetails(): void {
    this.selectedEntry = null;
    if (this.browser && this.previousBodyOverflow !== null) {
      document.body.style.overflow = this.previousBodyOverflow;
      this.previousBodyOverflow = null;
    }
  }

  familyLabel(value: string): string {
    return this.families.find((family) => family.value === value)?.label ?? value.replaceAll('_', ' ');
  }

  groupCount(group: Exclude<CatalogGroup, 'ALL'>): number {
    return this.result?.groupCounts?.[group] ?? 0;
  }

  groupFamilyCount(group: Exclude<CatalogGroup, 'ALL'>, family: string): number {
    return this.result?.groupFamilyCounts?.[group]?.[family] ?? 0;
  }

  readonly shipVariants: { value: 'STANDARD' | 'PYAM_EXEC' | 'BATTAGLIA'; label: string }[] = [
    { value: 'STANDARD', label: 'Standard' }, { value: 'PYAM_EXEC', label: 'PYAM Exec' }, { value: 'BATTAGLIA', label: 'Battaglia' }
  ];

  readonly groupIcons: Record<string, CatalogIconKey> = {
    'Vaisseaux et véhicules': 'ship', Armement: 'weapon', 'Équipement': 'component', Lieux: 'planet', Ressources: 'ore'
  };

  /** Grand groupe affiché dans la barre : celui de la famille choisie, Wikelo ou Tout. */
  get activeGroupLabel(): string {
    if (this.catalogGroup === 'WIKELO') return 'Wikelo';
    if (!this.family) return 'Tout';
    return FAMILY_GROUPS.find((group) => group.families.includes(this.family))?.label ?? 'Tout';
  }

  get activeGroup(): { label: string; tone: string; ships: boolean; families: FamilyOption[] } | null {
    return this.familyGroups.find((group) => group.label === this.activeGroupLabel) ?? null;
  }

  groupTotal(group: { ships: boolean; families: FamilyOption[] }): number {
    return (group.ships ? this.nonWikeloShipCount : 0)
      + group.families.reduce((total, option) => total + this.groupFamilyCount('STANDARD', option.value), 0);
  }

  /** Un grand groupe ouvre sa première famille. */
  selectGroup(group: { ships: boolean; families: FamilyOption[] }): void {
    if (group.ships) this.selectShipGroup('STANDARD');
    else if (group.families.length) this.selectFamily(group.families[0].value);
  }

  /** Filtres modifiés par rapport aux valeurs par défaut, signalés sur le bouton mobile. */
  get activeFilterCount(): number {
    return [this.status !== 'ACTIVE', this.image !== 'ALL', !!this.source, this.sort !== 'name'].filter(Boolean).length;
  }

  familyIcon(value: string): CatalogIconKey {
    return FAMILY_ICONS[value] ?? 'item';
  }

  get nonWikeloShipCount(): number {
    return this.groupFamilyCount('STANDARD', 'SHIP')
      + this.groupFamilyCount('PYAM_EXEC', 'SHIP')
      + this.groupFamilyCount('BATTAGLIA', 'SHIP');
  }

  get resultTitle(): string {
    if (this.catalogGroup === 'WIKELO') {
      return this.family ? `Wikelo · ${this.familyLabel(this.family)}` : 'Wikelo';
    }
    if (this.catalogGroup === 'PYAM_EXEC') return 'Vaisseaux · PYAM Exec';
    if (this.catalogGroup === 'BATTAGLIA') return 'Vaisseaux · Battaglia';
    if (this.family) return this.familyLabel(this.family);
    return 'Tout le catalogue';
  }

  /** Couleur (triplet RVB) du grand groupe d'une famille, pour les pastilles, les cartes et le détail. */
  familyTone(value: string): string {
    return FAMILY_GROUPS.find((group) => group.families.includes(value))?.tone ?? DEFAULT_FAMILY_TONE;
  }

  /** Familles rangées par grand groupe ; une famille vide n'apparaît que si elle est sélectionnée. */
  get familyGroups(): { label: string; tone: string; ships: boolean; families: FamilyOption[] }[] {
    return FAMILY_GROUPS
      .map((group) => ({
        label: group.label,
        tone: group.tone,
        ships: group.families.includes('SHIP') && (this.nonWikeloShipCount > 0 || (this.family === 'SHIP' && this.catalogGroup !== 'WIKELO')),
        families: this.standardFamilies.filter((option) => group.families.includes(option.value)
          && (this.groupFamilyCount('STANDARD', option.value) > 0 || this.isStandardFamily(option.value)))
      }))
      .filter((group) => group.ships || group.families.length > 0);
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* stockage indisponible : le choix vaut pour la visite */ }
  }

  /** Les lieux ont des visuels de paysage : on les recadre au lieu de les inscrire en entier. */
  isPlace(family: string): boolean {
    return FAMILY_GROUPS[3].families.includes(family);
  }

  entryTone(entry: CatalogEntry): string {
    return entry.catalogGroup === 'WIKELO' ? WIKELO_TONE : this.familyTone(entry.family);
  }

  isStandardFamily(value: string): boolean {
    return this.family === value && this.catalogGroup === 'STANDARD';
  }

  cheapestOffer(entry: CatalogEntry): CatalogOffer | null {
    const offers = entry.offers.filter((offer) => offer.price > 0 && ['BUY', 'RENT'].includes(offer.type));
    return offers.length ? offers.reduce((best, offer) => offer.price < best.price ? offer : best) : null;
  }

  offerPlace(offer: CatalogOffer): string | null {
    const parts = [offer.planetName ?? offer.systemName, offer.moonName, offer.placeName]
      .map((part) => part?.trim())
      .filter((part): part is string => !!part);
    return offer.placeName?.trim() ? [...new Set(parts)].join(' → ') : null;
  }

  offerLabel(type: string): string {
    return ({ BUY: 'Achat', SELL: 'Vente', RENT: 'Location', WIKELO: 'Wikelo' } as Record<string, string>)[type] ?? type;
  }

  formatPrice(price: number, currency: string): string {
    return `${this.currencyFormatter.format(price)} ${currency}`;
  }

  imageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/images/catalog/catalog-fallback.svg')) {
      image.src = '/assets/images/catalog/catalog-fallback.svg';
    }
  }

  trackEntry(_: number, entry: CatalogEntry): number {
    return entry.id;
  }

  get visiblePages(): number[] {
    const total = this.result?.totalPages ?? 0;
    const current = this.result?.page ?? 0;
    if (total <= 1) return [];
    const start = Math.max(0, Math.min(current - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  }

  private load(page: number, scroll: boolean): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.request = this.catalogService.browse({
      query: this.search,
      family: this.family,
      catalogGroup: this.catalogGroup,
      status: this.status,
      image: this.image,
      source: this.source,
      sort: this.sort,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: (response) => {
        this.result = response.data;
        this.loading = false;
        if (scroll && this.browser) this.catalogTop?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger le catalogue pour le moment.';
      }
    });
  }
}
