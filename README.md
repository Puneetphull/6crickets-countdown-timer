# 6crickets Deadline Countdown

A performance-optimized Angular 21 countdown timer. On load it fetches the seconds remaining to a fixed deadline from an API and displays a live decrementing counter that updates every second.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Data & Control Flow](#data--control-flow)
- [Architecture Decisions](#architecture-decisions)
- [Memory Leak Prevention](#memory-leak-prevention)
- [Getting Started](#getting-started)
- [Deployment — Netlify](#deployment--netlify)
- [Available Scripts](#available-scripts)
- [Swapping the Fake API](#swapping-the-fake-api)
- [Tech Stack](#tech-stack)

---

## How It Works

### User Journey

```
Browser opens http://localhost:4200
        |
        v
   app.routes.ts  -->  CountdownComponent (lazy loaded)
        |
        v
   CountdownService (component-scoped, boots on component create)
        |
        +-- 1. GET /api/deadline
        |         |
        |         v
        |   fakeApiInterceptor (no real backend needed)
        |   computes secondsLeft from DEADLINE_DATE constant
        |   returns { secondsLeft: N }
        |
        +-- 2. _secondsLeft signal set to N
        |       _isLoading set to false
        |
        +-- 3. interval(1000) starts � decrements signal every second
        |       OnPush: only the counter text node re-renders
        |
        +-- 4. takeWhile: stream self-completes when secondsLeft reaches 0
                takeUntilDestroyed: stream cleaned up if component destroyed
```

### UI States

| State | Condition | Display |
|---|---|---|
| Loading | API call in flight | Spinner + "Fetching deadline..." |
| Countdown | `secondsLeft > 0` | Large number + "seconds left to deadline" |
| Expired | `secondsLeft === 0` | "Deadline Passed!" |
| Error | API call failed | Error message |

---

## Project Structure

```
src/
+-- app/
    +-- core/                           # Shared, non-UI infrastructure
    �   +-- interceptors/
    �   �   +-- fake-api.interceptor.ts # Intercepts GET /api/deadline
    �   +-- models/
    �   �   +-- deadline.model.ts       # DeadlineResponse interface
    �   +-- services/
    �       +-- deadline-api.service.ts # HTTP layer (providedIn: root)
    �       +-- countdown.service.ts    # Timer + signal state (component-scoped)
    +-- features/
    �   +-- countdown/                  # Lazy-loaded route component
    �       +-- countdown.component.ts
    �       +-- countdown.component.html
    +-- app.config.ts                   # Root providers: HttpClient + interceptor
    +-- app.routes.ts                   # Single lazy route to CountdownComponent
    +-- app.ts                          # Shell: <router-outlet />
```

---

## Data & Control Flow

### 1. App Bootstrap

```
main.ts bootstraps App with appConfig
  appConfig provides:
    - provideRouter(routes)
    - provideHttpClient(withInterceptors([fakeApiInterceptor]))
```

### 2. Route Activation

```
Router matches path "" --> CountdownComponent
  CountdownComponent is lazy-loaded (separate JS chunk)
  CountdownService is created (listed in component's providers:[])
  CountdownService.initCountdown() runs in constructor
```

### 3. API Call + Timer Start

```
DeadlineApiService.getSecondsLeft()
  --> HttpClient.get('/api/deadline')
  --> fakeApiInterceptor intercepts:
        secondsLeft = floor((DEADLINE_DATE - now) / 1000)
        returns HttpResponse { secondsLeft: N }
  --> Observable<number> emits N

CountdownService pipeline:
  catchError  --> sets hasError signal, returns EMPTY
  tap         --> sets _secondsLeft(N), sets _isLoading(false)
  switchMap   --> replaces HTTP observable with interval(1000)
  takeWhile   --> auto-completes stream when secondsLeft hits 0
  takeUntilDestroyed --> auto-completes stream on component destroy
  subscribe   --> decrements _secondsLeft by 1 each tick
```

### 4. Change Detection

```
interval tick fires
  --> subscribe callback: _secondsLeft.update(s => s - 1)
  --> Angular signal graph marks CountdownComponent view dirty
  --> OnPush CD runs: only the {{ secondsLeft() }} text node patches the DOM
```

---

## Architecture Decisions

### Separation of concerns

| Layer | Class | Responsibility |
|---|---|---|
| HTTP | `DeadlineApiService` | Fetch `/api/deadline`, map response to `number` |
| Business | `CountdownService` | Hold signals, manage timer lifecycle |
| UI | `CountdownComponent` | Read signals, display only � zero logic |

### Component-scoped `CountdownService`

Declared in `CountdownComponent`'s `providers: []` � not `providedIn: 'root'`. The service lifetime equals the component lifetime. When the component is destroyed, `DestroyRef` fires and the entire RxJS chain is torn down automatically.

### `ChangeDetectionStrategy.OnPush` + Signals

Signals tell Angular exactly which views are stale. Combined with `OnPush`, only the single text node showing `secondsLeft` is patched on each tick � the rest of the DOM is untouched.

### Fake API via Interceptor

`fakeApiInterceptor` intercepts `GET /api/deadline` before it reaches the network. The service and component code is 100% production-identical � only the interceptor is removed when a real backend is available.

---

## Memory Leak Prevention

A countdown timer is a classic source of memory leaks.

| Mistake | Consequence |
|---|---|
| `setInterval` without `clearInterval` | Keeps running forever after navigation |
| `interval().subscribe()` without unsubscribing | Holds a reference � component can never be GC'd |

### Solution: two self-cleaning guards in the RxJS pipe

```typescript
this.deadlineApi.getSecondsLeft().pipe(
  tap((seconds) => this._secondsLeft.set(seconds)),
  switchMap(() => interval(1000)),
  // Guard 1: stream completes on its own when countdown hits zero
  takeWhile(() => this._secondsLeft() > 0),
  // Guard 2: stream completes when component is destroyed
  takeUntilDestroyed(this.destroyRef),
).subscribe(() => {
  this._secondsLeft.update((s) => Math.max(0, s - 1));
});
```

No `ngOnDestroy`, no stored `Subscription`, no `Subject` teardown pattern.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm start
# --> http://localhost:4200
```

The countdown starts automatically on load.

---

## Deployment — Netlify

The project is pre-configured for Netlify via [`netlify.toml`](netlify.toml).

```toml
[build]
  command   = "npm run build"
  publish   = "dist/6crickets-deadline-countdown/browser"

[build.environment]
  NODE_VERSION = "22"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

The `[[redirects]]` rule is required for Angular's client-side router — without it, any direct URL or page refresh returns a 404 on Netlify.

### Deploy via Git (recommended)

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
3. Select your repo — Netlify reads `netlify.toml` automatically, no manual config needed.
4. Click **Deploy site**.

Every push to the main branch triggers a new production deploy automatically.

### Deploy via Netlify CLI

```bash
# Install CLI globally (once)
npm install -g netlify-cli

# Authenticate
netlify login

# Build and deploy to production
npm run build
netlify deploy --prod --dir=dist/6crickets-deadline-countdown/browser
```

### Environment variables

No environment variables are required for the current setup (the deadline is hardcoded in `fake-api.interceptor.ts`). If you connect a real backend, add variables in the Netlify dashboard under **Site configuration → Environment variables**.

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

Remove the interceptor from `app.config.ts` and update `DEADLINE_DATE` in the interceptor, or delete the interceptor entirely to call a real backend:

```typescript
// app.config.ts � development (fake interceptor active)
provideHttpClient(withInterceptors([fakeApiInterceptor])),

// app.config.ts � production (real backend)
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
