import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { DeadlineStorageService } from '../services/deadline-storage.service';
import { DeadlineResponse } from '../models/deadline.model';

/**
 * Intercepts GET /api/deadline and returns a fake JSON response.
 * Reads the deadline from DeadlineStorageService (localStorage) so it always
 * reflects the date the user entered — computed fresh on every request.
 * Swap this out (or remove it from provideHttpClient) to hit a real backend.
 */
export const fakeApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' && req.url.endsWith('/api/deadline')) {
    const deadline = inject(DeadlineStorageService).getDeadline();
    const secondsLeft = deadline
      ? Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000))
      : 0;
    const body: DeadlineResponse = { secondsLeft };
    return of(new HttpResponse({ status: 200, body }));
  }

  return next(req);
};
