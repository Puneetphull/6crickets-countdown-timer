import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, interval } from 'rxjs';
import { catchError, switchMap, takeWhile, tap } from 'rxjs/operators';
import { DeadlineApiService } from './deadline-api.service';

/**
 * CountdownService — scoped to the component that provides it (not root).
 *
 * Memory-leak prevention strategy:
 *   The `interval(1000)` observable is a long-running stream. We pipe it through
 *   `takeUntilDestroyed(this.destroyRef)`, which automatically unsubscribes when
 *   the host component (and this service) are destroyed. No manual ngOnDestroy
 *   or explicit subscription tracking needed.
 *
 * Flow:
 *   API call → set initial secondsLeft → switchMap to interval(1000)
 *              → decrement signal each tick → destroyed → auto-cleanup
 */
@Injectable()
export class CountdownService {
  private readonly deadlineApi = inject(DeadlineApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _secondsLeft = signal<number>(0);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _hasError = signal<boolean>(false);

  /** Read-only signal — components can read but never write */
  readonly secondsLeft = this._secondsLeft.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly hasError = this._hasError.asReadonly();

  constructor() {
    this.initCountdown();
  }

  private initCountdown(): void {
    this.deadlineApi
      .getSecondsLeft()
      .pipe(
        // Handle API errors gracefully — complete the stream so interval never starts
        catchError(() => {
          this._hasError.set(true);
          this._isLoading.set(false);
          return EMPTY;
        }),
        // Set the initial value from the server and stop the loading state
        tap((seconds) => {
          this._secondsLeft.set(Math.max(0, seconds));
          this._isLoading.set(false);
        }),
        // Switch to a client-side 1-second ticker — no further HTTP calls needed
        switchMap(() => interval(1000)),
        // Stop ticking once the counter reaches 0 — interval completes itself,
        // freeing resources even before the component is destroyed
        takeWhile(() => this._secondsLeft() > 0),
        // ✅ KEY: automatically unsubscribes when the component is destroyed
        //    This is the memory-leak guard — no setInterval, no manual cleanup
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this._secondsLeft.update((s) => Math.max(0, s - 1));
      });
  }
}
