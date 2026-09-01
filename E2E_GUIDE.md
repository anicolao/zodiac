# E2E Testing Guide

Zodiac uses [Playwright](https://playwright.dev/) for end-to-end testing. These scenarios are the primary executable source of truth for the complete product experience.

## 1. Philosophy: zero-pixel tolerance

Visual state is the user's primary feedback during capture, review, and sharing, so committed screenshots use zero-pixel tolerance.

- Chromium runs with software-rendering and stable font flags.
- Device scale is fixed at 1 and time zone/locale are fixed to Toronto/en-CA.
- Random visual content must use fixed seeds. The Zodiac renderer derives its deterministic seed from confirmed card names.
- Baselines may be changed only with an intentional UI change and visual review.

## 2. Scenario structure

Every scenario has its own numbered directory:

```text
tests/e2e/
├── helpers/test-step-helper.ts
├── fixtures/                         generated gameplay photographs
├── 001-complete-zodiac/
│   ├── 001-complete-zodiac.spec.ts
│   ├── README.md                     generated verification document
│   └── screenshots/                  committed visual baselines
├── 002-responsive-pwa/
└── 003-offline-capture/
```

`README.md` and screenshot numbering are produced by the scenario. Do not hand-maintain them.

## 3. Unified step pattern

Use `TestStepHelper.step()` for each documented state. A step performs semantic assertions, verifies the stable app status, audits visible touch targets, captures a zero-pixel screenshot, and records the same assertions for the generated README.

```ts
const steps = new TestStepHelper(page, testInfo);
steps.setMetadata('Complete local Zodiac journey', 'Six photos become one keepsake.');

await steps.step('completed-zodiac', {
  description: 'The approved square Zodiac is completed entirely on device',
  verifications: [
    {
      spec: 'The output is a 2048×2048 PNG',
      check: async () => expect(page.locator('.result-image')).toBeVisible()
    }
  ]
});

steps.generateDocs();
```

Never manually manage counters, screenshot names, or duplicate verification prose into a scenario README.

## 4. Real fixture policy

- The main test must upload the files in `tests/e2e/fixtures/` through the same file input a player uses.
- A fixture filename may never supply the card name to application code. The E2E assertion proves OCR reads the printed pixels.
- Expected token counts, colors, and size ordering are asserted after real browser analysis.
- Generated fixtures and their prompts are committed. Changes require visual validation and fresh zero-pixel baselines.
- Real player photos may be added only with explicit permission and stripped metadata.

## 5. Synchronization rules

- Arbitrary `waitForTimeout()` calls are forbidden.
- Wait on observable UI, IndexedDB, service-worker, download, or share conditions.
- Keep per-assertion timeouts at 30 seconds or less. OCR completion may use a 90-second visible-state timeout on slow CI hosts.
- Run tests serially with one worker because OCR is memory-intensive and the scenarios generate documentation.

## 6. Required coverage

- one full six-card game from Start through Share;
- photo-derived card names and exact red/gold counts;
- visibly distinct token sizes and 2048×2048 output;
- no external network request during recognition or rendering;
- result restoration from IndexedDB after reload;
- manifest, phone/desktop hierarchy, reduced motion, and 44-pixel controls;
- service-worker offline reload followed by uncached-in-memory OCR of a fixture.

## 7. Commands

```sh
npm run test:e2e
npm run test:e2e:update-snapshots
npx playwright test tests/e2e/001-complete-zodiac --project=phone
```

Run `npm run check`, `npm run build`, and `npm run test:unit` before the E2E suite. Snapshot updates are not a fix for a failing assertion.

