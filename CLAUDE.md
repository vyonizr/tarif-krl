# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Jadwal KRL (formerly Tarif KRL) — a Next.js (App Router) web app for calculating commuter line fares and schedules for Jabodetabek/Yogyakarta KRL, and fares/routes for Jakarta MRT. Built on two upstream data sources: the KRL partner API (`kci.id/api/krl`) and a Supabase-backed dataset for MRT stations/routes.

## Commands

- `npm run dev` — start dev server (Next.js)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (`next/core-web-vitals` config)
- `npm test` — Jest (currently covers `src/lib/krl/adapter.ts`)

## Environment

Requires `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` (see `.env.example`) — used by all MRT-related routes/pages to query Supabase's PostgREST API directly via `fetch`, not a Supabase client SDK.

## Architecture

Two independent transport modules living side by side under `src/app/`, each following the same pattern: a server component page fetches initial data, passes it to a client form component that drives further lookups through internal API routes.

**KRL (`src/app/krl/`, backed by `src/lib/krl/`)**
- `page.tsx` calls `getStations()` from `src/lib/krl/adapter.ts` (server component). Region grouping is no longer a static map — `parseRegionHeaders` derives region names from the header rows the upstream API itself returns (`fg_enable === 0` rows are region headers, e.g. "AREA JABODETABEK"). `REGION_OVERRIDES` in `adapter.ts` force-moves specific stations into a different region than the header they arrived under (e.g. `RK`/Rangkasbitung reassigned to "Jabodetabek") — add to that map rather than special-casing the parser when the upstream grouping is wrong for a given station.
- `TrainRouteForm.tsx` is the client component handling station selection, and calls `/api/v1/krl/{fare,schedules}` for fare/schedule data. It also owns a favorites feature: `FavoriteRoutesBar.tsx` renders saved origin/destination pairs (`IFavoriteRoute` in `types.ts`) as pill buttons above the form; favorites are persisted client-side only, in `localStorage` under `krl-favorites` (`getStoredFavorites`/`saveFavorites` in `TrainRouteForm.tsx`) — there is no server-side storage for them.
- `src/app/api/v1/krl/{stations,fare,schedules,route}/route.ts` are thin `NextResponse` wrappers around `src/lib/krl/adapter.ts`, which does the real work: fetches from `KCI_BASE_URL` (`https://kci.id/api/krl`, see `src/lib/krl/constants.ts`) with timeout + retry (`fetchWithRetry`), filters non-passenger trains (`TIDAK ANGKUT PENUMPANG`) out of schedules, and returns everything wrapped in the `{ data, error }` envelope from `src/lib/krl/response.ts` (`ok`/`fail`).
- `/api/v1/krl/route` computes a station-to-station route, including multi-leg transit journeys across lines: `getRoute` finds a direct train; `tryRouteWithSameLineSplit` (adapter.ts) wraps it to also handle same-line routes the upstream API won't return directly (e.g. across a branch/fork) by walking intermediate stations from `LINES[lineId].stations` and stitching two legs together. If no same-line route exists at all, `getTransitRoute` falls back to `src/lib/krl/topology.ts`, a hand-maintained graph of KRL lines (`LINES`) with branch/fork handling (e.g. the Bogor/Nambo split at `CTA`) and a BFS (`findTransferStations`) over shared-station edges between lines to find transfer points. `docs/krl-lines.md` documents the same lines/station codes in human-readable form — keep it in sync with `LINES` when a route changes (station codes are the upstream `sta_id`s from the KRL partner API, not invented IDs).
- Errors are typed (`UpstreamError`, `NoRouteFoundError` in `src/lib/krl/types.ts`) and mapped to HTTP status by the route handlers, not thrown as generic errors.
- `src/app/api-docs/` serves interactive API docs via `@scalar/nextjs-api-reference`, reading the spec from `public/openapi.yaml` — keep that file in sync when changing `api/v1/krl/*` routes.

**MRT (`src/app/mrt/`)**
- MRT data (stations, routes, stop ordering) is *not* from an official API — it's a hand-maintained dataset in Supabase, queried via raw `fetch` to Supabase's PostgREST endpoint (`process.env.SUPABASE_URL + '/stations'|'/routes'|'/stops'`, headers set with `apikey`/`Authorization`). See `src/app/api/mrt/*/route.ts` and the `getData`/`getRoutesData` functions in `src/app/mrt/page.tsx`.
- `page.tsx` also separately fetches official MRT station metadata (facilities, schedule notes, banners) from `jakartamrt.co.id`, routed through `corsproxy.io` (`CORS_MRT_STATIONS_OFFICIAL_URL` in `constants.ts`) since that endpoint doesn't send CORS headers.
- Fare calculation (`src/app/api/mrt/fare/route.ts`) is computed locally, not fetched: given two station IDs, it finds each station's stops (a station can belong to multiple routes/stops), finds a shared route where the departure stop's `order` precedes the destination's (`findSharedRoute`), then computes fare as `MRT_BASE_FARE + (numberOfStops - 1) * MRT_NEXT_STATION_FARE`.

**Shared conventions**
- `src/app/constants.ts` — MRT fare constants and the `jakartamrt.co.id`/corsproxy URLs live here. KRL's own constants (upstream base URL, revalidate windows, retry/timeout, routing tunables) live in `src/lib/krl/constants.ts`.
- `src/app/types.ts` — MRT interfaces and shared UI state types (`IStationState`, etc). KRL request/response/domain types live in `src/lib/krl/types.ts` — the KRL module is the one exception to "no per-feature type files," since it outgrew the shared file.
- `src/app/utils.ts` — free functions for formatting (Rupiah currency, title case), time math (nearest earlier hour, MRT ETA calculation, HH:MM conversion), and day-type checks (weekday/weekend affects schedule/fare lookups).
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- All internal API routes under `src/app/api/` exist purely as CORS/auth proxies in front of external APIs — they don't own any business logic beyond light filtering, except the MRT fare route which does real computation.
