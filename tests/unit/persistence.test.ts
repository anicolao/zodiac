import { describe, expect, it } from 'vitest';
import { historyEntryFromSession } from '../../src/lib/persistence';
import type { GameSession } from '../../src/lib/types';

describe('completed game history', () => {
  it('archives only the output and summary needed to recover and reshare a Zodiac', () => {
    const session: GameSession = {
      schemaVersion: 1,
      id: 'game-1',
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:30:00.000Z',
      status: 'complete',
      output: new Blob(['zodiac'], { type: 'image/png' }),
      captures: Array.from({ length: 6 }, (_, order) => ({
        id: `capture-${order}`,
        order,
        cardLabel: `CARD ${order + 1}`,
        image: new Blob(['photo'], { type: 'image/jpeg' }),
        acceptedAt: '2026-09-01T12:15:00.000Z',
        stars: [
          { id: `gold-${order}`, color: 'gold', x: 0.4, y: 0.5, size: 0.06, confidence: 1 },
          { id: `red-${order}`, color: 'red', x: 0.6, y: 0.5, size: 0.14, confidence: 1 }
        ]
      }))
    };

    const entry = historyEntryFromSession(session, '2026-09-01T12:31:00.000Z');
    expect(entry).toMatchObject({
      id: 'game-1',
      completedAt: '2026-09-01T12:31:00.000Z',
      goldCount: 6,
      redCount: 6,
      cardLabels: ['CARD 1', 'CARD 2', 'CARD 3', 'CARD 4', 'CARD 5', 'CARD 6']
    });
    expect(entry.output).toBe(session.output);
    expect(entry).not.toHaveProperty('captures');
  });
});
