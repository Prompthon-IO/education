import { describe, expect, test } from "vitest";
import {
  GESTURE_CONSENSUS_THRESHOLD,
  GESTURE_SAMPLE_INTERVAL_MS,
  GESTURE_SAMPLE_WINDOW_SIZE,
  resolveGestureConsensus
} from "./gesture";

describe("Word Snake gesture consensus", () => {
  test("uses five 30ms samples and requires all five readings to match", () => {
    expect(GESTURE_SAMPLE_INTERVAL_MS).toBe(30);
    expect(GESTURE_SAMPLE_WINDOW_SIZE).toBe(5);
    expect(GESTURE_CONSENSUS_THRESHOLD).toBe(5);
    expect(GESTURE_SAMPLE_INTERVAL_MS * GESTURE_SAMPLE_WINDOW_SIZE).toBe(150);
  });

  test("accepts a five-of-five directional match", () => {
    expect(resolveGestureConsensus(["right", "right", "right", "right", "right"])).toBe("right");
  });

  test("rejects inconsistent or incomplete windows", () => {
    expect(resolveGestureConsensus(["up", "up", "up", "left", "left"])).toBeNull();
    expect(resolveGestureConsensus(["down", "down", "down", "down"])).toBeNull();
    expect(resolveGestureConsensus(["none", "none", "none", "none", "right"])).toBeNull();
    expect(resolveGestureConsensus(["right", "right", "none", "right", "right"])).toBeNull();
  });

  test("uses only the latest five samples in the sliding window", () => {
    expect(resolveGestureConsensus(["left", "left", "left", "left", "left", "up", "up", "up", "up", "up"])).toBe("up");
  });

  test("recognizes a stable fist as hold without inventing a direction", () => {
    expect(resolveGestureConsensus(["fist", "fist", "fist", "fist", "fist"])).toBe("fist");
  });
});
