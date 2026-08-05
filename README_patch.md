Films App patch — 2026-07-29 round 3

Included changed files:
- src/screens/SearchScreen.tsx
- src/utils/searchFilters.ts
- src/api/tmdb.ts
- src/components/MovieDetailsModal.tsx

What changed:
1. Reviews section now shows a compact summary with an "Ещё" expander.
2. Useful user reviews appear only after expanding the summary.
3. Search has separate filter and sort sections with a vertically scrollable page.
4. Latest dataset now prefers content with enough ratings so sorting and rating-based modes have usable input.
5. Hybrid sort now uses soft ranking instead of returning an empty result too aggressively.
