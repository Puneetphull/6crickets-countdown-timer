# 6crickets Deadline Countdown

A performance-optimized Angular 21 countdown timer. The user sets a deadline **once** — it is saved to `localStorage`, the setup form is permanently removed, and a live counter ticks down every second until the deadline is reached.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Data & Control Flow](#data--control-flow)
- [Architecture Decisions](#architecture-decisions)
- [Memory Leak Prevention](#memory-leak-prevention)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Swapping the Fake API](#swapping-the-fake-api)
- [Tech Stack](#tech-stack)

---

## How It Works

### User Journey

```
First visit
    |
    v
[Router] -- deadlineSetGuard checks localStorage
    |
    +-- no deadline saved? --> /setup  (DeadlineSetupComponent)
    |       |
    |       | User picks a future date & clicks "Start Countdown"
    |       |   saveDeadline() --> localStorage
    |       |   router.navigate(['/'])
    |       v
    +-- deadline saved? -------> /  (CountdownComponent)
                                      |
                                      | CountdownService (component-scoped)
                                      |   1. GET /api/deadline  (intercepted, reads localStorage)
                                      |   2. secondsLeft signal set from API response
                                      |   3. interval(1000) starts, decrements signal every second
                                      |   4. UI reads signal via OnPush -- only counter updates
                                      |
                                      v
                                  [ Deadline Passed! ] when secondsLeft = 0
                                      interval auto-completes (takeWhile)
```

### Key Behavioural Rules

| Rule | Implementation |
|---|---|
| Setup form appears only once | `deadlineNotSetGuard` — redirects to `/` if localStorage already has a deadline |
| Setup is unreachable after first save | Same guard blocks `/setup` forever |
| Countdown auto-stops at zero | `takeWhile(() => secondsLeft > 0)` |
| Refresh-safe | Deadline stored in `localStorage` — survives page reloads |
| No drift | API response is computed from the stored deadline at request time, not from a hardcoded constant |

---

## Project Structure

```
src/
+-- app/
    +-- core/                                   # Shared, non-UI infrastructure
    ¦   +-- guards/
    ¦   ¦   +-- deadline.guard.ts               # deadlineSetGuard + deadlineNotSetGuard
    ¦   +-- interceptors/
    ¦   ¦   +-- fake-api.interceptor.ts         # Simulates GET /api/deadline
    ¦   +-- models/
    ¦   ¦   +-- deadline.model.ts               # DeadlineResponse interface
    ¦   +-- services/
    ¦       +-- deadline-api.service.ts         # HTTP layer only (providedIn: root)
    ¦       +-- deadline-storage.service.ts     # localStorage read/write (providedIn: root)
    ¦       +-- countdown.service.ts            # Timer + signal state (component-scoped)
    +-- features/
    ¦   +-- countdown/                          # Lazy-loaded — the live timer page
    ¦   ¦   +-- countdown.component.ts
    ¦   ¦   +-- countdown.component.html
    ¦   +-- deadline-setup/                     # Lazy-loaded — one-time form
    ¦       +-- deadline-setup.component.ts
    ¦       +-- deadline-setup.component.html
    +-- app.config.ts                           # Root providers: HttpClient, Router, interceptor
    +-- app.routes.ts                           # Lazy routes + guards
    +-- app.ts                                  # Shell: <router-outlet />
```

---

## Data & Control Flow

### 1. First Load — No Deadline Saved

```
Browser loads app.ts (<router-outlet />)
  --> Router evaluates route "/"
  --> deadlineSetGuard: localStorage.getItem('app_deadline_iso') === null
  --> Redirects to /setup
  --> DeadlineSetupComponent lazy-loaded
```

### 2. User Submits the Setup Form

```
User picks date/time, clicks "Start Countdown"
  --> futureDateValidator passes (must be > now)
  --> DeadlineStorageService.saveDeadline(date)
        localStorage.setItem('app_deadline_iso', date.toISOString())
  --> Router.navigate(['/'])
  --> deadlineSetGuard: localStorage value now exists --> allows access
  --> DeadlineSetupComponent destroyed (form removed from DOM permanently)
  --> CountdownComponent lazy-loaded
```

### 3. CountdownComponent Initialises

```
CountdownComponent created
  --> CountdownService created (providers: [CountdownService] in component)
  --> CountdownService.initCountdown()
        DeadlineApiService.getSecondsLeft()
          --> HttpClient GET /api/deadline
          --> fakeApiInterceptor intercepts
                DeadlineStorageService.getDeadline() reads localStorage
                secondsLeft = floor((deadline - now) / 1000)
                returns HttpResponse { secondsLeft: N }
        tap: _secondsLeft.set(N), _isLoading.set(false)
        switchMap: interval(1000) starts
          --> every second: _secondsLeft.update(s => max(0, s - 1))
          --> Angular signal marks CountdownComponent view dirty
          --> OnPush: only the counter text node re-renders
        takeWhile(() => secondsLeft > 0) -- stream completes at zero
        takeUntilDestroyed(destroyRef)   -- stream completes if component destroyed
```

### 4. Subsequent Visits / Page Refresh

```
Browser loads app
  --> deadlineSetGuard: localStorage has value --> allows "/" directly
  --> Skips /setup entirely, CountdownComponent loads immediately
  --> /setup is now permanently inaccessible (deadlineNotSetGuard redirects to /)
```

---

## Architecture Decisions

### Separation of concerns across three layers

| Layer | Class | Responsibility |
|---|---|---|
| Storage | `DeadlineStorageService` | localStorage read/write — no timer logic |
| HTTP | `DeadlineApiService` | Fetch `/api/deadline`, map to `number` |
| Business | `CountdownService` | Hold state signals, manage timer lifecycle |
| UI | `CountdownComponent` | Display signals only — zero logic |

### Component-scoped `CountdownService`

Listed in `CountdownComponent`'s `providers: []` — not `providedIn: 'root'`. This means the service's lifetime is identical to the component's. When the component is destroyed, `DestroyRef` fires and the RxJS chain is cleaned up automatically.

### `ChangeDetectionStrategy.OnPush` + Signals

Angular's signal graph marks only views that read a changed signal as dirty. On each 1-second tick only the single text node showing `secondsLeft` is updated — the rest of the DOM is untouched.

### Lazy-loaded routes

Both `CountdownComponent` and `DeadlineSetupComponent` use `loadComponent()`. They are in separate JS chunks that are only downloaded when the route is activated.

---

## Memory Leak Prevention

A countdown timer is a classic source of memory leaks. Two common mistakes:

| Mistake | Consequence |
|---|---|
| `setInterval` without `clearInterval` | Keeps ticking forever, even after navigation away |
| `interval().subscribe()` without unsubscribing | Observable holds a reference to the component |

### Solution: two complementary guards

```typescript
this.deadlineApi.getSecondsLeft().pipe(
  tap((seconds) => this._secondsLeft.set(seconds)),
  switchMap(() => interval(1000)),
  // Guard 1: stream completes on its own when countdown hits zero
  takeWhile(() => this._secondsLeft() > 0),
  // Guard 2: stream completes when the component is destroyed (e.g. navigation)
  takeUntilDestroyed(this.destroyRef),
).subscribe(() => {
  this._secondsLeft.update((s) => Math.max(0, s - 1));
});
```

No `ngOnDestroy`, no stored subscription, no manual `clearInterval`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4200)
npm start
```

On first load you will be sent to `/setup`. Pick any future date and click **Start Countdown** — the form disappears and the live counter begins.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start Angular dev server |
| `npm run build` | Production build |
| `npm run watch` | Dev build in watch mode |
| `npm run lint` | Run ESLint on `src/` |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm test` | Run unit tests (Vitest) |

---

## Swapping the Fake API

Remove the interceptor from `app.config.ts` to hit a real backend:

```typescript
// Development — interceptor active
provideHttpClient(withInterceptors([fakeApiInterceptor])),

// Production — real backend
provideHttpClient(),
```

`DeadlineApiService` and `CountdownService` require zero changes.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Angular | 21 | Framework |
| TypeScript | 5.9 | Language |
| RxJS | 7.8 | Async streams |
| Tailwind CSS | 4 | Styling |
| ESLint | 9 (flat config) | Linting |
| angular-eslint | latest | Angular-specific lint rules |
| Vitest | 4 | Unit testing |
