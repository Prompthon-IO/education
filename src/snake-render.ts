export type SnakeDirection = "up" | "right" | "down" | "left";

export type SnakeCell = {
  x: number;
  y: number;
};

export type SnakePoint = {
  x: number;
  y: number;
};

export type SnakeSymbolPlacement = {
  symbol: string;
  point: SnakePoint;
};

export function resolveSnakeExecutionDirection(
  currentDirection: SnakeDirection,
  cachedDirection: SnakeDirection
): SnakeDirection {
  return isOppositeSnakeDirection(currentDirection, cachedDirection) ? currentDirection : cachedDirection;
}

export function getSnakeMoveInterval(baseIntervalMs: number, collectedCount: number): number {
  const safeBaseInterval = Number.isFinite(baseIntervalMs) ? Math.max(1, baseIntervalMs) : 1;
  const safeCollectedCount = Number.isFinite(collectedCount) ? Math.max(0, Math.floor(collectedCount)) : 0;

  return Math.max(1, Math.round(safeBaseInterval * Math.pow(0.9, safeCollectedCount)));
}

export function buildSnakeMotionTrack(
  fromSnake: readonly SnakePoint[],
  toSnake: readonly SnakeCell[],
  progress: number
): SnakePoint[] {
  if (!fromSnake.length && !toSnake.length) {
    return [];
  }

  const length = Math.max(fromSnake.length, toSnake.length);
  const alignedFrom = padSnakePoints(fromSnake, length);
  const alignedTo = padSnakePoints(toSnake, length);
  const movingPoints = interpolateSnakeSegments(alignedFrom, alignedTo, progress);
  const track: SnakePoint[] = [];

  pushDistinctPoint(track, movingPoints[0]);
  for (let index = 0; index < movingPoints.length - 1; index += 1) {
    // Every segment moves into the previous segment's old cell. Keeping that
    // cell as a waypoint makes a turn remain orthogonal throughout the frame.
    pushDistinctPoint(track, alignedFrom[index]);
    pushDistinctPoint(track, movingPoints[index + 1]);
  }

  return track;
}

export function interpolateSnakeSegments(
  fromSnake: readonly SnakePoint[],
  toSnake: readonly SnakeCell[],
  progress: number
): SnakePoint[] {
  const length = Math.max(fromSnake.length, toSnake.length);
  const alignedFrom = padSnakePoints(fromSnake, length);
  const alignedTo = padSnakePoints(toSnake, length);
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return alignedFrom.map((fromPoint, index) => interpolateSnakePoint(fromPoint, alignedTo[index], clampedProgress));
}

export function placeSnakeSymbols(
  symbols: readonly string[],
  fromSnake: readonly SnakePoint[],
  toSnake: readonly SnakeCell[],
  progress: number
): SnakeSymbolPlacement[] {
  const length = Math.max(fromSnake.length, toSnake.length);
  const alignedFrom = padSnakePoints(fromSnake, length);
  const segmentPoints = interpolateSnakeSegments(alignedFrom, toSnake, progress);

  return symbols.slice(0, Math.max(0, segmentPoints.length - 1)).map((symbol, index) => {
    const segmentIndex = index + 1;
    const anchor = segmentPoints[segmentIndex];
    const oldCellWaypoint = alignedFrom[segmentIndex];
    const tailwardPoint = snakePointDistance(anchor, oldCellWaypoint) > 0.001
      ? oldCellWaypoint
      : segmentPoints[segmentIndex + 1] ?? anchor;

    return {
      symbol: symbol === " " ? "·" : symbol,
      point: moveSnakePointToward(anchor, tailwardPoint, 0.18)
    };
  });
}

export function formatSnakeTrackPoints(track: readonly SnakePoint[]): string {
  return track.map((point) => `${formatCoordinate(point.x + 0.5)},${formatCoordinate(point.y + 0.5)}`).join(" ");
}

function padSnakePoints(points: readonly SnakePoint[], length: number): SnakePoint[] {
  const fallback = points[points.length - 1] ?? { x: 0, y: 0 };
  return Array.from({ length }, (_, index) => points[index] ?? fallback);
}

function interpolateSnakePoint(fromPoint: SnakePoint, toPoint: SnakePoint, progress: number): SnakePoint {
  return {
    x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
    y: fromPoint.y + (toPoint.y - fromPoint.y) * progress
  };
}

function moveSnakePointToward(fromPoint: SnakePoint, toPoint: SnakePoint, distance: number): SnakePoint {
  const totalDistance = snakePointDistance(fromPoint, toPoint);
  if (totalDistance <= distance || totalDistance === 0) {
    return { ...toPoint };
  }
  return interpolateSnakePoint(fromPoint, toPoint, distance / totalDistance);
}

function snakePointDistance(left: SnakePoint, right: SnakePoint) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function pushDistinctPoint(points: SnakePoint[], point: SnakePoint | undefined) {
  if (!point) {
    return;
  }
  const previous = points[points.length - 1];
  if (!previous || previous.x !== point.x || previous.y !== point.y) {
    points.push(point);
  }
}

function isOppositeSnakeDirection(currentDirection: SnakeDirection, nextDirection: SnakeDirection) {
  return (
    (currentDirection === "up" && nextDirection === "down") ||
    (currentDirection === "down" && nextDirection === "up") ||
    (currentDirection === "left" && nextDirection === "right") ||
    (currentDirection === "right" && nextDirection === "left")
  );
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(4)).toString();
}
