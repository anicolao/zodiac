# Gameplay fixture image-generation prompts

The six fixture photographs were produced with the built-in image-generation tool. The two gameplay photographs published as metadata-free copies in `assets/examples/` were passed as visual references only. Each asset used this exact prompt with the indicated card and token substitution.

```text
Use case: photorealistic-natural
Asset type: deterministic Playwright end-to-end test fixture photograph
Input images: Images 1 and 2 are visual references only for the real iPhone gameplay-photo composition, wooden tabletop, physical star pieces, and printed constellation card.
Primary request: Create one realistic vertical smartphone photograph of a tabletop game state. A single ivory rectangular constellation card lies face-up near the bottom of the frame, with {TOKENS} loosely arranged above it.
Scene/backdrop: ordinary warm medium-brown wooden dining table with natural grain, slight real-world wear, and no other objects.
Subject: exactly the specified physical five-point star tokens above exactly one printed card.
Style/medium: photorealistic casual iPhone snapshot, natural material texture, mildly imperfect framing and warm indoor ambient light; match the reference photos rather than studio product photography.
Composition/framing: portrait orientation, near-overhead handheld view; all tokens fully separated and clearly visible in the upper two-thirds; the entire card fully visible and level in the lower third with generous separation from the tokens.
Materials/textures: small gold tokens and larger dark-red tokens have slightly glittery 3D-printed plastic texture; card is matte warm ivory with a subtle thin celestial border.
Text (verbatim): "{CARD}"
Text placement: render "{CARD}" exactly once in large uppercase dark-navy serif letters centered on the card; the card must contain no other readable words.
Constraints: exact token counts and colors; gold tokens visibly smaller than red tokens; every token fully visible and non-overlapping; one card only; the exact card name is highly legible; no people, hands, logos, watermark, UI, captions, extra pieces, or extra text.
Avoid: dramatic shadows, shallow focus, perspective distortion, cropped card, cropped tokens, duplicate objects, illustrated or synthetic-looking surfaces.
```

| File | `{CARD}` | `{TOKENS}` |
|---|---|---|
| `castle.png` | `CASTLE` | four small glittery gold five-point star tokens and one noticeably larger glittery dark-red five-point star token |
| `dragon.png` | `DRAGON` | five small glittery gold five-point star tokens and two noticeably larger glittery dark-red five-point star tokens |
| `sailboat.png` | `SAILBOAT` | three small glittery gold five-point star tokens and two noticeably larger glittery dark-red five-point star tokens |
| `elephant.png` | `ELEPHANT` | six small glittery gold five-point star tokens and one noticeably larger glittery dark-red five-point star token |
| `guitar.png` | `GUITAR` | four small glittery gold five-point star tokens and two noticeably larger glittery dark-red five-point star tokens |
| `hot-air-balloon.png` | `HOT AIR BALLOON` | five small glittery gold five-point star tokens and two noticeably larger glittery dark-red five-point star tokens |

Dragon, Elephant, and Hot Air Balloon required count corrections. The targeted edit prompt was:

```text
Use case: precise-object-edit
Asset type: deterministic Playwright end-to-end test fixture photograph
Input images: Image 1 is the edit target.
Primary request: Change only the tokens so the photograph contains exactly {GOLD_COUNT} small gold stars and exactly {RED_COUNT} larger dark-red stars.
Constraints: preserve the exact printed card name and spelling, the card itself, wooden tabletop, portrait crop, camera angle, lighting, shadows, realistic 3D-printed glitter texture, and all other aspects; all tokens fully separated and visible; gold tokens remain visibly smaller than red tokens; no new objects, text, captions, logo, UI, or watermark.
```

Dragon and Hot Air Balloon each needed one final single-object edit:

```text
Use case: precise-object-edit
Asset type: deterministic Playwright end-to-end test fixture photograph
Input images: Image 1 is the edit target.
Primary request: Add one and only one new small gold five-point star token in an empty area among the existing tokens. The final image must contain exactly five small gold stars and exactly two larger dark-red stars.
Constraints: change only by adding that single small gold token; preserve every existing token, exact printed card name and spelling, card, tabletop, portrait crop, camera angle, lighting, shadows, and texture; all seven tokens fully separated and visible; gold visibly smaller than red; no new text, captions, logo, UI, or watermark.
```
