import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogPage, CatalogService } from '../../../core/services/catalog/catalog.service';
import { OreLocationService } from '../../../core/services/ore/ore-location.service';
import { CatalogIconComponent, CatalogIconKey } from '../../../shared/catalog-icon/catalog-icon.component';

type CatalogShortcut = { label: string; icon: CatalogIconKey; family: string; catalogGroup?: string };

/** Domaine du catalogue : une carte avec ses familles, chacune avec son nombre de fiches. */
type CatalogDomain = {
  label: string;
  icon: CatalogIconKey;
  tone: string;
  imageUrl: string;
  queryParams: Record<string, string>;
  shortcuts: CatalogShortcut[];
};

/** Lien secondaire (ressources, médias, maintenance), au format des cartes du menu d'administration. */
type HubLink = { label: string; description: string; icon: CatalogIconKey; imageUrl: string; route: string; queryParams?: Record<string, string> };
type HubGroup = { label: string; tone: string; links: HubLink[] };

@Component({
  selector: 'app-data-menu',
  standalone: true,
  imports: [RouterLink, FormsModule, CatalogIconComponent],
  templateUrl: './data-menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './data-menu.component.css'
})
export class DataMenuComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly oreLocationService = inject(OreLocationService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);

  search = '';
  counts: CatalogPage | null = null;
  oreZones: number | null = null;
  oreCount: number | null = null;

  readonly domains: CatalogDomain[] = [
    {
      label: 'Vaisseaux et véhicules', icon: 'ship', tone: '34 211 238',
      queryParams: {family: 'SHIP', catalogGroup: 'STANDARD'},
      imageUrl: 'https://media.starcitizen.tools/thumb/e/e2/SC_MultiShip_Roles.jpg/800px-SC_MultiShip_Roles.jpg.webp',
      shortcuts: [
        {label: 'Vaisseaux', icon: 'ship', family: 'SHIP', catalogGroup: 'STANDARD'},
        {label: 'Wikelo', icon: 'item', family: 'SHIP', catalogGroup: 'WIKELO'},
        {label: 'PYAM Exec', icon: 'ship', family: 'SHIP', catalogGroup: 'PYAM_EXEC'},
        {label: 'Battaglia', icon: 'ship', family: 'SHIP', catalogGroup: 'BATTAGLIA'},
        {label: 'Véhicules terrestres', icon: 'vehicle', family: 'GROUND_VEHICLE'},
        {label: 'Armures motorisées', icon: 'armor', family: 'POWER_SUIT'}
      ]
    },
    {
      label: 'Équipement', icon: 'component', tone: '251 146 60',
      queryParams: {family: 'SHIP_COMPONENT', catalogGroup: 'STANDARD'},
      imageUrl: 'https://media.starcitizen.tools/6/6d/ItemBankRM.png',
      shortcuts: [
        {label: 'Armes FPS', icon: 'weapon', family: 'FPS_WEAPON'}, {label: 'Armes de vaisseau', icon: 'weapon', family: 'SHIP_WEAPON'},
        {label: 'Armures', icon: 'armor', family: 'ARMOR'}, {label: 'Composants', icon: 'component', family: 'SHIP_COMPONENT'},
        {label: 'Modules', icon: 'module', family: 'MODULE'}, {label: 'Outils', icon: 'tool', family: 'TOOL'},
        {label: 'Autres objets', icon: 'item', family: 'ITEM'}
      ]
    },
    {
      label: 'Planètes et lunes', icon: 'planet', tone: '52 211 153',
      queryParams: {family: 'PLANET', catalogGroup: 'STANDARD'},
      imageUrl: 'https://media.starcitizen.tools/e/e7/MicroTech-4.3.jpg',
      shortcuts: [
        {label: 'Systèmes', icon: 'system', family: 'SYSTEM'}, {label: 'Planètes', icon: 'planet', family: 'PLANET'},
        {label: 'Lunes', icon: 'moon', family: 'MOON'}
      ]
    },
    {
      label: 'Stations et lieux', icon: 'station', tone: '125 211 252',
      queryParams: {family: 'STATION', catalogGroup: 'STANDARD'},
      imageUrl: 'https://media.starcitizen.tools/7/72/Hurston-everus-harbor-01.jpg',
      shortcuts: [
        {label: 'Stations', icon: 'station', family: 'STATION'}, {label: 'Villes', icon: 'city', family: 'CITY'},
        {label: 'Avant-postes', icon: 'outpost', family: 'OUTPOST'}, {label: 'Points de saut', icon: 'jump', family: 'JUMP_POINT'},
        {label: 'Autres lieux', icon: 'location', family: 'LOCATION'}
      ]
    }
  ];

  readonly groups: HubGroup[] = [
    {
      label: 'Ressources de minage', tone: '251 191 36',
      links: [
        {label: 'Zones de minage', description: 'Minerais par planète, lune et point de Lagrange', icon: 'ore', route: '/icy/admin/ore-locations',
          imageUrl: 'https://static.wikia.nocookie.net/starcitizen/images/6/6d/Aphorite_vitrine.jpg/revision/latest/scale-to-width-down/300?cb=20210215061436'},
        {label: 'Prix des marchandises', description: 'Achat et vente de chaque marchandise, terminal par terminal', icon: 'price', route: '/icy/admin/catalog',
          queryParams: {family: 'COMMODITY', catalogGroup: 'STANDARD'}, imageUrl: 'assets/images/home/activities/cargo.jpg'}
      ]
    },
    {
      label: 'Médias et veille', tone: '196 181 253',
      links: [
        {label: 'Images', description: 'Bibliothèque des visuels du site', icon: 'image', route: '/icy/admin/images',
          imageUrl: 'https://www.fredzone.org/wp-content/uploads/2017/12/starcitizen-proc%C3%A8s.jpg'},
        {label: 'CIG Watch', description: 'Suivi des annonces et publications de CIG', icon: 'watch', route: '/icy/admin/cig-watch',
          imageUrl: 'https://static.actugaming.net/media/2018/03/StarCitizen-1024x575.jpg'},
        {label: 'Synchronisation', description: 'Import des sources et rapprochement des fiches', icon: 'sync', route: '/icy/admin/uex-cache',
          imageUrl: 'assets/images/home/activities/space-combat.jpg'}
      ]
    }
  ];

  ngOnInit(): void {
    this.catalogService.browse({catalogGroup: 'ALL', status: 'ACTIVE', image: 'ALL', sort: 'name', page: 0, pageSize: 1}).subscribe({
      next: response => { this.counts = response?.data ?? null; this.changeDetector.markForCheck(); },
      error: () => this.counts = null
    });
    this.oreLocationService.listAdminLocations().subscribe({
      next: response => {
        const zones = response?.data ?? [];
        this.oreZones = zones.length;
        this.oreCount = new Set(zones.flatMap(zone => (zone.ores ?? []).map(ore => ore.oreCode))).size;
        this.changeDetector.markForCheck();
      },
      error: () => this.oreZones = null
    });
  }

  /** Nombre de fiches d'une famille ; null tant que le décompte n'est pas chargé. */
  shortcutCount(shortcut: CatalogShortcut): number | null {
    if (!this.counts) return null;
    const group = shortcut.catalogGroup ?? 'STANDARD';
    return this.counts.groupFamilyCounts?.[group]?.[shortcut.family] ?? 0;
  }

  domainCount(domain: CatalogDomain): number | null {
    if (!this.counts) return null;
    return domain.shortcuts.reduce((total, shortcut) => total + (this.shortcutCount(shortcut) ?? 0), 0);
  }

  linkMeta(link: HubLink): string | null {
    if (link.route === '/icy/admin/ore-locations' && this.oreZones !== null) {
      return `${this.oreZones} zones · ${this.oreCount} minerais`;
    }
    if (link.queryParams?.['family'] === 'COMMODITY' && this.counts) {
      return `${this.counts.familyCounts?.['COMMODITY'] ?? 0} fiches`;
    }
    return null;
  }

  searchCatalog(): void {
    const query = this.search.trim();
    this.router.navigate(['/icy/admin/catalog'], {queryParams: query ? {q: query} : {}});
  }
}
