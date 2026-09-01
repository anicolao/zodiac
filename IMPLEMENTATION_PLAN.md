# Zodiac Implementation Plan

## Outcome

Deliver the MVP as the repository's first pull request: an installable Svelte SPA that turns exactly six gameplay photographs into the approved square Zodiac, with printed card-name OCR, token color/position/size reproduction, local persistence, offline operation, and one-tap sharing.

## Locked product decisions

- One game produces six captures and six chart sectors.
- Every sector name originates from the printed card visible in its photograph.
- Red/gold token color, normalized position, and relative physical size are recorded and reproduced.
- `zodiac.png` is the approved art reference.
- Capture normalization, OCR, token detection, persistence, rendering, and export remain local to the device.

## Architecture

The production build is a static SvelteKit SPA. A system camera/photo input provides the image. Canvas re-encodes it to strip metadata, a locally bundled Tesseract worker reads the printed card, and a purpose-built HSV/connected-component detector records colored tokens. IndexedDB stores the sanitized active session plus compact completed-game history entries. Canvas renders a deterministic 2048×2048 PNG. The Web Share API receives that file when supported; download is the fallback. The service worker caches the application, OCR engine, language data, and root shell for offline use.

No backend, user account, analytics SDK, CDN runtime dependency, cloud OCR, or image upload exists in the MVP.

## Delivery phases

### 1. Product contract and fixtures — complete

- [x] Resolve the five open product decisions.
- [x] Update vision, MVP, and UX documentation.
- [x] Generate six photorealistic fixtures from the gameplay references published as metadata-free copies in `assets/examples/`.
- [x] Validate exact card text, token counts, colors, separation, and size distinction.
- [x] Preserve image-generation prompts beside the fixtures.

### 2. Local vertical slice — complete

- [x] Create the static SvelteKit/TypeScript application.
- [x] Implement system camera/photo selection.
- [x] Normalize orientation and re-encode without source EXIF/GPS.
- [x] Bundle worker, engine, and English OCR data locally.
- [x] Detect the physical card boundary and OCR its printed interior.
- [x] Detect red/gold tokens and record x/y/size/confidence.
- [x] Present inspectable overlays and correction controls.

### 3. Six-card session and keepsake — complete

- [x] Persist one recoverable session and sanitized blobs in IndexedDB.
- [x] Support exactly six accepted photographs and retakes.
- [x] Render the approved navy/gold six-sector chart at 2048×2048.
- [x] Preserve confirmed labels, colors, relative positions, and token sizes.
- [x] Restore the completed output after reload.
- [x] Atomically archive each completed PNG and summary in a versioned local Game history.
- [x] Recover, save, and reshare historical Zodiacs without retaining their source photographs.
- [x] Move finished stars into a roomier outer band and reduce their display scale.
- [x] Share a PNG file through the platform API with download fallback.

### 4. Home Screen and offline behavior — complete

- [x] Supply manifest metadata, full-screen/standalone override, icons, theme, and safe-area layout.
- [x] Cache the root shell, compiled application, and local OCR assets.
- [x] Defer all photo/session content to IndexedDB rather than network caches.
- [x] Prove offline reload and new-photo OCR after one online load.

### 5. Verification and review — complete for PR 1

- [x] Type-check and production-build gates.
- [x] Unit tests for color classification, OCR cleanup, and size-preserving sector mapping.
- [x] Playwright unified-step helper and generated scenario READMEs.
- [x] Zero-pixel phone and desktop visual baselines.
- [x] Complete six-fixture start-to-share test with no external requests.
- [x] IndexedDB reload recovery test.
- [x] Completed-game history recovery and reshare test.
- [x] Offline service-worker/OCR test.
- [x] Retained GitHub Pages preview for each PR with a bot-authored review link.
- [x] Base-path-safe manifest, OCR assets, and service-worker scope for preview and production URLs.
- [ ] Real iPhone Safari and Home Screen smoke test by the reviewer.
- [ ] Share-sheet test on a physical iPhone.
- [ ] Warm/dim/angled real-game fixture expansion after first field use.

## Acceptance gates

The first PR is ready for review when all of the following pass:

```sh
npm run check
npm run build
npm run test:unit
npm run test:e2e
```

Product acceptance additionally requires a physical iPhone run confirming Home Screen launch, system-camera return, OCR latency, storage recovery after backgrounding, and PNG sharing into at least Messages and Photos/Files.

## Known trade-offs

- The local OCR engine adds roughly 9 MB of static assets. This is the privacy/offline cost of avoiding a server; the non-SIMD LSTM build is selected for broad compatibility and smaller caching cost.
- The supported card layout places a high-contrast ivory card in the lower portion of the frame. Other layouts are intentionally out of scope.
- Token detection is calibrated to the game's red/gold glitter pieces and the capture guidance. Direct correction is available when lighting defeats segmentation.
- The custom live camera mock-up remains product direction; PR 1 delegates capture to the iOS system camera for lifecycle reliability.

## Post-review sequence

1. Run the real-device acceptance pass and record results in the PR.
2. Tune detection thresholds only from failed real photographs, adding each as a regression fixture with permission.
3. Resolve remaining sector-order and in-art date/title decisions.
4. Merge PR 1 only after product, visual, privacy, and physical-device review.
