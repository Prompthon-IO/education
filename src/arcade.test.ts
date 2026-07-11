import { describe, expect, test } from "vitest";
import {
  type VoiceFlappyRound,
  AVATAR_EXPRESSIONS,
  classifyFaceExpression,
  coinCatchItemHitsAvatar,
  createVoiceFlappyRound,
  buildWordSnakeLeaderboardEntry,
  createLeaderboardStore,
  createMemoryMatchDeck,
  getAvatarVisualMatchKey,
  getMemoryTensionLevel,
  getAvatarFrame,
  getVoiceFlappyRecommendedLevel,
  judgeRhythmHit,
  nextSimonSequence,
  rankFaceExpressions,
  resolveCoinCatchItem,
  scoreWhackHit,
  stepCoinCatchMotion,
  stepPongRound,
  stepVoiceFlappyRound
} from "./arcade";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    }
  };
}

describe("avatar expressions", () => {
  test("defines the ten shared expression keys", () => {
    expect(AVATAR_EXPRESSIONS).toEqual([
      "neutral",
      "happy",
      "excited",
      "sad",
      "dizzy",
      "angry",
      "surprised",
      "sleepy",
      "scared",
      "playful"
    ]);
  });

  test("uses manifest coordinates when an expression frame exists", () => {
    const frame = getAvatarFrame(
      {
        imageWidth: 1000,
        imageHeight: 500,
        frames: {
          angry: { x: 100, y: 50, width: 80, height: 90 }
        }
      },
      "angry"
    );

    expect(frame).toEqual({
      expression: "angry",
      sourceExpression: "angry",
      x: 100,
      y: 50,
      width: 80,
      height: 90,
      imageWidth: 1000,
      imageHeight: 500
    });
  });

  test("falls back from new expressions to compatible legacy sheet emotions", () => {
    const frame = getAvatarFrame(
      {
        imageWidth: 1536,
        imageHeight: 2048,
        frames: {
          happy: { x: 0, y: 0, width: 512, height: 512 },
          sad: { x: 0, y: 512, width: 512, height: 512 }
        }
      },
      "surprised"
    );

    expect(frame?.expression).toBe("surprised");
    expect(frame?.sourceExpression).toBe("happy");
    expect(frame?.height).toBe(512);
  });
});

describe("leaderboard store", () => {
  test("keeps daily entries separate from all-time entries and sorts by score then secondary score", () => {
    const storage = createMemoryStorage();
    const store = createLeaderboardStore(storage, "arcade-test", () => new Date("2026-07-09T15:00:00Z"));

    store.addEntry({ gameId: "avatar_pong", playerName: "A", avatarId: "avatar", score: 4, secondaryScore: 30, durationMs: 3000 });
    store.addEntry({ gameId: "avatar_pong", playerName: "B", avatarId: "avatar", score: 5, secondaryScore: 10, durationMs: 2500 });
    store.addEntry({ gameId: "avatar_pong", playerName: "C", avatarId: "avatar", score: 5, secondaryScore: 40, durationMs: 2200 });
    store.addEntry({ gameId: "memory_match", playerName: "D", avatarId: "avatar", score: 8, secondaryScore: 10, durationMs: 1000 });

    expect(store.getDailyLeaderboard("avatar_pong").map((entry) => entry.playerName)).toEqual(["C", "B", "A"]);
    expect(store.getAllTimeLeaderboard("avatar_pong")).toHaveLength(3);
  });

  test("recovers from corrupt localStorage content", () => {
    const storage = createMemoryStorage();
    storage.setItem("arcade-test", "{not-json");

    const store = createLeaderboardStore(storage, "arcade-test", () => new Date("2026-07-09T15:00:00Z"));
    expect(store.getAllTimeLeaderboard("voice_flappy")).toEqual([]);

    store.addEntry({ gameId: "voice_flappy", playerName: "A", avatarId: "avatar", score: 2, durationMs: 1000 });
    expect(store.getAllTimeLeaderboard("voice_flappy")).toHaveLength(1);
  });
});

describe("pure game helpers", () => {
  test("creates a deterministic 16-card memory deck with eight expression pairs", () => {
    const deck = createMemoryMatchDeck(["happy", "sad", "dizzy", "playful", "sleepy", "angry", "neutral", "surprised"], 0);

    expect(deck).toHaveLength(16);
    expect(deck.filter((card) => card.expression === "happy")).toHaveLength(2);
  });

  test("treats expression fallbacks that render the same avatar frame as valid pairs", () => {
    const manifest = {
      frames: {
        happy: { x: 10, y: 20, width: 100, height: 100 },
        dizzy: { x: 120, y: 20, width: 100, height: 100 },
        sad: { x: 230, y: 20, width: 100, height: 100 }
      }
    };

    expect(getAvatarVisualMatchKey(manifest, "surprised")).toBe(getAvatarVisualMatchKey(manifest, "happy"));
    expect(getAvatarVisualMatchKey(manifest, "angry")).toBe(getAvatarVisualMatchKey(manifest, "dizzy"));
    expect(getAvatarVisualMatchKey(manifest, "happy")).not.toBe(getAvatarVisualMatchKey(manifest, "dizzy"));
  });

  test("advances Memory Match tension at the 60, 30, 15, and 5 second thresholds", () => {
    expect(getMemoryTensionLevel(120, true)).toBe("calm");
    expect(getMemoryTensionLevel(60, true)).toBe("mild");
    expect(getMemoryTensionLevel(30, true)).toBe("urgent");
    expect(getMemoryTensionLevel(15, true)).toBe("critical");
    expect(getMemoryTensionLevel(5, true)).toBe("final");
    expect(getMemoryTensionLevel(5, false)).toBe("calm");
  });

  test("scores whack hits only when the visible expression is the target expression", () => {
    expect(scoreWhackHit({ visibleExpression: "happy", targetExpression: "happy", currentScore: 3 })).toEqual({
      score: 4,
      expression: "excited",
      correct: true
    });
    expect(scoreWhackHit({ visibleExpression: "sad", targetExpression: "happy", currentScore: 3 })).toEqual({
      score: 2,
      expression: "angry",
      correct: false
    });
  });

  test("judges rhythm hits by expression and hit-window timing", () => {
    expect(judgeRhythmHit({ expected: "sleepy", actual: "sleepy", distanceMs: 80 })).toEqual({
      correct: true,
      points: 1,
      accuracy: 0.84
    });
    expect(judgeRhythmHit({ expected: "sleepy", actual: "happy", distanceMs: 40 }).correct).toBe(false);
    expect(judgeRhythmHit({ expected: "sleepy", actual: "sleepy", distanceMs: 220 }).correct).toBe(false);
  });

  test("maps MediaPipe blendshapes to Face Rhythm expressions", () => {
    expect(classifyFaceExpression([
      { categoryName: "mouthSmileLeft", score: 0.82 },
      { categoryName: "mouthSmileRight", score: 0.78 },
      { categoryName: "jawOpen", score: 0.55 }
    ]).expression).toBe("excited");
    expect(classifyFaceExpression([
      { categoryName: "jawOpen", score: 0.8 },
      { categoryName: "mouthLowerDownLeft", score: 0.62 },
      { categoryName: "mouthLowerDownRight", score: 0.6 },
      { categoryName: "mouthSmileLeft", score: 0.04 },
      { categoryName: "mouthSmileRight", score: 0.03 }
    ]).expression).toBe("playful");
    expect(classifyFaceExpression([
      { categoryName: "eyeBlinkLeft", score: 0.86 },
      { categoryName: "eyeBlinkRight", score: 0.84 }
    ]).expression).toBe("sleepy");
    expect(classifyFaceExpression([{ categoryName: "_neutral", score: 0.91 }])).toEqual({
      expression: "happy",
      confidence: 1
    });
  });

  test("ranks every Face Rhythm expression from strongest match to weakest", () => {
    const ranking = rankFaceExpressions([
      { categoryName: "mouthSmileLeft", score: 0.82 },
      { categoryName: "mouthSmileRight", score: 0.78 },
      { categoryName: "jawOpen", score: 0.18 },
      { categoryName: "eyeBlinkLeft", score: 0.08 },
      { categoryName: "eyeBlinkRight", score: 0.1 },
      { categoryName: "_neutral", score: 0.05 }
    ]);

    expect(ranking).toHaveLength(4);
    expect(ranking[0].expression).toBe("excited");
    expect(ranking.map((match) => match.expression).sort()).toEqual(["excited", "happy", "playful", "sleepy"]);
    expect(ranking.every((match, index) => index === 0 || ranking[index - 1].confidence >= match.confidence)).toBe(true);
  });

  test("uses four visually distinct manifest frames for Face Rhythm", () => {
    const manifest = {
      frames: {
        happy: { x: 0, y: 0, width: 100, height: 100 },
        excited: { x: 100, y: 0, width: 100, height: 100 },
        playful: { x: 200, y: 0, width: 100, height: 100 },
        sleepy: { x: 300, y: 0, width: 100, height: 100 }
      }
    };
    const keys = ["happy", "playful", "sleepy", "excited"].map((expression) => (
      getAvatarVisualMatchKey(manifest, expression as "happy" | "playful" | "sleepy" | "excited")
    ));

    expect(new Set(keys).size).toBe(4);
  });

  test("advances pong score on paddle returns and fails when the avatar ball passes the paddle", () => {
    const returned = stepPongRound({
      ball: { x: 12, y: 50, vx: -4, vy: 0 },
      paddleY: 50,
      boardWidth: 320,
      boardHeight: 180,
      score: 2,
      deltaSeconds: 1
    });
    expect(returned.score).toBe(3);
    expect(returned.status).toBe("running");
    expect(returned.ball.vx).toBeGreaterThan(0);

    const missed = stepPongRound({
      ball: { x: 2, y: 10, vx: -8, vy: 0 },
      paddleY: 160,
      boardWidth: 320,
      boardHeight: 180,
      score: 2,
      deltaSeconds: 1
    });
    expect(missed.status).toBe("lost");
  });

  test("accelerates Coin Catch movement and scales top speed with running intensity", () => {
    let slow = { x: 0.5, velocity: 0 };
    let fast = { x: 0.5, velocity: 0 };
    for (let index = 0; index < 6; index += 1) {
      slow = stepCoinCatchMotion({ motion: slow, direction: 1, runIntensity: 0.1, deltaSeconds: 0.05 });
      fast = stepCoinCatchMotion({ motion: fast, direction: 1, runIntensity: 1, deltaSeconds: 0.05 });
    }

    expect(fast.velocity).toBeGreaterThan(slow.velocity);
    expect(fast.x).toBeGreaterThan(slow.x);
    expect(stepCoinCatchMotion({ motion: { x: 0.92, velocity: 0.8 }, direction: 1, runIntensity: 1, deltaSeconds: 0.05 })).toEqual({
      x: 0.92,
      velocity: 0
    });
  });

  test("detects falling-item collisions only inside the avatar catch zone", () => {
    expect(coinCatchItemHitsAvatar({ x: 0.5, y: 0.78, size: 0.08 }, 0.5)).toBe(true);
    expect(coinCatchItemHitsAvatar({ x: 0.8, y: 0.78, size: 0.08 }, 0.5)).toBe(false);
    expect(coinCatchItemHitsAvatar({ x: 0.5, y: 0.4, size: 0.08 }, 0.5)).toBe(false);
  });

  test("awards coin values and ends Coin Catch immediately on a bomb", () => {
    expect(resolveCoinCatchItem("coin", 5)).toEqual({ gameOver: false, points: 5 });
    expect(resolveCoinCatchItem("bomb", 5)).toEqual({ gameOver: true, points: 0 });
  });

  test("extends Simon sequences with a deterministic expression", () => {
    expect(nextSimonSequence(["happy"], 3)).toEqual(["happy", "excited"]);
  });

  test("builds a Word Snake leaderboard entry with progress secondary score", () => {
    expect(buildWordSnakeLeaderboardEntry({
      playerName: "Maya",
      score: 250,
      progress: 5,
      phraseLength: 8,
      durationMs: 4200,
      won: false
    })).toMatchObject({
      gameId: "word-snake",
      playerName: "Maya",
      score: 250,
      secondaryScore: 62.5,
      durationMs: 4200
    });
  });
});

describe("Voice Flappy physics", () => {
  const world = { width: 640, height: 520 };

  test("gravity moves the avatar down when there is no voice input", () => {
    let round: VoiceFlappyRound = { ...createVoiceFlappyRound(world), status: "running" };
    const startingY = round.birdY;
    const startingPipeX = round.pipes[0].x;

    for (let frame = 0; frame < 36; frame += 1) {
      round = stepVoiceFlappyRound(round, { deltaSeconds: 1 / 60, voiceLevel: 0, world });
    }

    expect(round.status).toBe("running");
    expect(round.birdY).toBeGreaterThan(startingY);
    expect(round.velocity).toBeGreaterThan(0);
    expect(round.pipes[0].x).toBeLessThan(startingPipeX);
  });

  test("a loud simulated voice applies enough lift to move upward", () => {
    let round: VoiceFlappyRound = { ...createVoiceFlappyRound(world), status: "running" };
    const startingY = round.birdY;

    for (let frame = 0; frame < 36; frame += 1) {
      round = stepVoiceFlappyRound(round, { deltaSeconds: 1 / 60, voiceLevel: 0.72, world });
    }

    expect(round.status).toBe("running");
    expect(round.birdY).toBeLessThan(startingY);
    expect(round.velocity).toBeLessThan(0);
  });

  test("the deterministic voice autopilot clears several scrolling pipes", () => {
    let round: VoiceFlappyRound = { ...createVoiceFlappyRound(world), status: "running" };

    for (let frame = 0; frame < 60 * 60 && round.status === "running"; frame += 1) {
      const voiceLevel = getVoiceFlappyRecommendedLevel(round, world);
      round = stepVoiceFlappyRound(round, { deltaSeconds: 1 / 60, voiceLevel, world });
    }

    expect(round.score, JSON.stringify({ status: round.status, birdY: round.birdY, velocity: round.velocity, pipes: round.pipes })).toBeGreaterThanOrEqual(20);
  });
});
