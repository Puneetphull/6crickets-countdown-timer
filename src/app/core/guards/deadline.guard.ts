import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeadlineStorageService } from '../services/deadline-storage.service';

/**
 * Allows access to the countdown page only when a deadline has been saved.
 * Redirects to /setup otherwise.
 */
export const deadlineSetGuard: CanActivateFn = () => {
  const storage = inject(DeadlineStorageService);
  const router = inject(Router);
  return storage.getDeadline() !== null ? true : router.createUrlTree(['/setup']);
};

/**
 * Allows access to the setup page only when no deadline has been saved yet.
 * Redirects to / if a deadline is already stored (it's write-once).
 */
export const deadlineNotSetGuard: CanActivateFn = () => {
  const storage = inject(DeadlineStorageService);
  const router = inject(Router);
  return storage.getDeadline() === null ? true : router.createUrlTree(['/']);
};
