import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { DeadlineResponse } from '../models/deadline.model';

/**
 * Constant deadline date — never changes.
 * Computed fresh on every request so the value stays accurate
 * even after the app has been open for a long time.
 * Swap this out (or remove it from provideHttpClient) to hit a real backend.
 */
const DEADLINE_DATE = new Date('2026-06-01T00:00:00Z');

export const fakeApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' && req.url.endsWith('/api/deadline')) {
    const secondsLeft = Math.max(
      0,
      Math.floor((DEADLINE_DATE.getTime() - Date.now()) / 1000),
    );
    const body: DeadlineResponse = { secondsLeft };
    return of(new HttpResponse({ status: 200, body }));
  }

  return next(req);
};

