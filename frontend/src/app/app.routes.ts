import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./features/gallery/gallery').then((m) => m.Gallery),
  },
  {
    path: 'sketch/:id',
    loadComponent: () =>
      import('./features/sketch-detail/sketch-detail').then(
        (m) => m.SketchDetail,
      ),
  },
  {
    path: 'create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/create-sketch/create-sketch').then(
        (m) => m.CreateSketch,
      ),
  },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./features/leaderboard/leaderboard').then((m) => m.Leaderboard),
  },
  {
    path: 'stats',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stats/stats').then((m) => m.Stats),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.Register),
  },
  { path: '**', redirectTo: '' },
];
