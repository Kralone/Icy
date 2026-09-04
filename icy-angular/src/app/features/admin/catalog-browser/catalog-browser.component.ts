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
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CatalogEntry,
  CatalogImageFilter,
  CatalogOffer,
  CatalogPage,
  CatalogService,
  CatalogSort,
  CatalogStatusFilter
} from '../../../core/services/catalog/catalog.service';

type FamilyOption = { value: string; label: string; shortLabel: string };

@Component({
  selector: 'app-catalog-browser',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './catalog-browser.component.html',
  styleUrl: './catalog-browser.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class CatalogBrowserComponent implements OnInit, OnDestroy {
  @ViewChild('catalogTop') catalogTop?: ElementRef<HTMLElement>;

  readonly families: FamilyOption[] = [
    { value: '', label: 'Tout le catalogue', shortLabel: 'Tout' },
    { value: 'SHIP', label: 'Vaisseaux', shortLabel: 'Vaisseaux' },
    { value: 'GROUND_VEHICLE', label: 'Véhicules terrestres', shortLabel: 'Véhicules' },
    { value: 'POWER_SUIT', label: 'Armures motorisées', shortLabel: 'Power suits' },
    { value: 'FPS_WEAPON', label: 'Armes FPS', shortLabel: 'Armes FPS' },
    { value: 'SHIP_WEAPON', label: 'Armes de vaisseau', shortLabel: 'Armes ship' },
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
    { value: 'JUMP_POINT', label: 'Points de saut', shortLabel: 'Jump points' },
    { value: 'OUTPOST', label: 'Avant-postes', shortLabel: 'Avant-postes' },
    { value: 'LOCATION', label: 'Autres lieux', shortLabel: 'Lieux' }
  ];

  search = '';
  family = '';
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
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private request?: Subscription;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly currencyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  ngOnInit(): void {
    this.load(0, false);
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
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
    this.load(0, false);
  }

  resetFilters(): void {
    this.search = '';
    this.family = '';
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
    if (this.browser) document.body.style.overflow = 'hidden';
  }

  closeDetails(): void {
    this.selectedEntry = null;
    if (this.browser) document.body.style.overflow = '';
  }

  familyLabel(value: string): string {
    return this.families.find((family) => family.value === value)?.label ?? value.replaceAll('_', ' ');
  }

  familyCount(value: string): number {
    if (!value) return this.result?.activeElements ?? 0;
    return this.result?.familyCounts?.[value] ?? 0;
  }

  familyTone(value: string): string {
    if (['SHIP', 'GROUND_VEHICLE', 'POWER_SUIT'].includes(value)) return 'cyan';
    if (['FPS_WEAPON', 'SHIP_WEAPON', 'ARMOR'].includes(value)) return 'rose';
    if (['SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM'].includes(value)) return 'amber';
    return 'violet';
  }

  cheapestOffer(entry: CatalogEntry): CatalogOffer | null {
    const offers = entry.offers.filter((offer) => offer.price > 0 && ['BUY', 'RENT'].includes(offer.type));
    return offers.length ? offers.reduce((best, offer) => offer.price < best.price ? offer : best) : null;
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
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.messageDetail?.message
          ?? error?.error?.message
          ?? 'Impossible de charger le catalogue pour le moment.';
      }
    });
  }
}
