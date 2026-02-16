import { Routes } from '@angular/router';
// On garde uniquement les composants "structurels" en import direct
import { LayoutComponent } from './shared/layout/layout.component';
import { LoginComponent } from './auth/components/login/login.component';
import { HomeComponent } from './features/front/home/home.component';
import {RecruitmentComponent} from './auth/components/recruitment/recruitment.component';
import { roleGuard } from './auth/guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { animation: 'HomePage' } },
  { path: 'login', component: LoginComponent, data: { animation: 'LoginPage' } },
  { path: 'recrutement', component: RecruitmentComponent, data: { animation: 'RecruitmentPage' } },

  {
    path: 'icy',
    component: LayoutComponent,
    data: { animation: 'IcyArea' },
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
  }
];
