# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jadwal KRL (formerly Tarif KRL) is a Next.js (App Router) web app for calculating commuter line fares and schedules for Jabodetabek/Yogyakarta KRL, and fares/routes for Jakarta MRT. Built on two upstream data sources: the KRL partner API (`kci.id/api/krl`) and the official Jakarta MRT API (`beweb-dev.jakartamrt.co.id/middleware/api`).

## Commands

- `npm run dev`: start dev server (Next.js)
- `npm run build`: production build
- `npm run start`: run production build
- `npm run lint`: ESLint (`next/core-web-vitals` config)
- `npm test`: Jest, covering `src/lib/krl/{adapter,response}.ts`, `src/app/utils.ts`, `src/app/krl/TrainRouteForm.tsx`, and the `src/app/api/v1/krl/*` route handlers
- `npm run test:e2e`: Playwright (`e2e/krl.spec.ts`), spins up `e2e/mock-server.mjs` as a fake KCI upstream plus a production build/start of the app itself (see `playwright.config.ts`)
- `npm run snapshot:refresh`: runs `scripts/refresh-terminus-snapshots.mjs` to (re-)scrape upstream schedules into the repo-committed snapshot fallback (see snapshot tiers below)

## Environment

No required environment variables. `MRT_MIDDLEWARE_BASE_URL` can optionally override the default upstream MRT API hostname (`src/lib/mrt/constants.ts`). KRL schedule/route data is served entirely from the repo-committed snapshot in `src/lib/krl/snapshotStore.ts` (see `npm run snapshot:refresh` above), not from Vercel Blob or a cron job, since Blob isn't viable on the Hobby plan this app deploys on.

Git hooks live in `.githooks/` (e.g. `pre-merge-commit`, which blocks merging into `main` if `package.json`'s version wasn't bumped) and require `core.hooksPath` to point there, which `npm install`'s `postinstall` script sets automatically, since `core.hooksPath` is local git config and not tracked by the repo itself.

## Architecture

Two independent transport modules living side by side under `src/app/`, each following the same pattern: a server component page fetches initial data, passes it to a client form component that drives further lookups through internal API routes.

**KRL (`src/app/krl/`, backed by `src/lib/krl/`)**
- `page.tsx` calls `getStations()` from `src/lib/krl/adapter.ts` (server component). Region grouping is no longer a static map: `parseRegionHeaders` derives region names from the header rows the upstream API itself returns (`fg_enable === 0` rows are region headers, e.g. "AREA JABODETABEK"). `REGION_OVERRIDES` in `adapter.ts` force-moves specific stations into a different region than the header they arrived under (e.g. `RK`/Rangkasbitung reassigned to "Jabodetabek"); add to that map rather than special-casing the parser when the upstream grouping is wrong for a given station.
- `TrainRouteForm.tsx` is the client component handling station selection (via `StationCombobox.tsx`, a `cmdk`-based searchable picker; see `src/components/ui/command.tsx`), and drives fare/schedule/route lookups. It also owns a favorites feature: `FavoriteRoutesBar.tsx` renders saved origin/destination pairs (`IFavoriteRoute` in `types.ts`) as pill buttons above the form; favorites are persisted client-side only, in `localStorage` under `krl-favorites` (`getStoredFavorites`/`saveFavorites` in `TrainRouteForm.tsx`), and there is no server-side storage for them. `KRLOnboardingTour.tsx` (driven by `onboarding-data.ts`, using `react-joyride`) shows a one-time first-visit walkthrough gated on a `localStorage` flag; see `docs/krl-onboarding-sdd.md`.
- `src/app/api/v1/krl/{stations,fare,schedules,route,route/leg}/route.ts` are thin `NextResponse` wrappers around `src/lib/krl/adapter.ts`, which does the real work: fetches from `KCI_BASE_URL` (`https://kci.id/api/krl`, see `src/lib/krl/constants.ts`), filters non-passenger trains (`TIDAK ANGKUT PENUMPANG`) out of schedules, and returns everything wrapped in the `{ data, error }` envelope from `src/lib/krl/response.ts` (`ok`/`fail`).
- Schedules/routing are snapshot-primary, not live-fetched (per `docs/krl-schedule-snapshot-primary-sdd.md`, which supersedes most of the older `docs/krl-upstream-reliability-sdd.md`): `getSchedules`/`getTrainSchedule` (`adapter.ts`) never call `kci.id` directly; instead they read a repo-committed JSON snapshot via `src/lib/krl/snapshotStore.ts` (`getRepoScheduleSnapshot`/`getRepoTrainScheduleSnapshot`). There is no live-fetch/Blob/cron/breaker path left for this data, since Vercel Blob was dropped as a snapshot tier for not being viable on the Hobby plan; only `getStations`/`getFare` still call upstream directly, through a plain timeout + one retry (`fetchWithRetry`, constants in `constants.ts`). Every fetch/snapshot read takes an optional `FetchMeta` (`types.ts`) recording which tier served the response (`live`/`repo-snapshot`); route handlers turn that into an `X-KRL-Data-Source` header (`dataSourceHeaders` in `response.ts`) that `TrainRouteForm.tsx` reads to show an inline "data updated {date}" banner, which is always shown now, not just on degradation. `npm run snapshot:refresh` (`scripts/refresh-terminus-snapshots.mjs`) regenerates the repo-committed snapshots and must be run manually/periodically (there is no automated cron warming them anymore); it only writes files that changed, so a run with no upstream changes is a no-op commit-wise.
- `/api/v1/krl/route` computes a station-to-station route, including multi-leg transit journeys across lines, streamed as Server-Sent Events (`text/event-stream`, one `leg`/`leg-error` event per hop plus a terminal `done`) rather than a single JSON body. See `docs/krl-progressive-route-sdd.md`. `/api/v1/krl/route/leg` retries a single failed leg without re-running the whole search. `getRoute` finds a direct train; `tryRouteWithSameLineSplit` (adapter.ts) wraps it to also handle same-line routes the upstream API won't return directly (e.g. across a branch/fork) by walking intermediate stations from `LINES[lineId].stations` and stitching two legs together. If no same-line route exists at all, `getTransitRoute` falls back to `src/lib/krl/topology.ts`, a hand-maintained graph of KRL lines (`LINES`) with branch/fork handling (e.g. the Bogor/Nambo split at `CTA`) and a BFS (`findTransferStations`) over shared-station edges between lines to find transfer points. `docs/krl-lines.md` documents the same lines/station codes in human-readable form; keep it in sync with `LINES` when a route changes (station codes are the upstream `sta_id`s from the KRL partner API, not invented IDs).
- Errors are typed (`UpstreamError`, `NoRouteFoundError` in `src/lib/krl/types.ts`) and mapped to HTTP status by the route handlers, not thrown as generic errors.
- `src/app/api-docs/` serves interactive API docs via `@scalar/nextjs-api-reference`, reading the spec from `public/openapi.yaml`; keep that file in sync when changing `api/v1/krl/*` routes.

**MRT (`src/app/mrt/`, backed by `src/lib/mrt/`)**
- `page.tsx` calls `getStations()` from `@/lib/mrt/adapter` directly (server component), with a try/catch that renders an inline error banner on failure. Passes a flat `IMRTStation[]` array to the client.
- `MRTRouteForm.tsx` is the client component driving station selection (via `MRTStationCombobox.tsx`, a cmdk-based searchable picker typed against `IMRTStation`), and fare/schedule lookup. State mirrors KRL's pattern: `showInitialPrompt`, `showDestinationPrompt`, `showLoading`, `showSameStationNotice`, `fareError` booleans. The day type (weekday/weekend) is auto-selected via `getTypeOfDay()` — no radio toggle. The schedule header displays `Menuju {headingTowards}`. The `headingTowards` field is computed by the adapter from the direction key, not duplicated client-side. No favorites or onboarding tour (single 13-station line — core lookup flow only).
- `src/app/api/mrt/{stations,fare}/route.ts` are thin `NextResponse` wrappers around `src/lib/mrt/adapter.ts`, which does the real work: fetches from `MRT_MIDDLEWARE_BASE_URL` (`https://beweb-dev.jakartamrt.co.id/middleware/api`, see `src/lib/mrt/constants.ts`) with `origin`/`referer` header spoofing, and returns everything wrapped in the `{ data, error }` envelope from `src/lib/mrt/response.ts` (`ok`/`fail`).
- `getStations()` calls `/datum` to return `{ id, slug, name }` station objects. `getFareAndSchedule(from, to, datetime)` calls `POST /route`, resolves travel direction using a hardcoded `MRT_LINE_ORDER` array (station ids from Lebak Bulus to Bundaran HI in physical order, in `src/lib/mrt/constants.ts`), and returns `{ fare, timeEstimation, direction, schedule }`. The old `/api/mrt/routes` route was deleted — termini names now come from the fare/schedule response.
- Fare is computed by the upstream API (`integration.cost`), not locally. `MRT_BASE_FARE`/`MRT_NEXT_STATION_FARE`/`SAME_STATION_PENALTY_FARE` are kept as documentation constants in `src/lib/mrt/constants.ts`.

**Shared conventions**
- `src/app/constants.ts` holds the shared `HOURS` array. KRL's own constants (upstream base URL, revalidate windows, retry/timeout, routing tunables) live in `src/lib/krl/constants.ts`. MRT's constants (upstream base URL, line order, fare values) live in `src/lib/mrt/constants.ts`.
- `src/app/types.ts` holds shared UI state types (`IStationState`, `KRLStation`, `IFavoriteRoute`, etc). KRL request/response/domain types live in `src/lib/krl/types.ts`; MRT types live in `src/lib/mrt/types.ts`.
- `src/app/utils.ts` holds free functions for formatting (Rupiah currency, title case), time math (nearest earlier hour, MRT ETA calculation, HH:MM conversion), and day-type checks (weekday/weekend affects schedule/fare lookups).
- `src/components/ui/` holds shadcn-style shared UI primitives (`button`, `select`, `command`, `badge`, `skeleton`); `src/components/Spinner.tsx` is the one non-primitive shared component.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- All internal API routes under `src/app/api/` exist purely as CORS/auth proxies in front of external APIs; they don't own any business logic beyond light filtering, except the MRT fare route which does real computation.
