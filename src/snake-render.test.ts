import { describe, expect, test } from "vitest";
import {
  buildSnakeMotionTrack,
  formatSnakeTrackPoints,
  getSnakeMoveInterval,
  interpolateSnakeSegments,
  placeSnakeSymbols,
  resolveSnakeExecutionDirection,
  type SnakeCell,
  type SnakeDirection,
  type SnakePoint
} from "./snake-render";

describe("Word Snake acceleration", () => {
  test("starts at the base movement interval", () => {
    expect(getSnakeMoveInterval(500, 0)).toBe(500);
    expect(getSnakeMoveInterval(600, 0)).toBe(600);
  });

  test("gets 10 percent faster after every collected tile", () => {
    const intervals = Array.from({ length: 6 }, (_, collectedCount) => getSnakeMoveInterval(500, collectedCount));

    expect(intervals.every((interval, index) => index === 0 || interval < intervals[index - 1])).toBe(true);
    expect(intervals).toEqual([500, 450, 405, 365, 328, 295]);
    expect(getSnakeMoveInterval(600, 1)).toBe(540);
  });

  test("does not accelerate for invalid collection counts", () => {
    expect(getSnakeMoveInterval(500, -3)).toBe(500);
    expect(getSnakeMoveInterval(500, Number.NaN)).toBe(500);
  });
});

const CORNER_CASES: Array<{
  name: string;
  from: SnakeCell[];
  to: SnakeCell[];
  expectedHalfwayTrack: SnakePoint[];
}> = [
  {
    name: "left-up",
    from: [{ x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    to: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    expectedHalfwayTrack: [{ x: 2, y: 0.5 }, { x: 2, y: 1 }, { x: 1.5, y: 1 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }]
  },
  {
    name: "down-left",
    from: [{ x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    to: [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    expectedHalfwayTrack: [{ x: 2, y: 1.5 }, { x: 2, y: 1 }, { x: 1.5, y: 1 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }]
  },
  {
    name: "right-down",
    from: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    to: [{ x: 3, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }],
    expectedHalfwayTrack: [{ x: 2.5, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0.5 }, { x: 2, y: 1 }, { x: 1.5, y: 1 }]
  },
  {
    name: "up-right",
    from: [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    to: [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }],
    expectedHalfwayTrack: [{ x: 2.5, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1.5 }, { x: 2, y: 1 }, { x: 1.5, y: 1 }]
  }
];

const EXECUTION_CACHE_CASES: Array<[SnakeDirection, SnakeDirection, SnakeDirection]> = [
  ["right", "up", "up"],
  ["right", "down", "down"],
  ["up", "right", "right"],
  ["down", "right", "right"],
  ["right", "left", "right"],
  ["up", "down", "up"]
];

describe("Word Snake frame motion", () => {
  test.each(CORNER_CASES)("keeps the $name corner connected and orthogonal on the halfway frame", ({ from, to, expectedHalfwayTrack }) => {
    const track = buildSnakeMotionTrack(from, to, 0.5);

    expect(track).toEqual(expectedHalfwayTrack);
    expect(track.every((point, index) => index === 0 || point.x === track[index - 1].x || point.y === track[index - 1].y)).toBe(true);
    expect(buildSnakeMotionTrack(from, to, 0)).toEqual(from);
    expect(buildSnakeMotionTrack(from, to, 1)).toEqual(to);
  });

  test("formats cell-centered SVG coordinates", () => {
    expect(formatSnakeTrackPoints([{ x: 2, y: 0.5 }, { x: 2, y: 1 }])).toBe("2.5,1 2.5,1.5");
  });

  test("places collected symbols in phrase order behind the head", () => {
    const segments = interpolateSnakeSegments(
      [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
      0.5
    );

    expect(placeSnakeSymbols(
      ["A", " ", "B"],
      [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
      0.5
    )).toEqual([
      { symbol: "A", point: { x: 2.32, y: 1 } },
      { symbol: "·", point: { x: 1.32, y: 1 } },
      { symbol: "B", point: { x: 0.32, y: 1 } }
    ]);
  });
});

describe("Word Snake execution cache", () => {
  test.each(EXECUTION_CACHE_CASES)("resolves current %s with cached %s to %s only at a cell boundary", (current, cached, expected) => {
    expect(resolveSnakeExecutionDirection(current, cached)).toBe(expected);
  });
});
