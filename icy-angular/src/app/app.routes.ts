import { Routes } from '@angular/router';
import { roleGuard } from './auth/guards/role.guard';
import { authGuard } from './auth/guards/auth.guard';
import { publicAreaGuard } from './auth/guards/public-area.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/front/home/home.component').then(m => m.HomeComponent),
    data: {
      animation: 'HomePage',
      seo: {
        title: 'IceForge Industries | Corporation Star Citizen FR',
        description: 'IceForge Industries est une corporation Star Citizen FR orientee industrie, minage, logistique, transport et securite dans le systeme Stanton.',
        robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
      }
    }
  },
  {
    path: 'guide/minage',
    loadComponent: () => import('./features/front/guide/mining-guide/mining-guide.component').then(m => m.MiningGuideComponent),
    data: {
      animation: 'MiningGuidePage',
      seo: {
        title: 'Guide Minage | IceForge Industries',
        description: 'Guide operationnel du minage: preparation, scan, fracture, extraction et vente.',
        robots: 'index,follow'
      }
    }
  },
  {
    path: 'guide/salvage',
    loadComponent: () => import('./features/front/guide/salvage-guide/salvage-guide.component').then(m => m.SalvageGuideComponent),
    data: {
      animation: 'SalvageGuidePage',
      seo: {
        title: 'Guide Salvage | IceForge Industries',
        description: 'Guide salvage IceForge: tri, extraction, securite et rentabilite.',
        robots: 'index,follow'
      }
    }
  },
  {
    path: 'guide/avance',
    loadComponent: () => import('./features/front/guide/advanced-guide/advanced-guide.component').then(m => m.AdvancedGuideComponent),
    data: {
      animation: 'AdvancedGuidePage',
      seo: {
        title: 'Guide Avance | IceForge Industries',
        description: 'Section guide avancee IceForge.',
        robots: 'index,follow'
      }
    }
  },
  {
    path: 'guide/ressources',
    loadComponent: () => import('./features/front/guide/resources-guide/resources-guide.component').then(m => m.ResourcesGuideComponent),
    data: {
      animation: 'ResourcesGuidePage',
      seo: {
        title: 'Ressources | IceForge Industries',
        description: 'Ressources utiles pour les operations IceForge.',
        robots: 'index,follow'
      }
    }
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/components/login/login.component').then(m => m.LoginComponent),
    data: {
      animation: 'LoginPage',
      seo: {
        title: 'Connexion | IceForge Industries',
        description: 'Espace membre IceForge Industries.',
        robots: 'noindex,nofollow'
      }
    }
  },
  {
    path: 'recrutement',
    loadComponent: () => import('./auth/components/recruitment/recruitment.component').then(m => m.RecruitmentComponent),
    data: {
      animation: 'RecruitmentPage',
      seo: {
        title: 'Recrutement | IceForge Industries',
        description: 'Rejoignez IceForge Industries, corporation Star Citizen FR.',
        robots: 'index,follow'
      }
    }
  },
  {
    path: 'utilitaires',
    loadComponent: () => import('./features/front/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    canActivate: [publicAreaGuard],
    canActivateChild: [publicAreaGuard],
    children: [
      {
        path: '',
        data: { utilityScope: 'public' },
        loadComponent: () => import('./features/utils/menu/utils-menu.component').then(m => m.UtilsMenuComponent)
      },
      {
        path: 'executive-hangar',
        data: { animation: 'ExecHangarPage' },
        loadComponent: () => import('./features/utils/executive-hangar/executive-hangar.component').then(m => m.ExecutiveHangarComponent)
      },
      {
        path: 'executive-hangar-maps',
        data: { animation: 'ExecMapsPage' },
        loadComponent: () => import('./features/utils/executive-hangar-maps/executive-hangar-maps.component').then(m => m.ExecutiveHangarMapsComponent)
      },
      {
        path: 'wikelo',
        data: { animation: 'WikeloPage' },
        loadComponent: () => import('./features/utils/wikelo/wikelo.component').then(m => m.WikeloComponent)
      },
      {
        path: 'achat-vaisseaux',
        data: { animation: 'ShipMarketPage' },
        loadComponent: () => import('./features/utils/ship-market/ship-market.component').then(m => m.ShipMarketComponent)
      }
    ]
  },

  {
    path: 'icy',
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    data: {
      animation: 'IcyArea',
      seo: {
        title: 'Espace Membre | IceForge Industries',
        description: 'Espace membre prive IceForge Industries.',
        robots: 'noindex,nofollow,noarchive'
      }
    },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // LAZY LOADING : On charge le fichier seulement quand nécessaire
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'scwe',
        loadComponent: () => import('./features/scwe/scwe-player-event-page.component').then(m => m.ScwePlayerPageComponent)
      },
      {
        path: 'hangar',
        loadComponent: () => import('./features/hangar/hangar.component').then(m => m.HangarComponent)
      },
      {
        path: 'fleet',
        loadComponent: () => import('./features/fleet/fleet.component').then(m => m.FleetComponent)
      },
      {
        path: 'events',
        loadComponent: () => import('./features/events/events.component').then(m => m.EventsComponent)
      },
      {
        path: 'goals',
        loadComponent: () => import('./features/goal/goal.component').then(m => m.GoalComponent)
      },
      {
        path: 'collection',
        loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent)
      },
      {
        path: 'utilitaires',
        children: [
          {
            path: '',
            data: { utilityScope: 'private' },
            loadComponent: () => import('./features/utils/menu/utils-menu.component').then(m => m.UtilsMenuComponent)
          },
          {
            path: 'collection',
            loadComponent: () => import('./features/collection/collection.component').then(m => m.CollectionComponent)
          },
          {
            path: 'executive-hangar',
            data: { animation: 'ExecHangarPage' },
            loadComponent: () => import('./features/utils/executive-hangar/executive-hangar.component').then(m => m.ExecutiveHangarComponent)
          },
          {
            path: 'executive-hangar-players',
            data: { animation: 'ExecPlayersPage' },
            loadComponent: () => import('./features/utils/executive-hangar-players/executive-hangar-players.component').then(m => m.ExecutiveHangarPlayersComponent)
          },
          {
            path: 'executive-hangar-maps',
            data: { animation: 'ExecMapsPage' },
            loadComponent: () => import('./features/utils/executive-hangar-maps/executive-hangar-maps.component').then(m => m.ExecutiveHangarMapsComponent)
          },
          {
            path: 'wikelo',
            data: { animation: 'WikeloPage' },
            loadComponent: () => import('./features/utils/wikelo/wikelo.component').then(m => m.WikeloComponent)
          },
          {
            path: 'vaisseaux-par-location',
            data: { animation: 'ShipMarketPage' },
            loadComponent: () => import('./features/utils/ship-market/ship-market.component').then(m => m.ShipMarketComponent)
          }
        ]
      },

      // SECTION ADMIN
      {
        path: 'admin',
        canActivateChild: [roleGuard],
        data: { roles: ['ADMIN', 'OFFICIER'] },
        children: [
          {
            path: '',
            loadComponent: () => import('./features/admin/menu/menu.component').then(m => m.AdminMenuComponent)
          },
          {
            path: 'members',
            loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
          },
          {
            path: 'collections',
            loadComponent: () => import('./features/admin/collection-management/collection-management.component').then(m => m.CollectionManagementComponent)
          },
          {
            path: 'events',
            loadComponent: () => import('./features/admin/event-management/event-management.component').then(m => m.EventManagementComponent)
          },
          {
            path: 'sc-world-events',
            loadComponent: () => import('./features/admin/sc-world-event-management/sc-world-event-management.component').then(m => m.ScWorldEventManagementComponent)
          },
          {
            path: 'ships',
            loadComponent: () => import('./features/admin/ship-management/ship-management.component').then(m => m.ShipManagementComponent)
          },
          {
            path: 'items',
            loadComponent: () => import('./features/admin/item-management/item-management.component').then(m => m.ItemManagementComponent)
          },
          {
            path: 'data',
            loadComponent: () => import('./features/admin/data-menu/data-menu.component').then(m => m.DataMenuComponent)
          },
          {
            path: 'planets',
            loadComponent: () => import('./features/admin/planet-management/planet-management.component').then(m => m.PlanetManagementComponent)
          },
          {
            path: 'stations',
            loadComponent: () => import('./features/admin/station-management/station-management.component').then(m => m.StationManagementComponent)
          },
          {
            path: 'recrutement',
            loadComponent: () => import('./features/admin/recruitment-management/recruitment-management.component').then(m => m.RecruitmentManagementComponent)
          },
          {
            path: 'news',
            loadComponent: () => import('./features/admin/news-management/news-management.component').then(m => m.NewsManagementComponent)
          },
          {
            path: 'icelinkBuilder',
            loadComponent: () => import('./features/admin/icelink-builder/icelink-builder.component').then(m => m.IceLinkBuilderComponent)
          },
          {
            path: 'images',
            loadComponent: () => import('./features/admin/image-library/image-library.component').then(m => m.ImageLibraryComponent)
          },
          {
            path: 'uex-cache',
            loadComponent: () => import('./features/admin/uex-cache-management/uex-cache-management.component').then(m => m.UexCacheManagementComponent)
          },
          {
            path: 'ore-locations',
            loadComponent: () => import('./features/admin/ore-location-management/ore-location-management.component').then(m => m.OreLocationManagementComponent)
          },
          {
            path: 'goals',
            loadComponent: () => import('./features/admin/goal-management/goal-management.component').then(m => m.GoalManagementComponent)
          },
          {
            path: 'orbit-spinner-maker',
            data: { roles: ['ADMIN'] },
            loadComponent: () => import('./features/admin/orbit-spinner-maker/orbit-spinner-maker.component').then(m => m.OrbitSpinnerMakerComponent)
          },
        ]
      },
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/front/not-found/not-found.component').then(m => m.NotFoundComponent),
    data: {
      seo: {
        title: 'Page introuvable | IceForge Industries',
        description: 'Cette page n existe pas ou n est plus disponible.',
        robots: 'noindex,follow'
      }
    }
  }
];
