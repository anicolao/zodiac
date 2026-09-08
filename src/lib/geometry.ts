import type { CapturePlane, Point } from './types';

export type Homography = [number, number, number, number, number, number, number, number, number];

function solve(matrix: number[][], values: number[]): number[] | undefined {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return undefined;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row[size]);
}

export function homographyToUnitSquare(plane: CapturePlane): Homography | undefined {
  const destinations: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ];
  const matrix: number[][] = [];
  const values: number[] = [];
  plane.corners.forEach(({ x, y }, index) => {
    const destination = destinations[index];
    matrix.push([x, y, 1, 0, 0, 0, -destination.x * x, -destination.x * y]);
    values.push(destination.x);
    matrix.push([0, 0, 0, x, y, 1, -destination.y * x, -destination.y * y]);
    values.push(destination.y);
  });
  const coefficients = solve(matrix, values);
  return coefficients
    ? [...coefficients, 1] as Homography
    : undefined;
}

export function projectPoint(homography: Homography, point: Point): Point {
  const denominator = homography[6] * point.x + homography[7] * point.y + homography[8];
  return {
    x: (homography[0] * point.x + homography[1] * point.y + homography[2]) / denominator,
    y: (homography[3] * point.x + homography[4] * point.y + homography[5]) / denominator
  };
}
