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
import {CollectionComponent} from './features/collection/collection.component';
import {CollectionManagementComponent} from './features/admin/collection-management/collection-management.component';
import {EventManagementComponent} from './features/admin/event-management/event-management.component';
import {ShipManagementComponent} from './features/admin/ship-management/ship-management.component';
import {RecruitmentComponent} from './auth/components/recruitment/recruitment.component';
import {RecruitmentManagementComponent} from './features/admin/recruitment-management/recruitment-management.component';
import {NewsManagementComponent} from './features/admin/news-management/news-management.component';
import {IceLinkBuilderComponent} from './features/admin/icelink-builder/icelink-builder.component';
import {ImageLibraryComponent} from './features/admin/image-library/image-library.component';
import {GoalManagementComponent} from './features/admin/goal-management/goal-management.component';

export const routes: Routes = [
  { path: '',component: HomeComponent },
  // { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'recrutement', component: RecruitmentComponent },

  {
    path: 'icy',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      { path: 'dashboard', component: DashboardComponent },
      { path: 'hangar', component: HangarComponent },
      { path: 'fleet', component: FleetComponent },
      { path: 'events', component: EventsComponent },
      { path: 'goals', component: GoalComponent },
      { path: 'collection', component: CollectionComponent },

      { path: 'admin', component: AdminMenuComponent },
      { path: 'admin/members', component: AdminDashboardComponent },
      { path: 'admin/collections', component: CollectionManagementComponent },
      { path: 'admin/events', component: EventManagementComponent },
      { path: 'admin/ships', component: ShipManagementComponent },
      { path: 'admin/recrutement', component: RecruitmentManagementComponent },
      { path: 'admin/news', component: NewsManagementComponent },
      { path: 'admin/icelinkBuilder', component: IceLinkBuilderComponent },
      { path: 'admin/images', component: ImageLibraryComponent },
      { path: 'admin/goals', component: GoalManagementComponent },
    ]
  }
];
