export type HandGesture = "up" | "right" | "down" | "left" | "fist" | "none";

export const GESTURE_SAMPLE_INTERVAL_MS = 30;
export const GESTURE_SAMPLE_WINDOW_SIZE = 5;
export const GESTURE_CONSENSUS_THRESHOLD = GESTURE_SAMPLE_WINDOW_SIZE;

export function resolveGestureConsensus(samples: readonly HandGesture[]): HandGesture | null {
  const window = samples.slice(-GESTURE_SAMPLE_WINDOW_SIZE);
  if (window.length < GESTURE_SAMPLE_WINDOW_SIZE) {
    return null;
  }

  const counts = new Map<HandGesture, number>();
  for (const gesture of window) {
    if (gesture !== "none") {
      counts.set(gesture, (counts.get(gesture) ?? 0) + 1);
    }
  }

  let consensus: HandGesture | null = null;
  let consensusCount = 0;
  for (const [gesture, count] of counts) {
    if (count > consensusCount) {
      consensus = gesture;
      consensusCount = count;
    }
  }

  return consensusCount >= GESTURE_CONSENSUS_THRESHOLD ? consensus : null;
}
