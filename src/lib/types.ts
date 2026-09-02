export type StarColor = 'gold' | 'red';

export interface DetectedStar {
  id: string;
  color: StarColor;
  x: number;
  y: number;
  size: number;
  confidence: number;
}
export interface Capture {
  id: string;
  order: number;
  cardLabel: string;
  image: Blob;
  stars: DetectedStar[];
  cardRotationDegrees?: number;
  imageAspectRatio?: number;
  acceptedAt: string;
}

export interface GameSession {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'capturing' | 'reviewing' | 'complete';
  captures: Capture[];
  output?: Blob;
}

export interface GameHistoryEntry {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  completedAt: string;
  cardLabels: string[];
  goldCount: number;
  redCount: number;
  output: Blob;
}

export function newSession(): GameSession {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'capturing',
    captures: []
  };
}
