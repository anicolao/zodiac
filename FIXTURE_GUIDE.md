# Real-photo fixture review

The `/fixtures` route is a development-only workspace for reviewing the real-photo recognition corpus before it becomes an algorithmic acceptance gate.

## Open the annotator

```sh
npm run dev
```

Then open <http://127.0.0.1:5191/fixtures>.

The route deliberately has no production data endpoint. It is not linked from the application and the regression photographs are not copied into `static/`, the production bundle, GitHub Pages, or the service-worker cache.

## Review workflow

1. Select each fixture from the left rail.
2. Confirm the printed label and the cyan rotated rectangle around only its text.
3. Confirm that the cyan **NORTH** arrow points straight out from the rectangle's top edge. This is the constellation's logical up direction, regardless of camera or mat rotation.
4. Confirm that every physical token has exactly one circle with the correct red/gold color and an outer radius that encloses the token.
5. Drag incorrect token circles and radius handles as needed. For text, drag the rectangle itself to move it, the right/bottom handles to resize it, or the **NORTH** handle to rotate it. The arrow cannot diverge from the rectangle.
6. Change **Review status** to **Approved** and select **Save JSON**. The local dev server writes the individual record in `tests/fixtures/real/annotations/`.

The JSON preview and per-record download are available for inspection, but **Save JSON** is the canonical repository workflow.

## Dataset layout

```text
tests/fixtures/real/
├── annotations/       # one expected-output JSON record per photograph
└── images/            # 1200×1600 metadata-free regression JPEGs
```

The original `assets/examples/IMG_*.jpg` files remain local and ignored because they contain full camera metadata, including location data. `npm run fixtures:prepare` uses a browser canvas to scale those originals to a 1600 px long edge, re-encode them, and replace only the derived regression images. Canvas encoding strips EXIF/GPS data.

## Annotation schema

All geometry is normalized to the complete image: `x=0,y=0` is its top-left and `x=1,y=1` is its bottom-right.

- `expected.cardLabel`: exact uppercase text printed on the card.
- `expected.textRegion`: an oriented image-space rectangle represented by normalized center, width, height, and clockwise `rotationDegrees`. Width and height are normalized against image width.
- Logical north is derived rather than stored independently: it is always perpendicular to the rectangle's top edge. At `rotationDegrees: 0`, north points toward the top of the photograph.
- `expected.stars[]`: stable id, red/gold class, normalized center, and radius. Radius is normalized against image width so it represents a true image-space circle.
- `reviewStatus`: `draft` until a human has confirmed the complete record, then `approved`.

These annotations describe expected output only. They do not encode or depend on the current recognition algorithm.
