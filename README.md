# Jadwal KRL (Formerly Tarif KRL)

A web app for calculating commuter line fares and schedules for Jabodetabek/Yogyakarta KRL, plus fares and routes for the Jakarta MRT.

Built with Next.js (App Router), TypeScript, Tailwind CSS, and Radix UI.

Pick an origin and destination station to get:

- **Fare** for the trip
- **Schedules**, upcoming train departure times
- **Routes**, including multi-leg transit journeys when there's no direct train between two stations
- **Favorites**, save frequent routes as quick-access buttons (stored locally in your browser, no account needed)

Not officially affiliated with KRL or MRT. KRL data comes from the KRL partner API (`kci.id/api/krl`). MRT data comes from a mix of sources, see `CLAUDE.md` for details.

## Getting started

```bash
npm run dev           # start dev server
npm run build         # production build
npm run lint          # run ESLint
npm test              # run Jest unit tests
npm run test:e2e      # run Playwright end-to-end tests
```

Requires `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` in your environment, used for the MRT data. Copy `.env.example` to `.env.local` and fill those in.

## API docs

Internal API routes (`/api/v1/krl/*`, `/api/mrt/*`) are documented as an interactive OpenAPI reference at `/api-docs` when running the app, backed by `public/openapi.yaml`.

## Why a backend layer instead of calling the upstream API directly

The app doesn't just forward requests to the KRL partner API (`kci.id/api/krl`). It sits its own API routes and logic in front of it, for reasons the upstream API doesn't handle on its own:

- **Resilience.** Every upstream call goes through a timeout, one retry on 5xx, and a stale cache fallback (`src/lib/krl/adapter.ts`), so a flaky upstream response degrades to slightly stale data instead of an error page.
- **Missing features filled in.** The partner API only returns direct trains. Cross-line transfer routing is computed locally from a hand-built line/station graph (`src/lib/krl/topology.ts`).
- **Cleaner, filtered output.** Non-passenger trains get filtered out of schedules, and every response is normalized into one consistent `{ data, error }` shape instead of the upstream API's own format.
- **Tuned caching.** Stations cache for a day, fares for an hour, live schedules for a minute, reducing load on the upstream without serving stale departure times.

See `CLAUDE.md` for full architecture details.
