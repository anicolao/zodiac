# Zodiac Vision

## Product promise

**A game becomes a constellation.**

Zodiac makes a beautiful, truthful keepsake from a tabletop game without turning the game itself into screen time. Players take a few quick photographs as the table evolves. At the end, the app translates those moments into a single celestial chart that is immediately worth saving or sharing.

The chart is not a score report or a generic AI illustration. Its names, colors, star positions, and token sizes come from the photographed physical game. Someone who played should recognize their game in it.

## The opportunity

Tabletop games create fleeting visual stories: pieces cluster, territories form, and each card gains a distinct pattern. Cleanup erases that state. A normal photo documents the table but rarely feels like a memento, while score-tracking apps tend to interrupt play and produce utilitarian records.

Zodiac sits between those outcomes. It asks for no continuous bookkeeping and transforms a handful of snapshots into an artifact with emotional and visual value.

## Who it is for

The primary user is the person at the table who enjoys marking an occasion and is willing to be the lightweight “photographer” for the game. Other players are recipients: they should understand and enjoy the result without installing the app.

Core job to be done:

> When our game ends, help me preserve what happened as something beautiful I can share with the people who were there.

Secondary jobs:

- Remember a gathering without posting all of its raw photos.
- Celebrate the unique shape of a game, not just its winner.
- Make a physical tabletop experience easy to share in digital spaces.

## Experience principles

### Respect the table

Zodiac should require seconds, not minutes, during play. The main capture action is reachable with one thumb, progress is obvious, and corrections can wait until the end.

### Truth before spectacle

The generated chart must remain traceable to the photographs. Printed card names are read from the image; star color, position, and size are detected from the physical tokens; and the final art is rendered from confirmed structured data. No invented names or pieces.

### The result is the reward

The finished image should feel composed, collectible, and complete. Product chrome disappears from the exported asset. It must survive a message thread, a photo library, and a social post without needing explanatory copy.

### Private by default

Gameplay photos stay on the device unless a user deliberately shares them. Re-encoding captured frames strips embedded metadata before persistence or export. The app requires no account.

### Graceful, not magical

Computer vision will sometimes be uncertain. Zodiac should reveal what it found, make correction direct, and never imply confidence it does not have.

### Works where games happen

After its first successful load, the core capture, review, generation, and save flow should work without a network connection. The installable web app should feel focused and app-like on an iPhone Home Screen.

## What the MVP proves

The MVP is not a generic visual-recognition platform. It tests one proposition:

> Given six photos from one supported game, can a player create and share an accurate, attractive Zodiac in under two minutes after the game ends?

It succeeds when:

- most captures pass without manual changes under normal indoor lighting;
- every recognition error can be fixed without retaking the whole game;
- players describe the output as a keepsake, not merely a visualization;
- sharing requires one deliberate tap after generation;
- a complete session survives accidental app closure and loss of connectivity.

Initial product targets for a moderated test of at least 20 completed games:

- 90% of started six-photo sessions reach a generated chart;
- median post-game review-to-share time is under two minutes;
- at least 80% of participants save or share the result;
- at least 80% rate the chart as an accurate representation of their card names and star colors, sizes, and relative arrangements;
- no image leaves the device except through an explicit user share action.

These are learning targets, not launch claims.

## Deliberate boundaries

The first release supports one six-card physical game, a six-sector chart, red and gold star pieces, printed card-name OCR, and the approved visual theme. It does not determine winners, recognize people, maintain social profiles, publish a public gallery, or synthesize decorative imagery in the cloud.

OCR for layouts beyond the supported card design, arbitrary component types, multiplayer synchronization, historical libraries, alternate themes, and print ordering may follow only after the core ritual is proven.

## Longer-term direction

If the ritual resonates, Zodiac can grow from a one-game tool into a small format for playable memories:

- additional game profiles define card catalogues, piece colors, and chart layouts;
- optional captions record the occasion without changing the core art;
- a private on-device gallery lets players revisit prior games;
- visual themes provide variety while preserving data fidelity;
- high-resolution print exports turn exceptional games into physical keepsakes.

Growth should deepen the artifact, not increase attention demanded during play.

## Product risks

- Recognition that works only on carefully staged photos will break trust.
- An elaborate capture ritual may make players abandon the app mid-game.
- A beautiful but inaccurate chart loses the meaning that distinguishes Zodiac from generic art.
- iPhone storage eviction or camera lifecycle quirks could undermine a local-first promise; recovery and real-device testing are release criteria.
- Sharing can feel broken if the app assumes file-sharing support instead of feature-detecting it and offering a fallback.

## The north-star question

When someone sees their finished chart later, does it bring back that particular game and the people around the table?
