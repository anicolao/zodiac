# Gmail feedback: Zodiac prototype

## Source

This document summarizes Stefan’s 2 September 2026 feedback from the local review artifact `Gmail - Zodiac prototype.pdf`. The source PDF is intentionally excluded from the public repository because it contains personal email metadata. This document records the reported experience and desired outcomes for review; it does not prescribe an implementation.

## Overall assessment

The response to the revised prototype was strongly positive: it looked good, printed-card text recognition was described as perfect in the normal case, and detected stars were very close to their real positions. The remaining feedback concentrates on update reliability, edge-case OCR, spatial fidelity, orientation, and final-image legibility.

## Detailed feedback

### 1. Mobile Safari did not reliably load the latest build

- Refreshing an already-open Safari tab did not update the application.
- Selecting the address and pressing **Go** still showed the old version.
- The new version appeared only after closing the tab, opening a new one, and entering the URL again.
- The user needs a dependable way to receive or deliberately activate the current build without discovering this workaround.

### 2. OCR fails when even a small part of the card is outside the photograph

- A fully visible **CAKE** card was read correctly.
- A nearly identical photograph with a slightly clipped card edge produced unrelated OCR text (`CT LC PEE JERR`).
- Recognition should tolerate a card whose border is clipped slightly when the printed name itself remains visible and legible.

### 3. Detected star overlays have a repeatable horizontal offset

- Stars near the middle of the photograph are marked accurately.
- Stars on the left are marked farther left than their physical centers.
- Stars on the right are marked farther right than their physical centers.
- The two CAKE screenshots show the same outward displacement, suggesting systematic coordinate mapping rather than random detection error.

### 4. A top-down square grid becomes distorted in the Zodiac

- Six nearly top-down photographs used the same regular 3×3 token grid.
- In the generated Zodiac, the top of each constellation appears wider and the bottom narrower instead of retaining the square grid.
- The tester perceived this as unnecessary perspective correction or wedge-fitting.
- The desired result is to preserve the photographed constellation’s relative geometry rather than reshape it merely to fill a pie-shaped sector.
- The feedback also states that, for the lower three sectors, the constellation’s logical top should face the centre of the Zodiac and its bottom should face its label.

### 5. Angled photographs are detected consistently but render inconsistently

- Six photographs of the same 3×3 grid were taken from substantially different camera angles.
- On the confirmation screen, the detected placement remained broadly consistent with the top-down results, apart from the same left/right outward offset.
- In the finished Zodiac, the perspective correction did not appear consistent across all six constellations.
- Tokens that were physically the same size rendered at noticeably different sizes. Equal physical tokens should remain equal after camera perspective is accounted for.

### 6. Capture wording does not match iPhone behaviour

- The interface says **Take or choose photo**, but the tested iPhone flow only offered taking a photo.
- The tester does not consider photo-library selection essential, so changing the wording may be preferable to adding that capability.

### 7. Zodiac labels are difficult to read on a phone

- The text around the finished Zodiac should be somewhat larger.
- This is a legibility issue when viewing the completed image at phone size.

## Consolidated outcomes to review

Before implementation, confirm that the intended acceptance outcomes are:

1. An open or installed Safari session can clearly detect and activate a newer deployed build.
2. OCR still reads a visible printed name when a small portion of the card border is clipped.
3. Confirmation overlays align with token centres across the full image, without outward horizontal expansion.
4. A top-down square token grid remains geometrically square in the finished Zodiac.
5. Camera angle is corrected consistently while preserving the constellation’s relative layout.
6. Equal-size physical tokens render at equal size; genuinely different token sizes remain distinguishable.
7. The lower three constellations orient their logical top toward the Zodiac centre and bottom toward their labels.
8. Capture copy reflects the actual iPhone action unless photo-library selection is intentionally supported.
9. Final Zodiac labels remain readable at normal phone viewing size.

## Decisions needing confirmation

- Should constellation geometry remain entirely rectangular, or may it be uniformly scaled to fit a sector as long as it is not tapered or skewed?
- Is the stated orientation rule specific to the lower three sectors, or should one global/card-north rule define all six sectors?
- Should token size represent perspective-corrected physical size rather than raw apparent pixel size? The feedback implies yes and is consistent with preserving meaningful token-size differences.
- For card cropping, how much missing border must be tolerated when the printed word is still fully visible?
- Should the capture action be renamed to **Take photo**, or should photo-library selection be exposed on iPhone?
