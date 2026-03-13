import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/countdown/countdown.component').then(
        (m) => m.CountdownComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];


