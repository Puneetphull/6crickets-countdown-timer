import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/deadline-setup/deadline-setup.component').then(
        (m) => m.DeadlineSetupComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

