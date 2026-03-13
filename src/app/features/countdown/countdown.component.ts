import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CountdownService } from '../../core/services/countdown.service';

/**
 * Dumb display component — zero business logic.
 * All state comes from CountdownService via signals.
 *
 * ChangeDetectionStrategy.OnPush ensures Angular only checks this component
 * when a signal it reads actually changes, not on every global CD cycle.
 *
 * CountdownService is provided HERE (not root) so it has the same lifetime
 * as this component. When the component is destroyed, the service is destroyed
 * too, triggering DestroyRef → takeUntilDestroyed → interval cleanup.
 */
@Component({
  selector: 'app-countdown',
  imports: [DecimalPipe],
  templateUrl: './countdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CountdownService],
})
export class CountdownComponent {
  protected readonly countdown = inject(CountdownService);
}
