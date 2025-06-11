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

export const routes: Routes = [
  { path: '',component: HomeComponent },
  // { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'icy',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'hangar', component: HangarComponent },
      { path: 'admin', component: AdminMenuComponent },
      { path: 'admin/members', component: AdminDashboardComponent },
      { path: 'events', component: EventsComponent },
      { path: 'goals', component: GoalComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
