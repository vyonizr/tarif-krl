# LRT Lines

Source of truth for line membership/topology is `src/lib/lrt/topology.ts` (`TRUNK`,
`CIBUBUR_BRANCH`, `BEKASI_BRANCH`, `FORK_POINT`) and station names/codes in
`src/lib/lrt/constants.ts` (`LRT_STATIONS`). This doc is the human-readable version,
with station names next to their slugs, in the order trains actually run. Keep both
in sync when KAI/LRT Jabodebek changes a route.

LRT Jabodebek is a single physical line with a fork at Cawang, splitting into two
branches. There is no separate "line" per branch in the traffic sense — trains
running the Cibubur branch and trains running the Bekasi branch both traverse the
same shared trunk between Dukuh Atas BNI and Cawang.

## Trunk (shared by both branches)

Dukuh Atas BNI (dukuh-atas-bni) – Setiabudi (setiabudi) – Rasuna Said (rasuna-said) –
Kuningan (kuningan) – Pancoran bank bjb (pancoran-bank-bjb) – Cikoko (cikoko) –
Ciliwung (ciliwung) – Cawang (cawang) – fork:

- **Cibubur branch:** Cawang (cawang) – Taman Mini (taman-mini) –
  Kampung Rambutan (kampung-rambutan) – Ciracas (ciracas) – Harjamukti (harjamukti)
- **Bekasi branch:** Cawang (cawang) – Halim (halim) –
  Jati Bening Baru (jati-bening-baru) – Cikunir 1 (cikunir-1) – Cikunir 2 (cikunir-2) –
  Bekasi Barat (bekasi-barat) – Jati Mulya (jati-mulya)

## Routing notes

- A trip is **direct** when both stations sit on the same branch's full path
  (`CIBUBUR_LINE_ORDER` or `BEKASI_LINE_ORDER` in `topology.ts`, each being the
  trunk plus one branch, in physical order) — this includes trunk-only trips,
  since the trunk is shared by both.
- A trip is a **transfer** (via Cawang, the `FORK_POINT`) only when it crosses
  branches — e.g. Harjamukti (Cibubur) ↔ Bekasi Barat (Bekasi). See
  `getJourney`/`tryRouteWithSameLineSplit`-equivalent logic in `src/lib/lrt/adapter.ts`.
- For a trunk-only trip heading away from Dukuh Atas BNI, the destination shown as
  "heading towards" is Cawang, not a branch terminus — a trunk train could continue
  onto either branch, so only Cawang is certain (`buildDirectLeg` in `adapter.ts`).
