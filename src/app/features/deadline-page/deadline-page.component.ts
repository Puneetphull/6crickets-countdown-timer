import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DeadlineStorageService } from '../../core/services/deadline-storage.service';
import { DeadlineSetupComponent } from '../deadline-setup/deadline-setup.component';
import { CountdownComponent } from '../countdown/countdown.component';

/**
 * Single entry-point page. Owns the layout-swap signal.
 *
 * Flow:
 *   1. On init: checks localStorage — if deadline exists, skip the form entirely
 *   2. User submits setup form → onDeadlineSaved() saves to localStorage
 *      and flips `deadlineSet` to true
 *   3. @if flips: SetupComponent destroyed, CountdownComponent created
 *      CountdownService (component-scoped) boots and the timer starts
 *   4. No route change — a pure in-place layout swap via signal
 */
@Component({
  selector: 'app-deadline-page',
  imports: [DeadlineSetupComponent, CountdownComponent],
  templateUrl: './deadline-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlinePageComponent {
  private readonly storage = inject(DeadlineStorageService);

  protected readonly deadlineSet = signal(this.storage.getDeadline() !== null);

  protected onDeadlineSaved(date: Date): void {
    this.storage.saveDeadline(date);
    this.deadlineSet.set(true);
  }
}
