import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormControl, ValidationErrors, Validators } from '@angular/forms';

/** Rejects dates that are not strictly in the future. */
function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return new Date(control.value as string).getTime() > Date.now()
    ? null
    : { pastDate: true };
}

@Component({
  selector: 'app-deadline-setup',
  imports: [ReactiveFormsModule],
  templateUrl: './deadline-setup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeadlineSetupComponent {
  /** Emits the chosen deadline Date to the parent — parent owns storage. */
  readonly deadlineSaved = output<Date>();

  protected readonly deadlineControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, futureDateValidator],
  });

  /**
   * Returns the current local datetime in the format required by <input type="datetime-local">
   * (YYYY-MM-DDTHH:mm), adjusted for the user's timezone offset so "now" is the
   * effective minimum — not UTC now.
   */
  protected get minDatetime(): string {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  protected submit(): void {
    if (this.deadlineControl.invalid) {
      this.deadlineControl.markAsTouched();
      return;
    }
    this.deadlineSaved.emit(new Date(this.deadlineControl.value));
  }
}
