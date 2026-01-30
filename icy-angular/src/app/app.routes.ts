import { Routes } from '@angular/router';
// On garde uniquement les composants "structurels" en import direct
import { LayoutComponent } from './shared/layout/layout.component';
import { LoginComponent } from './auth/components/login/login.component';
import { HomeComponent } from './features/front/home/home.component';
import {RecruitmentComponent} from './auth/components/recruitment/recruitment.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'recrutement', component: RecruitmentComponent },

  {
    path: 'icy',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // LAZY LOADING : On charge le fichier seulement quand nécessaire
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
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

      // SECTION ADMIN
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/menu/menu.component').then(m => m.AdminMenuComponent)
      },
      {
        path: 'admin/members',
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'admin/collections',
        loadComponent: () => import('./features/admin/collection-management/collection-management.component').then(m => m.CollectionManagementComponent)
      },
      {
        path: 'admin/events',
        loadComponent: () => import('./features/admin/event-management/event-management.component').then(m => m.EventManagementComponent)
      },
      {
        path: 'admin/sc-world-events',
        loadComponent: () => import('./features/admin/sc-world-event-management/sc-world-event-management.component').then(m => m.ScWorldEventManagementComponent)
      },
      {
        path: 'admin/ships',
        loadComponent: () => import('./features/admin/ship-management/ship-management.component').then(m => m.ShipManagementComponent)
      },
      {
        path: 'admin/recrutement',
        loadComponent: () => import('./features/admin/recruitment-management/recruitment-management.component').then(m => m.RecruitmentManagementComponent)
      },
      {
        path: 'admin/news',
        loadComponent: () => import('./features/admin/news-management/news-management.component').then(m => m.NewsManagementComponent)
      },
      {
        path: 'admin/icelinkBuilder',
        loadComponent: () => import('./features/admin/icelink-builder/icelink-builder.component').then(m => m.IceLinkBuilderComponent)
      },
      {
        path: 'admin/images',
        loadComponent: () => import('./features/admin/image-library/image-library.component').then(m => m.ImageLibraryComponent)
      },
      {
        path: 'admin/goals',
        loadComponent: () => import('./features/admin/goal-management/goal-management.component').then(m => m.GoalManagementComponent)
      },
    ]
  }
];
