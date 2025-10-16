import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/layout/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { HangarComponent } from './features/hangar/hangar.component';
import { LoginComponent } from './auth/components/login/login.component';
import {HomeComponent} from './features/front/home/home.component';
import {AdminDashboardComponent} from './features/admin/admin-dashboard/admin-dashboard.component';
import {EventsComponent} from './features/events/events.component';
import {GoalComponent} from './features/goal/goal.component';
import {AdminMenuComponent} from './features/admin/menu/menu.component';
import {FleetComponent} from './features/fleet/fleet.component';
import {RecrutementComponent} from './features/front/recruit/recruit.component';
import {CollectionComponent} from './features/collection/collection.component';
import {CollectionManagementComponent} from './features/admin/collection-management/collection-management.component';
import {EventManagementComponent} from './features/admin/event-management/event-management.component';

export const routes: Routes = [
  { path: '',component: HomeComponent },
  // { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'recrutement', component: RecrutementComponent },

  {
    path: 'icy',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'hangar', component: HangarComponent },
      { path: 'fleet', component: FleetComponent },
      { path: 'admin', component: AdminMenuComponent },
      { path: 'admin/members', component: AdminDashboardComponent },
      { path: 'admin/collections', component: CollectionManagementComponent },
      { path: 'admin/events', component: EventManagementComponent },
      { path: 'events', component: EventsComponent },
      { path: 'goals', component: GoalComponent },
      { path: 'collection', component: CollectionComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
