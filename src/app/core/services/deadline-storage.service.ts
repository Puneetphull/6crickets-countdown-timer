import { Injectable } from '@angular/core';

const STORAGE_KEY = 'app_deadline_iso';

/**
 * Manages the one-time deadline stored in localStorage.
 * Intentionally has no delete/clear method — the deadline is write-once.
 */
@Injectable({ providedIn: 'root' })
export class DeadlineStorageService {
  getDeadline(): Date | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const date = new Date(stored);
    return isNaN(date.getTime()) ? null : date;
  }

  /** Call only once — from the setup form. */
  saveDeadline(date: Date): void {
    localStorage.setItem(STORAGE_KEY, date.toISOString());
  }
}
