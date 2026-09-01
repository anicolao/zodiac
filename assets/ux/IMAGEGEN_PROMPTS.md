# UX mock-up generation prompts

These are production prompts used by the built-in image-generation tool. They are separate from the project-owner prompt log in `PROMPTS.md`.

## Capture journey board

```text
Use case: ui-mockup
Asset type: UX design mock-up for an installable iPhone Svelte web app
Input images: Image 1 is the visual reference for the finished zodiac chart; Images 2 and 3 are reference gameplay photos that the user captures during a game.
Primary request: Create a polished high-fidelity product design board showing three portrait iPhone screens side by side for the Zodiac app's capture journey.
Screen 1 exact text: "Zodiac", "A game becomes a constellation.", "Start a game"
Screen 2 exact text: "Canyon", "1 of 6", "Keep the card and stars in frame", "Take photo"
Screen 3 exact text: "Canyon captured", "6 stars found", "Retake", "Keep photo", "Finish game"
Screen 1: welcoming start screen with a subtle celestial chart motif and one strong bottom CTA.
Screen 2: live camera capture screen showing the Canyon gameplay setup from Image 2, with a simple framing guide around the card and stars, obvious shutter control, flash control, and compact progress.
Screen 3: capture review showing the same photo with restrained detection overlays around six stars and the card label, plus clear retake/keep actions and a persistent finish-game option.
Style/medium: realistic shippable iOS product UI, not concept art; elegant midnight navy, warm gold, ivory, and restrained red accents inspired by Image 1; refined serif display type paired with highly legible system sans-serif controls.
Composition/framing: three complete phone screens on a neutral dark presentation canvas, evenly spaced, all UI inside safe areas, large thumb-friendly bottom controls.
Lighting/mood: calm, intimate, magical but trustworthy.
Constraints: render only the specified UI text, spelled exactly; practical accessible hierarchy; no Apple logo, no unrelated branding, no watermark; do not obscure the photographed game pieces; avoid tiny text; do not invent extra navigation tabs.
```

## Completion journey board

```text
Use case: ui-mockup
Asset type: UX design mock-up for an installable iPhone Svelte web app
Input images: the square zodiac chart is the canonical finished-art reference; the prior three-phone product board is the UI style reference; the gameplay photos are content references.
Primary request: Create a second polished high-fidelity product design board showing three portrait iPhone screens side by side for the Zodiac app's end-of-game and sharing journey.
Screen 1 exact text: "Ready to make your Zodiac?", "6 constellations", "32 stars", "Generate Zodiac"
Screen 2 exact text: "Mapping the stars…", "Keep Zodiac open"
Screen 3 exact text: "Your Zodiac", "August 31, 2026", "Share", "Save image", "Start another"
Screen 1: a review summary with six compact captured-photo thumbnails arranged as a neat list or grid; provide an understated edit affordance and one strong generate CTA at the bottom.
Screen 2: generation progress using a beautiful restrained celestial animation still: scattered red and gold points resolving into a circular chart; clear calm progress indication.
Screen 3: the completed square Zodiac art displayed large and uncropped, closely reflecting the provided canonical image, with an immediately accessible native share button, secondary save action, and quiet restart link.
Style/medium: realistic shippable iOS product UI matching the prior mock-up, not concept art; elegant midnight navy, warm gold, ivory, and restrained red accents; refined serif display type paired with highly legible system sans-serif controls.
Composition/framing: three complete phone screens on a neutral dark presentation canvas, evenly spaced, all UI inside safe areas, large thumb-friendly bottom controls.
Lighting/mood: celebratory, intimate, keepsake-like, trustworthy.
Constraints: render only the specified UI text, spelled exactly; practical accessible hierarchy; no Apple logo, no unrelated branding, no watermark; preserve the 1:1 square artwork aspect ratio; avoid tiny text; no social-network-specific buttons; do not invent extra navigation tabs.
```
