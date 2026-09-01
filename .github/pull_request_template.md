## Summary

- builds the local-only six-card SvelteKit SPA described by the product documents
- reads printed card names with bundled OCR and records token color, position, and size
- renders, restores, shares, and saves a deterministic 2048×2048 Zodiac PNG
- adds installable Home Screen metadata, offline caching, generated gameplay fixtures, and executable E2E documentation

## Product contract

- [x] Exactly six photographs and sectors
- [x] Card names originate in printed photograph pixels
- [x] Token color, position, and relative size are reproduced
- [x] Approved navy/gold art direction
- [x] Local processing and persistence only

## Verification

- [x] `npm run check`
- [x] `npm run build`
- [x] `npm run test:unit`
- [x] `npm run test:e2e`
- [x] `npm audit --omit=dev`

The Playwright suite covers a complete six-photo game, 37 detected tokens, OCR-derived labels, sharing, reload recovery, phone/desktop layouts, and a new offline OCR capture after service-worker installation.

## Review focus

- capture and confirmation language around a real table
- fidelity of token placement and size in the finished chart
- six-sector label legibility on a phone
- physical iPhone Home Screen, camera, offline, memory, and share-sheet validation before release
