import { describe, expect, test } from "vitest";
import {
  GESTURE_CONSENSUS_THRESHOLD,
  GESTURE_SAMPLE_INTERVAL_MS,
  GESTURE_SAMPLE_WINDOW_SIZE,
  resolveGestureConsensus
} from "./gesture";

describe("Word Snake gesture consensus", () => {
  test("uses five 100ms samples and requires four matching readings", () => {
    expect(GESTURE_SAMPLE_INTERVAL_MS).toBe(100);
    expect(GESTURE_SAMPLE_WINDOW_SIZE).toBe(5);
    expect(GESTURE_CONSENSUS_THRESHOLD).toBe(4);
    expect(GESTURE_SAMPLE_INTERVAL_MS * GESTURE_SAMPLE_WINDOW_SIZE).toBe(500);
  });

  test("accepts a four-of-five directional majority", () => {
    expect(resolveGestureConsensus(["right", "right", "none", "right", "right"])).toBe("right");
  });

  test("rejects inconsistent or incomplete windows", () => {
    expect(resolveGestureConsensus(["up", "up", "up", "left", "left"])).toBeNull();
    expect(resolveGestureConsensus(["down", "down", "down", "down"])).toBeNull();
    expect(resolveGestureConsensus(["none", "none", "none", "none", "right"])).toBeNull();
  });

  test("uses only the latest five samples in the sliding window", () => {
    expect(resolveGestureConsensus(["left", "left", "left", "left", "left", "up", "up", "right", "up", "up"])).toBe("up");
  });

  test("recognizes a stable fist as hold without inventing a direction", () => {
    expect(resolveGestureConsensus(["fist", "fist", "none", "fist", "fist"])).toBe("fist");
  });
});
