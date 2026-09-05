import { Routes } from '@angular/router';

export const memberToolsRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { presentation: 'member' },
    loadComponent: () => import('./menu/utils-menu.component').then(m => m.UtilsMenuComponent)
  },
  {
    path: 'collection',
    loadComponent: () => import('../collection/collection.component').then(m => m.CollectionComponent)
  },
  {
    path: 'ressources-minage',
    loadComponent: () => import('../front/guide/resources-guide/resources-guide.component').then(m => m.ResourcesGuideComponent)
  },
  {
    path: 'fiches-minage',
    loadComponent: () => import('./mining-sheets/mining-sheets.component').then(m => m.MiningSheetsComponent)
  },
  {
    path: 'executive-hangar',
    loadComponent: () => import('./executive-hangar/executive-hangar.component').then(m => m.ExecutiveHangarComponent)
  },
  {
    path: 'executive-hangar-players',
    loadComponent: () => import('./executive-hangar-players/executive-hangar-players.component').then(m => m.ExecutiveHangarPlayersComponent)
  },
  {
    path: 'executive-hangar-maps',
    loadComponent: () => import('./executive-hangar-maps/executive-hangar-maps.component').then(m => m.ExecutiveHangarMapsComponent)
  },
  {
    path: 'achat-vaisseaux',
    loadComponent: () => import('./ship-market/ship-market.component').then(m => m.ShipMarketComponent)
  },
  {
    path: 'wikelo',
    loadComponent: () => import('./wikelo/wikelo.component').then(m => m.WikeloComponent)
  },
  {
    path: 'guides',
    pathMatch: 'full',
    loadComponent: () => import('../guides/menu/guides-menu.component').then(m => m.GuidesMenuComponent)
  },
  {
    path: 'guides/minage-star-citizen',
    loadComponent: () => import('../front/guide/mining-guide/mining-guide.component').then(m => m.MiningGuideComponent)
  },
  {
    path: 'guides/minage-avance',
    loadComponent: () => import('../front/guide/advanced-guide/advanced-guide.component').then(m => m.AdvancedMiningGuideComponent)
  },
  {
    path: 'guides/salvage',
    loadComponent: () => import('../front/guide/salvage-guide/salvage-guide.component').then(m => m.SalvageGuideComponent)
  },
  {
    path: 'guides/hathor',
    loadComponent: () => import('../front/guide/hathor-guide/hathor-guide.component').then(m => m.HathorGuideComponent)
  }
];
