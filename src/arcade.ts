export const AVATAR_EXPRESSIONS = [
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
] as const;

export type AvatarExpression = (typeof AVATAR_EXPRESSIONS)[number];
export type FaceRhythmExpression = Extract<AvatarExpression, "happy" | "playful" | "sleepy" | "excited">;
export const FACE_RHYTHM_EXPRESSIONS: readonly FaceRhythmExpression[] = ["happy", "playful", "sleepy", "excited"];
export type FaceBlendshapeScore = {
  categoryName: string;
  score: number;
};
export type FaceExpressionScore = {
  expression: FaceRhythmExpression;
  confidence: number;
};
export type MemoryTensionLevel = "calm" | "mild" | "urgent" | "critical" | "final";

export type AvatarFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AvatarManifest = {
  imageWidth?: number;
  imageHeight?: number;
  frames?: Partial<Record<AvatarExpression | string, AvatarFrame>>;
};

export type ResolvedAvatarFrame = AvatarFrame & {
  expression: AvatarExpression;
  sourceExpression: AvatarExpression | string;
  imageWidth?: number;
  imageHeight?: number;
};

export type LeaderboardEntry = {
  id: string;
  gameId: string;
  playerName: string;
  avatarId: string;
  score: number;
  secondaryScore?: number;
  durationMs: number;
  accuracy?: number;
  createdAt: string;
};

export type NewLeaderboardEntry = Omit<LeaderboardEntry, "id" | "createdAt">;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type MemoryCard = {
  id: string;
  expression: AvatarExpression;
};

export type WhackScoreInput = {
  visibleExpression: AvatarExpression;
  targetExpression: AvatarExpression;
  currentScore: number;
};

export type RhythmHitInput = {
  expected: AvatarExpression;
  actual: AvatarExpression;
  distanceMs: number;
};

export type PongBall = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type PongRoundInput = {
  ball: PongBall;
  paddleY: number;
  boardWidth: number;
  boardHeight: number;
  score: number;
  deltaSeconds: number;
};

export type CoinCatchMotion = {
  x: number;
  velocity: number;
};

export type CoinCatchMotionInput = {
  motion: CoinCatchMotion;
  direction: number;
  runIntensity: number;
  deltaSeconds: number;
};

export type CoinCatchItemBounds = {
  x: number;
  y: number;
  size: number;
};

export type VoiceFlappyStatus = "ready" | "running" | "paused" | "ended";

export type VoiceFlappyWorld = {
  width: number;
  height: number;
};

export type VoiceFlappyPipe = {
  id: string;
  index: number;
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
};

export type VoiceFlappyRound = {
  birdY: number;
  velocity: number;
  pipes: VoiceFlappyPipe[];
  score: number;
  distance: number;
  status: VoiceFlappyStatus;
};

export type VoiceFlappyStepInput = {
  deltaSeconds: number;
  voiceLevel: number;
  flap?: boolean;
  world: VoiceFlappyWorld;
};

const AVATAR_FALLBACKS: Record<AvatarExpression, AvatarExpression[]> = {
  neutral: ["neutral", "happy", "sleepy"],
  happy: ["happy", "neutral"],
  excited: ["excited", "happy", "playful"],
  sad: ["sad", "sleepy"],
  dizzy: ["dizzy", "sad"],
  angry: ["angry", "dizzy", "sad"],
  surprised: ["surprised", "happy", "excited"],
  sleepy: ["sleepy", "sad"],
  scared: ["scared", "sad", "dizzy"],
  playful: ["playful", "happy"]
};

const PONG_BALL_RADIUS = 14;
const PONG_PADDLE_X = 18;
const PONG_PADDLE_HEIGHT = 54;
const RHYTHM_HIT_WINDOW_MS = 160;
const RHYTHM_ACCURACY_WINDOW_MS = 500;
export const VOICE_FLAPPY_BIRD_X = 112;
export const VOICE_FLAPPY_BIRD_SIZE = 56;
export const VOICE_FLAPPY_PIPE_WIDTH = 70;
export const VOICE_FLAPPY_GROUND_HEIGHT = 28;
const VOICE_FLAPPY_PIPE_SPEED = 132;
const VOICE_FLAPPY_GRAVITY = 240;
const VOICE_FLAPPY_LIFT_ACCELERATION = 650;
const VOICE_FLAPPY_FLAP_VELOCITY = -190;
const VOICE_FLAPPY_MAX_RISE_SPEED = -220;
const VOICE_FLAPPY_MAX_FALL_SPEED = 230;
const VOICE_FLAPPY_VOICE_DEAD_ZONE = 0.05;
const VOICE_FLAPPY_COLLISION_INSET_X = 13;
const VOICE_FLAPPY_COLLISION_INSET_Y = 14;
const VOICE_FLAPPY_LANES = [0.5, 0.64, 0.4, 0.57, 0.34, 0.68, 0.44, 0.6];

export function getAvatarFrame(manifest: AvatarManifest | null | undefined, expression: AvatarExpression): ResolvedAvatarFrame | null {
  const frames = manifest?.frames;
  if (!frames) {
    return null;
  }

  for (const candidate of AVATAR_FALLBACKS[expression]) {
    const frame = frames[candidate];
    if (frame) {
      return {
        expression,
        sourceExpression: candidate,
        ...frame,
        imageWidth: manifest.imageWidth,
        imageHeight: manifest.imageHeight
      };
    }
  }

  const firstFrameName = Object.keys(frames)[0];
  const firstFrame = firstFrameName ? frames[firstFrameName] : undefined;
  return firstFrame
    ? {
        expression,
        sourceExpression: firstFrameName,
        ...firstFrame,
        imageWidth: manifest.imageWidth,
        imageHeight: manifest.imageHeight
      }
    : null;
}

export function getAvatarVisualMatchKey(manifest: AvatarManifest | null | undefined, expression: AvatarExpression) {
  const frame = getAvatarFrame(manifest, expression);
  return frame ? `${frame.x}:${frame.y}:${frame.width}:${frame.height}` : expression;
}

export function getMemoryTensionLevel(remaining: number, isRunning: boolean): MemoryTensionLevel {
  if (!isRunning || remaining > 60) {
    return "calm";
  }
  if (remaining <= 5) {
    return "final";
  }
  if (remaining <= 15) {
    return "critical";
  }
  if (remaining <= 30) {
    return "urgent";
  }
  return "mild";
}

export function createLeaderboardStore(storage: StorageLike, storageKey: string, now: () => Date = () => new Date()) {
  function readEntries(): LeaderboardEntry[] {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isLeaderboardEntry);
    } catch {
      storage.removeItem?.(storageKey);
      return [];
    }
  }

  function writeEntries(entries: LeaderboardEntry[]) {
    storage.setItem(storageKey, JSON.stringify(entries.slice(-500)));
  }

  function sortEntries(entries: LeaderboardEntry[]) {
    return [...entries].sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const secondaryDelta = (b.secondaryScore ?? 0) - (a.secondaryScore ?? 0);
      if (secondaryDelta !== 0) {
        return secondaryDelta;
      }
      return a.durationMs - b.durationMs;
    });
  }

  return {
    addEntry(entry: NewLeaderboardEntry) {
      const createdAt = now().toISOString();
      const nextEntry: LeaderboardEntry = {
        ...entry,
        id: `${entry.gameId}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt
      };
      const entries = [...readEntries(), nextEntry];
      writeEntries(entries);
      return nextEntry;
    },
    getDailyLeaderboard(gameId: string) {
      const dayKey = now().toISOString().slice(0, 10);
      return sortEntries(readEntries().filter((entry) => entry.gameId === gameId && entry.createdAt.slice(0, 10) === dayKey));
    },
    getAllTimeLeaderboard(gameId: string) {
      return sortEntries(readEntries().filter((entry) => entry.gameId === gameId));
    }
  };
}

export function createMemoryMatchDeck(expressions: AvatarExpression[], seed = Date.now()): MemoryCard[] {
  const pairs = expressions.slice(0, 8).flatMap((expression, index) => [
    { id: `${expression}-a-${index}`, expression },
    { id: `${expression}-b-${index}`, expression }
  ]);
  return seededShuffle(pairs, seed);
}

export function scoreWhackHit(input: WhackScoreInput) {
  const correct = input.visibleExpression === input.targetExpression;
  return {
    score: Math.max(0, input.currentScore + (correct ? 1 : -1)),
    expression: correct ? ("excited" as const) : ("angry" as const),
    correct
  };
}

export function judgeRhythmHit(input: RhythmHitInput) {
  const timingAccuracy = Math.max(0, 1 - input.distanceMs / RHYTHM_ACCURACY_WINDOW_MS);
  const correct = input.expected === input.actual && input.distanceMs <= RHYTHM_HIT_WINDOW_MS;
  return {
    correct,
    points: correct ? 1 : 0,
    accuracy: Number(timingAccuracy.toFixed(2))
  };
}

export function rankFaceExpressions(blendshapes: readonly FaceBlendshapeScore[]): FaceExpressionScore[] {
  const scores = new Map(blendshapes.map((blendshape) => [blendshape.categoryName, blendshape.score]));
  const score = (name: string) => scores.get(name) ?? 0;
  const average = (...values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
  const smile = average(score("mouthSmileLeft"), score("mouthSmileRight"));
  const jawOpen = score("jawOpen");
  const lowerMouth = average(score("mouthLowerDownLeft"), score("mouthLowerDownRight"));
  const mouthShape = Math.max(
    score("mouthPucker"),
    average(score("mouthStretchLeft"), score("mouthStretchRight"))
  );

  const candidates: Array<{ expression: Exclude<FaceRhythmExpression, "happy">; score: number; threshold: number }> = [
    {
      expression: "excited",
      score: smile * 0.65 + jawOpen * 0.35,
      threshold: 0.34
    },
    {
      expression: "playful",
      score: Math.max(0, jawOpen * 0.6 + lowerMouth * 0.2 + mouthShape * 0.2 - smile * 0.5),
      threshold: 0.3
    },
    {
      expression: "sleepy",
      score: Math.min(score("eyeBlinkLeft"), score("eyeBlinkRight")),
      threshold: 0.52
    }
  ];
  const rankedCandidates = candidates.map((candidate) => {
    const thresholdRatio = candidate.score / candidate.threshold;
    const confidence = thresholdRatio >= 1
      ? 0.5 + 0.5 * (1 - Math.exp(-(thresholdRatio - 1)))
      : thresholdRatio * 0.49;
    return {
      expression: candidate.expression,
      confidence: Number(Math.min(1, confidence).toFixed(2)),
      thresholdRatio
    };
  });
  const strongestRatio = Math.max(...rankedCandidates.map((candidate) => candidate.thresholdRatio));
  const neutralConfidence = strongestRatio >= 1
    ? Math.min(0.49, score("_neutral"))
    : Math.max(score("_neutral"), 0.5 + (1 - strongestRatio) * 0.5);

  return [
    ...rankedCandidates.map(({ expression, confidence }) => ({ expression, confidence })),
    { expression: "happy" as const, confidence: Number(Math.min(1, neutralConfidence).toFixed(2)) }
  ].sort((left, right) => right.confidence - left.confidence);
}

export function classifyFaceExpression(blendshapes: readonly FaceBlendshapeScore[]): FaceExpressionScore {
  return rankFaceExpressions(blendshapes)[0];
}

export function stepPongRound(input: PongRoundInput) {
  const nextBall: PongBall = {
    x: input.ball.x + input.ball.vx * input.deltaSeconds,
    y: input.ball.y + input.ball.vy * input.deltaSeconds,
    vx: input.ball.vx,
    vy: input.ball.vy
  };
  let score = input.score;
  let status: "running" | "lost" = "running";

  if (nextBall.y - PONG_BALL_RADIUS < 0 || nextBall.y + PONG_BALL_RADIUS > input.boardHeight) {
    nextBall.vy *= -1;
    nextBall.y = Math.min(input.boardHeight - PONG_BALL_RADIUS, Math.max(PONG_BALL_RADIUS, nextBall.y));
  }

  if (nextBall.x + PONG_BALL_RADIUS > input.boardWidth) {
    nextBall.vx = -Math.abs(nextBall.vx);
    nextBall.x = input.boardWidth - PONG_BALL_RADIUS;
  }

  const paddleTop = input.paddleY - PONG_PADDLE_HEIGHT / 2;
  const paddleBottom = input.paddleY + PONG_PADDLE_HEIGHT / 2;
  const crossesPaddle = input.ball.vx < 0 && nextBall.x - PONG_BALL_RADIUS <= PONG_PADDLE_X;
  const hitsPaddle = crossesPaddle && nextBall.y >= paddleTop && nextBall.y <= paddleBottom;
  if (hitsPaddle) {
    nextBall.vx = Math.abs(nextBall.vx) + 0.35;
    nextBall.vy += (nextBall.y - input.paddleY) * 0.035;
    nextBall.x = PONG_PADDLE_X + PONG_BALL_RADIUS;
    score += 1;
  } else if (nextBall.x + PONG_BALL_RADIUS < 0 || (crossesPaddle && nextBall.x < PONG_PADDLE_X && !hitsPaddle)) {
    status = "lost";
  }

  return {
    ball: nextBall,
    score,
    status
  };
}

export function stepCoinCatchMotion(input: CoinCatchMotionInput): CoinCatchMotion {
  const deltaSeconds = clampValue(input.deltaSeconds, 0, 0.05);
  const direction = clampValue(input.direction, -1, 1);
  const runIntensity = clampValue(input.runIntensity, 0, 1);
  const maximumSpeed = 0.32 + runIntensity * 0.58;
  const targetVelocity = direction * maximumSpeed;
  const acceleration = direction === 0 ? 2.8 : 1.5 + runIntensity * 3.2;
  const velocityDelta = clampValue(
    targetVelocity - input.motion.velocity,
    -acceleration * deltaSeconds,
    acceleration * deltaSeconds
  );
  let velocity = input.motion.velocity + velocityDelta;
  let x = clampValue(input.motion.x + velocity * deltaSeconds, 0.08, 0.92);

  if ((x === 0.08 && velocity < 0) || (x === 0.92 && velocity > 0)) {
    velocity = 0;
  }
  if (Math.abs(velocity) < 0.001) {
    velocity = 0;
  }
  x = Number(x.toFixed(4));
  velocity = Number(velocity.toFixed(4));
  return { x, velocity };
}

export function coinCatchItemHitsAvatar(item: CoinCatchItemBounds, avatarX: number) {
  const halfItem = item.size / 2;
  const avatarHalfWidth = 0.075;
  const itemLeft = item.x - halfItem;
  const itemRight = item.x + halfItem;
  const itemTop = item.y - halfItem;
  const itemBottom = item.y + halfItem;
  return itemRight >= avatarX - avatarHalfWidth
    && itemLeft <= avatarX + avatarHalfWidth
    && itemBottom >= 0.72
    && itemTop <= 0.97;
}

export function resolveCoinCatchItem(kind: "coin" | "bomb", value: number) {
  return kind === "bomb"
    ? { gameOver: true, points: 0 }
    : { gameOver: false, points: Math.max(0, Math.round(value)) };
}

export function createVoiceFlappyRound(world: VoiceFlappyWorld): VoiceFlappyRound {
  const safeWorld = normalizeVoiceFlappyWorld(world);
  const playableHeight = getVoiceFlappyPlayableHeight(safeWorld.height);
  const birdY = clampValue(playableHeight * 0.42 - VOICE_FLAPPY_BIRD_SIZE / 2, 24, playableHeight - VOICE_FLAPPY_BIRD_SIZE - 24);

  return {
    birdY,
    velocity: 0,
    pipes: createInitialVoiceFlappyPipes(safeWorld),
    score: 0,
    distance: 0,
    status: "ready"
  };
}

export function stepVoiceFlappyRound(round: VoiceFlappyRound, input: VoiceFlappyStepInput): VoiceFlappyRound {
  if (round.status !== "running") {
    return round;
  }

  const world = normalizeVoiceFlappyWorld(input.world);
  const deltaSeconds = clampValue(input.deltaSeconds, 0, 0.05);
  const voiceLevel = getEffectiveVoiceLevel(input.voiceLevel);
  const acceleration = VOICE_FLAPPY_GRAVITY - voiceLevel * VOICE_FLAPPY_LIFT_ACCELERATION;
  const velocity = clampValue(
    (input.flap ? VOICE_FLAPPY_FLAP_VELOCITY : round.velocity) + acceleration * deltaSeconds,
    VOICE_FLAPPY_MAX_RISE_SPEED,
    VOICE_FLAPPY_MAX_FALL_SPEED
  );
  const birdY = round.birdY + velocity * deltaSeconds;
  const movedPipes = round.pipes.map((pipe) => ({
    ...pipe,
    x: pipe.x - VOICE_FLAPPY_PIPE_SPEED * deltaSeconds
  }));

  let score = round.score;
  const scoredPipes = movedPipes.map((pipe) => {
    if (!pipe.passed && pipe.x + VOICE_FLAPPY_PIPE_WIDTH < VOICE_FLAPPY_BIRD_X - VOICE_FLAPPY_BIRD_SIZE / 2) {
      score += 1;
      return { ...pipe, passed: true };
    }
    return pipe;
  });
  const pipes = recycleVoiceFlappyPipes(scoredPipes, score, world);
  const playableHeight = getVoiceFlappyPlayableHeight(world.height);
  const hitBoundary = birdY < -8 || birdY + VOICE_FLAPPY_BIRD_SIZE > playableHeight + 8;
  const hitPipe = pipes.some((pipe) => voiceFlappyBoxesOverlap(getVoiceFlappyBirdBox(birdY), getVoiceFlappyTopPipeBox(pipe))
    || voiceFlappyBoxesOverlap(getVoiceFlappyBirdBox(birdY), getVoiceFlappyBottomPipeBox(pipe, playableHeight)));

  return {
    birdY,
    velocity,
    pipes,
    score,
    distance: round.distance + VOICE_FLAPPY_PIPE_SPEED * deltaSeconds,
    status: hitBoundary || hitPipe ? "ended" : "running"
  };
}

export function getVoiceFlappyRecommendedLevel(round: VoiceFlappyRound, world: VoiceFlappyWorld) {
  const safeWorld = normalizeVoiceFlappyWorld(world);
  const playableHeight = getVoiceFlappyPlayableHeight(safeWorld.height);
  const nextPipe = round.pipes
    .filter((pipe) => pipe.x + VOICE_FLAPPY_PIPE_WIDTH >= VOICE_FLAPPY_BIRD_X - VOICE_FLAPPY_BIRD_SIZE / 2)
    .sort((left, right) => left.x - right.x)[0];
  const birdCenter = round.birdY + VOICE_FLAPPY_BIRD_SIZE / 2;
  const targetY = clampValue(nextPipe?.gapY ?? playableHeight * 0.5, VOICE_FLAPPY_BIRD_SIZE * 1.35, playableHeight - VOICE_FLAPPY_BIRD_SIZE * 1.35);
  const positionError = targetY - birdCenter;
  const desiredAcceleration = clampValue(positionError * 1.9 - round.velocity * 3.4, -250, 205);
  const effectiveLevel = clampValue((VOICE_FLAPPY_GRAVITY - desiredAcceleration) / VOICE_FLAPPY_LIFT_ACCELERATION, 0, 1);

  return clampValue(VOICE_FLAPPY_VOICE_DEAD_ZONE + effectiveLevel * (1 - VOICE_FLAPPY_VOICE_DEAD_ZONE), 0, 1);
}

export function getVoiceFlappyPlayableHeight(worldHeight: number) {
  return Math.max(220, worldHeight - VOICE_FLAPPY_GROUND_HEIGHT);
}

function createInitialVoiceFlappyPipes(world: VoiceFlappyWorld) {
  const firstX = Math.max(world.width - 24, VOICE_FLAPPY_BIRD_X + 260);
  const spacing = getVoiceFlappyPipeSpacing(0, world.width);
  return [
    createVoiceFlappyPipe(firstX, 0, 0, world.height),
    createVoiceFlappyPipe(firstX + spacing, 1, 0, world.height)
  ];
}

function createVoiceFlappyPipe(x: number, index: number, score: number, worldHeight: number): VoiceFlappyPipe {
  const playableHeight = getVoiceFlappyPlayableHeight(worldHeight);
  const gapHeight = getVoiceFlappyPipeGap(score, playableHeight);
  const halfGap = gapHeight / 2;
  const minGapY = halfGap + 24;
  const maxGapY = playableHeight - halfGap - 24;
  const laneRatio = VOICE_FLAPPY_LANES[index % VOICE_FLAPPY_LANES.length];

  return {
    id: `pipe-${index}`,
    index,
    x,
    gapY: minGapY + (maxGapY - minGapY) * laneRatio,
    gapHeight,
    passed: false
  };
}

function recycleVoiceFlappyPipes(pipes: VoiceFlappyPipe[], score: number, world: VoiceFlappyWorld) {
  let farthestX = Math.max(...pipes.map((pipe) => pipe.x));
  let nextIndex = Math.max(...pipes.map((pipe) => pipe.index)) + 1;
  return pipes.map((pipe) => {
    if (pipe.x >= -VOICE_FLAPPY_PIPE_WIDTH - 12) {
      return pipe;
    }
    farthestX += getVoiceFlappyPipeSpacing(score, world.width);
    const nextPipe = createVoiceFlappyPipe(farthestX, nextIndex, score, world.height);
    nextIndex += 1;
    return nextPipe;
  });
}

function getVoiceFlappyPipeGap(score: number, playableHeight: number) {
  const startGap = clampValue(playableHeight * 0.42, 190, 250);
  const minimumGap = clampValue(playableHeight * 0.27, 132, 170);
  return clampValue(startGap - score * 6, minimumGap, startGap);
}

function getVoiceFlappyPipeSpacing(score: number, worldWidth: number) {
  const startSpacing = clampValue(worldWidth * 0.58, 320, 400);
  const minimumSpacing = clampValue(worldWidth * 0.38, 225, 280);
  return clampValue(startSpacing - score * 8, minimumSpacing, startSpacing);
}

function getEffectiveVoiceLevel(level: number) {
  return clampValue((clampValue(level, 0, 1) - VOICE_FLAPPY_VOICE_DEAD_ZONE) / (1 - VOICE_FLAPPY_VOICE_DEAD_ZONE), 0, 1);
}

function getVoiceFlappyBirdBox(birdY: number) {
  return {
    left: VOICE_FLAPPY_BIRD_X - VOICE_FLAPPY_BIRD_SIZE / 2 + VOICE_FLAPPY_COLLISION_INSET_X,
    right: VOICE_FLAPPY_BIRD_X + VOICE_FLAPPY_BIRD_SIZE / 2 - VOICE_FLAPPY_COLLISION_INSET_X,
    top: birdY + VOICE_FLAPPY_COLLISION_INSET_Y,
    bottom: birdY + VOICE_FLAPPY_BIRD_SIZE - VOICE_FLAPPY_COLLISION_INSET_Y
  };
}

function getVoiceFlappyTopPipeBox(pipe: VoiceFlappyPipe) {
  return {
    left: pipe.x,
    right: pipe.x + VOICE_FLAPPY_PIPE_WIDTH,
    top: 0,
    bottom: pipe.gapY - pipe.gapHeight / 2
  };
}

function getVoiceFlappyBottomPipeBox(pipe: VoiceFlappyPipe, playableHeight: number) {
  return {
    left: pipe.x,
    right: pipe.x + VOICE_FLAPPY_PIPE_WIDTH,
    top: pipe.gapY + pipe.gapHeight / 2,
    bottom: playableHeight
  };
}

function voiceFlappyBoxesOverlap(
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number }
) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

function normalizeVoiceFlappyWorld(world: VoiceFlappyWorld) {
  return {
    width: Math.max(360, world.width),
    height: Math.max(320, world.height)
  };
}

function clampValue(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function nextSimonSequence(sequence: FaceRhythmExpression[], step: number) {
  const playable = FACE_RHYTHM_EXPRESSIONS;
  return [...sequence, playable[step % playable.length]];
}

export function buildWordSnakeLeaderboardEntry(input: {
  playerName: string;
  score: number;
  progress: number;
  phraseLength: number;
  durationMs: number;
  won: boolean;
}): NewLeaderboardEntry {
  const progressPercent = input.phraseLength > 0 ? (input.progress / input.phraseLength) * 100 : 0;
  return {
    gameId: "word-snake",
    playerName: input.playerName,
    avatarId: "current-avatar",
    score: input.score,
    secondaryScore: Number((input.won ? 100 : progressPercent).toFixed(1)),
    durationMs: input.durationMs,
    accuracy: input.won ? 1 : Number((progressPercent / 100).toFixed(2))
  };
}

function seededShuffle<T>(items: T[], seed: number) {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<LeaderboardEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.gameId === "string" &&
    typeof candidate.playerName === "string" &&
    typeof candidate.avatarId === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.durationMs === "number" &&
    typeof candidate.createdAt === "string"
  );
}
