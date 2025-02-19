import { Routes } from '@angular/router';
import { AuthGuard } from './auth/guards/auth.guard'; // ✅ Import normal

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/components/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/user/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard] // ✅ Utilisation correcte
  },
  { path: '**', redirectTo: 'login' }
];
