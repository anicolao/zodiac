# Issue-photo acceptance corpus

These 12 fixtures reproduce the multi-word cards, numbered word selection, black die, camera rotations, and constellation layouts reported during iPhone testing.

The local `issue_photos/` HEIC originals are ignored because they contain device and location metadata. The committed JPEGs were decoded, resized to 1200×1600, and re-encoded through a browser canvas, which removes that metadata while retaining the photographed pixels needed for recognition tests.

`expectations.json` records all six printed words, the upward die value, the selected word, and the physical token counts for every photograph. In particular, `img_0964.jpg` is exactly upside down and `img_0965.jpg` is approximately a quarter-turn, providing explicit orientation regressions.
