import { type CSSProperties, type ChangeEvent, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Bomb, Camera, CameraOff, CircleDollarSign, Clock3, Coins, Gamepad2, Heart, Maximize2, Medal, Minimize2, MoveHorizontal, Music, Pause, Play, RotateCcw, ScanFace, ShieldAlert, Sparkles, Target, Trophy, Upload } from "lucide-react";
import type { FaceLandmarker, NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  AudioCaptureService,
  VoiceDiagnosticsSheet,
  type AudioFoundationSnapshot,
  type AudioInputDevice,
  type VoicePipelineMode
} from "./audio";
import prompthonSquareDarkLogo from "./assets/prompthon-square-dark.png";
import stellarDanceArmsCrossedIcon from "./assets/stellar-dance-arms-crossed-icon.png";
import {
  type AvatarExpression,
  type AvatarFrame,
  type AvatarManifest,
  type CoinCatchMotion,
  type FaceExpressionScore,
  type FaceRhythmExpression,
  type LeaderboardEntry,
  type MemoryTensionLevel,
  type NewLeaderboardEntry,
  type VoiceFlappyWorld,
  AVATAR_EXPRESSIONS,
  FACE_RHYTHM_EXPRESSIONS,
  VOICE_FLAPPY_BIRD_SIZE,
  VOICE_FLAPPY_BIRD_X,
  VOICE_FLAPPY_GROUND_HEIGHT,
  VOICE_FLAPPY_PIPE_WIDTH,
  buildWordSnakeLeaderboardEntry,
  createFaceRhythmDeck,
  coinCatchItemHitsAvatar,
  createLeaderboardStore,
  createMemoryMatchDeck,
  createVoiceFlappyRound,
  getAvatarFrame,
  getAvatarVisualMatchKey,
  getMemoryTensionLevel,
  getVoiceFlappyPlayableHeight,
  getVoiceFlappyRecommendedLevel,
  judgeRhythmHit,
  nextSimonSequence,
  rankFaceExpressions,
  resolveCoinCatchItem,
  scoreMemoryMatchPair,
  scoreWhackHit,
  stepCoinCatchMotion,
  stepVoiceFlappyRound
} from "./arcade";

export type ArcadeGameId =
  | "voice-flappy"
  | "face-rhythm"
  | "memory-match"
  | "whack-avatar"
  | "avatar-pong"
  | "face-simon"
  | "stellar-dance";

export type ArcadeAvatarAsset = {
  dataUrl: string;
  previewUrl?: string;
  name: string;
  spriteSheet?: {
    columns: number;
    rows: number;
    frameSize?: number;
    frameWidth?: number;
    frameHeight?: number;
    imageWidth?: number;
    imageHeight?: number;
    frames?: AvatarManifest["frames"];
  };
};

type GameStatus = "ready" | "running" | "paused" | "ended";

type ArcadeGameConfig = {
  id: ArcadeGameId;
  name: string;
  subtitle: string;
};

type GameShellProps = ArcadeGameConfig & {
  status: GameStatus;
  score: number;
  timerLabel?: string;
  tensionLevel?: MemoryTensionLevel;
  sensorLabel?: string;
  expression?: AvatarExpression;
  hideStatusBar?: boolean;
  showStartOverlay?: boolean;
  finalScreenDelayMs?: number;
  children: React.ReactNode;
  finalEntry?: NewLeaderboardEntry | null;
  runId: number;
  onStart: () => void;
  onPause?: () => void;
  onRestart: () => void;
};

const ARCADE_CONFIG = {
  avatarSheetUrl: import.meta.env.VITE_ARCADE_AVATAR_SHEET_URL || "/generated-avatar/current-sprite-sheet.png",
  avatarPreviewUrl: import.meta.env.VITE_ARCADE_AVATAR_PREVIEW_URL || "/generated-avatar/current-sprite-sheet-preview.png",
  avatarManifestUrl: import.meta.env.VITE_ARCADE_AVATAR_MANIFEST_URL || "/generated-avatar/sprite-template-4x7-manifest.json",
  leaderboardStorageKey: import.meta.env.VITE_ARCADE_LEADERBOARD_STORAGE_KEY || "prompthon-avatar-arcade-leaderboard-v1",
  defaultPlayerName: import.meta.env.VITE_ARCADE_DEFAULT_PLAYER_NAME || "Player",
  voiceEnabled: import.meta.env.VITE_ARCADE_ENABLE_VOICE !== "false",
  voicePipelineMode: parseVoicePipelineMode(import.meta.env.VITE_ARCADE_VOICE_PIPELINE_MODE),
  voiceDiagnosticsEnabled: import.meta.env.DEV
    ? import.meta.env.VITE_ARCADE_VOICE_DIAGNOSTICS !== "false"
    : import.meta.env.VITE_ARCADE_VOICE_DIAGNOSTICS === "true",
  voiceModelBaseUrl: import.meta.env.VITE_ARCADE_VOICE_MODEL_BASE_URL || "",
  faceEnabled: import.meta.env.VITE_ARCADE_ENABLE_FACE !== "false",
  faceModelUrl: import.meta.env.VITE_ARCADE_FACE_MODEL_URL || ""
};

export const ARCADE_GAME_CONFIGS: ArcadeGameConfig[] = [
  { id: "voice-flappy", name: "Voice Flappy", subtitle: "Lift the avatar with your voice or Space." },
  { id: "face-rhythm", name: "Face Rhythm", subtitle: "Match falling expressions at the hit zone." },
  { id: "memory-match", name: "Memory Match", subtitle: "Find pairs of the player avatar expressions." },
  { id: "whack-avatar", name: "Whack Avatar", subtitle: "Whack the matching avatar before it drops." },
  { id: "avatar-pong", name: "Coin Catch", subtitle: "Run left or right to catch coins and dodge bombs." },
  { id: "face-simon", name: "Face Simon", subtitle: "Watch an expression sequence, then repeat it." },
  { id: "stellar-dance", name: "Stellar Dance", subtitle: "Match body poses to the music beat." }
];

const DEFAULT_AVATAR_MANIFEST: AvatarManifest = {
  imageWidth: 1200,
  imageHeight: 2100,
  frames: {
    happy: { x: 70, y: 360, width: 310, height: 310 },
    excited: { x: 820, y: 360, width: 310, height: 310 },
    sad: { x: 445, y: 750, width: 310, height: 310 },
    dizzy: { x: 70, y: 1140, width: 310, height: 310 },
    playful: { x: 820, y: 1140, width: 310, height: 310 },
    sleepy: { x: 445, y: 1530, width: 310, height: 310 }
  }
};

const EMPTY_FACE_EXPRESSION_RANKING: FaceExpressionScore[] = FACE_RHYTHM_EXPRESSIONS.map((expression) => ({ expression, confidence: 0 }));
const FACE_LANDMARKER_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_LANDMARKER_MODEL_URL = ARCADE_CONFIG.faceModelUrl
  || "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_RHYTHM_SAMPLE_INTERVAL_MS = 70;
const FACE_RHYTHM_SAMPLE_WINDOW_SIZE = 5;
const FACE_RHYTHM_MIN_CONSENSUS = 3;
const FACE_RHYTHM_TARGET_BASE_STEP = 1.25;
const FACE_RHYTHM_TARGET_LEVEL_STEP = 0.25;
const VOICE_FLAPPY_NOISE_GATE_DEFAULT = 0.2;
const EMPTY_AUDIO_FOUNDATION_SNAPSHOT: AudioFoundationSnapshot = {
  status: "idle",
  settings: null,
  diagnostics: null,
  noiseProfile: null,
  warnings: [],
  error: null
};
const FACE_RHYTHM_POSE_LABELS: Record<FaceRhythmExpression, string> = {
  happy: "Neutral",
  playful: "Tongue out",
  sleepy: "Eyes closed",
  excited: "Big laugh",
  sad: "Frown",
  dizzy: "Wink"
};
const MEMORY_EXPRESSIONS: AvatarExpression[] = ["happy", "excited", "sad", "dizzy", "playful", "sleepy", "angry", "surprised"];
const MEMORY_MATCH_DURATION_SECONDS = 120;
const WHACK_EXPRESSIONS: AvatarExpression[] = ["happy", "excited", "sad", "dizzy", "playful", "sleepy"];
const WHACK_DURATION_SECONDS = 75;
const WHACK_LEVEL_DURATION_SECONDS = 15;
const WHACK_LEVEL_COUNT = 5;
const WHACK_LEVEL_ONE_POPUP_MS = { base: 368000, min: 304000 } as const;
const WHACK_LEVEL_SPEED_BOOST = 1.15;
const WHACK_LEVEL_EXPRESSIONS: readonly AvatarExpression[][] = [
  ["happy", "excited", "sad"],
  ["happy", "excited", "sad", "sleepy"],
  ["happy", "excited", "sad", "sleepy", "dizzy"],
  ["happy", "excited", "sad", "sleepy", "dizzy", "scared"],
  ["happy", "excited", "sad", "sleepy", "dizzy", "scared", "angry", "playful"]
] as const;
const WHACK_LEVEL_BREAK_SECONDS = 5;
type WhackMode = "levels" | "endless";
type PoseCameraStatus = "off" | "loading" | "ready" | "blocked" | "error";
type VisionTrackerStatus = "idle" | "loading" | "ready" | "error";
const POSE_LANDMARKER_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const COIN_CATCH_POSE_INTERVAL_MS = 15;
const COIN_CATCH_INITIAL_MOTION: CoinCatchMotion = { x: 0.5, velocity: 0 };
const COIN_CATCH_VALUES = [1, 3, 5] as const;
const COIN_CATCH_TORSO_LANDMARK_INDEXES = [11, 12, 23, 24];
const COIN_CATCH_TORSO_DIRECTION_DEADZONE = 0.035;
const COIN_CATCH_TORSO_DIRECTION_FULL_SPEED = 0.16;
const COIN_CATCH_TORSO_RUN_FULL_SPEED = 0.42;
type CoinCatchValue = (typeof COIN_CATCH_VALUES)[number];
type CoinCatchItem = {
  id: number;
  kind: "coin" | "bomb";
  value: CoinCatchValue;
  x: number;
  y: number;
  size: number;
  speed: number;
};
type CoinCatchPoseControl = {
  direction: number;
  runIntensity: number;
  centerX: number;
};
type CoinCatchPoseSample = {
  landmarks: NormalizedLandmark[];
  capturedAt: number;
};
const FACE_SIMON_DURATION_SECONDS = 60;
const FACE_SIMON_MAX_LIVES = 3;

function clampArcadeValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseVoicePipelineMode(value: string | undefined): VoicePipelineMode {
  return value === "foundation" || value === "personalized" ? value : "legacy";
}

function getVoiceFlappyIdleLabel(testMode: boolean, pipelineMode: VoicePipelineMode) {
  if (testMode) {
    return "Test voice input";
  }
  if (pipelineMode === "foundation") {
    return ARCADE_CONFIG.voiceEnabled ? "Audio foundation on play" : "Space fallback";
  }
  if (pipelineMode === "personalized") {
    return "Enrollment pending - Space fallback";
  }
  return ARCADE_CONFIG.voiceEnabled ? "Mic on play" : "Space fallback";
}

export function isArcadeGameId(value: string): value is ArcadeGameId {
  return ARCADE_GAME_CONFIGS.some((game) => game.id === value);
}

export function ArcadeGame({
  gameId,
  avatarAsset,
  playerId = "default-player",
  playerName = ARCADE_CONFIG.defaultPlayerName
}: {
  gameId: ArcadeGameId;
  avatarAsset: ArcadeAvatarAsset | null;
  playerId?: string;
  playerName?: string;
}) {
  const manifest = useArcadeAvatarManifest();
  const asset = avatarAsset ?? {
    dataUrl: ARCADE_CONFIG.avatarSheetUrl,
    previewUrl: ARCADE_CONFIG.avatarPreviewUrl,
    name: "Configured arcade avatar"
  };

  if (gameId === "voice-flappy") {
    return <VoiceFlappyGame avatarAsset={asset} manifest={manifest} playerId={playerId} playerName={playerName} />;
  }
  if (gameId === "face-rhythm") {
    return <FaceRhythmGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
  }
  if (gameId === "memory-match") {
    return <MemoryMatchGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
  }
  if (gameId === "whack-avatar") {
    return <WhackAvatarGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
  }
  if (gameId === "avatar-pong") {
    return <CoinCatchGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
  }
  if (gameId === "face-simon") {
    return <FaceSimonGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
  }
  return <StellarDanceGame avatarAsset={asset} manifest={manifest} playerName={playerName} />;
}

export function AvatarSprite({
  asset,
  manifest,
  expression,
  className,
  style,
  label,
  showExpressionOverlay = false
}: {
  asset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
  expression: AvatarExpression;
  className?: string;
  style?: CSSProperties;
  label?: string;
  showExpressionOverlay?: boolean;
}) {
  const activeManifest = asset.spriteSheet ? spriteSheetToAvatarManifest(asset.spriteSheet) : manifest;
  const frame = getAvatarFrame(activeManifest, expression);
  const imageUrl = asset.dataUrl || asset.previewUrl;
  const wrapperStyle: CSSProperties | undefined = frame
    ? { aspectRatio: `${frame.width} / ${frame.height}` }
    : undefined;
  const imageStyle: CSSProperties = frame
    ? {
        width: `${((frame.imageWidth ?? frame.width) / frame.width) * 100}%`,
        height: `${((frame.imageHeight ?? frame.height) / frame.height) * 100}%`,
        transform: `translate(-${(frame.x / (frame.imageWidth ?? frame.width)) * 100}%, -${(frame.y / (frame.imageHeight ?? frame.height)) * 100}%)`
      }
    : {};

  return (
    <span
      className={cn("relative grid overflow-hidden rounded-full border-2 border-[#07111f] bg-[#fff4c7] shadow-sm", className)}
      style={{ ...wrapperStyle, ...style }}
      aria-label={label ?? `${expression} avatar`}
      data-expression={expression}
      data-source-expression={frame?.sourceExpression}
      data-frame-x={frame?.x}
      data-frame-y={frame?.y}
      data-frame-width={frame?.width}
      data-frame-height={frame?.height}
    >
      <img src={imageUrl} alt="" className="absolute left-0 top-0 max-w-none object-contain" style={imageStyle} draggable={false} />
      {showExpressionOverlay ? <AvatarExpressionOverlay expression={expression} /> : null}
      {!frame ? <span className="place-self-center text-lg font-black uppercase">{expression.slice(0, 2)}</span> : null}
    </span>
  );
}

function AvatarExpressionOverlay({ expression }: { expression: AvatarExpression }) {
  const isHappy = expression === "happy" || expression === "excited" || expression === "playful";
  const isAngry = expression === "angry";
  const isSad = expression === "sad" || expression === "sleepy" || expression === "scared";
  const isSurprised = expression === "surprised" || expression === "dizzy";

  return (
    <span className="pointer-events-none absolute inset-0 z-20 rounded-full" aria-hidden="true">
      {isAngry ? <span className="absolute inset-0 rounded-full bg-pink-300/35 mix-blend-multiply" /> : null}
      <span
        className={cn(
          "absolute inset-1 rounded-full border-[0.22em] shadow-[inset_0_0_0.8em_rgba(255,255,255,0.22)]",
          isAngry && "border-pink-500/85",
          isHappy && "border-amber-400/80",
          isSurprised && "border-sky-400/80",
          isSad && "border-blue-400/75",
          !isAngry && !isHappy && !isSurprised && !isSad && "border-white/0"
        )}
      />
    </span>
  );
}

function spriteSheetToAvatarManifest(spriteSheet: NonNullable<ArcadeAvatarAsset["spriteSheet"]>): AvatarManifest {
  if (spriteSheet.frames) {
    return {
      imageWidth: spriteSheet.imageWidth,
      imageHeight: spriteSheet.imageHeight,
      frames: spriteSheet.frames
    };
  }
  const frameWidth = spriteSheet.frameWidth ?? spriteSheet.frameSize ?? 512;
  const frameHeight = spriteSheet.frameHeight ?? spriteSheet.frameSize ?? 512;
  const legacyOrder: AvatarExpression[] = ["happy", "excited", "sad", "dizzy", "playful", "sleepy"];
  const frames: AvatarManifest["frames"] = {};
  for (const [row, expression] of legacyOrder.entries()) {
    if (row >= spriteSheet.rows) {
      continue;
    }
    frames[expression] = {
      x: 0,
      y: row * frameHeight,
      width: frameWidth,
      height: frameHeight
    };
  }
  return {
    imageWidth: spriteSheet.columns * frameWidth,
    imageHeight: spriteSheet.rows * frameHeight,
    frames
  };
}

function GameShell({
  id,
  name,
  subtitle,
  status,
  score,
  timerLabel,
  tensionLevel = "calm",
  sensorLabel,
  expression = "neutral",
  hideStatusBar = false,
  showStartOverlay = true,
  finalScreenDelayMs = 0,
  children,
  finalEntry,
  runId,
  onStart,
  onPause,
  onRestart
}: GameShellProps) {
  const leaderboard = useLeaderboard(id, finalEntry, runId);
  const isRunning = status === "running";
  const isMemoryMatch = id === "memory-match";
  const [showScoreFeedback, setShowScoreFeedback] = useState(false);
  const [scoreFeedbackDelta, setScoreFeedbackDelta] = useState(0);
  const [showFinalScreen, setShowFinalScreen] = useState(false);
  const previousScoreRef = useRef(score);

  useEffect(() => {
    if (isMemoryMatch && score > previousScoreRef.current) {
      setScoreFeedbackDelta(score - previousScoreRef.current);
      setShowScoreFeedback(true);
      const feedbackTimeout = window.setTimeout(() => setShowScoreFeedback(false), 700);
      previousScoreRef.current = score;
      return () => window.clearTimeout(feedbackTimeout);
    }
    previousScoreRef.current = score;
  }, [isMemoryMatch, score]);

  useEffect(() => {
    if (status !== "ended") {
      setShowFinalScreen(false);
      return;
    }
    if (finalScreenDelayMs <= 0) {
      setShowFinalScreen(true);
      return;
    }
    const finalScreenTimeout = window.setTimeout(() => setShowFinalScreen(true), finalScreenDelayMs);
    return () => window.clearTimeout(finalScreenTimeout);
  }, [finalScreenDelayMs, runId, status]);

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 shadow-sm backdrop-blur max-sm:h-auto max-sm:flex-col max-sm:items-stretch max-sm:px-3 max-sm:py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <SidebarTrigger className="size-7" aria-label="Toggle application navigation" />
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
            <Gamepad2 />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold leading-none tracking-normal">{name}</h1>
            <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max-sm:justify-start">
          {!isMemoryMatch && timerLabel ? <Badge variant="secondary">{timerLabel}</Badge> : null}
          {!isMemoryMatch && sensorLabel ? <Badge variant="outline">{sensorLabel}</Badge> : null}
          {!isMemoryMatch ? <Badge variant={isRunning ? "default" : "secondary"}>{formatGameStatus(status)}</Badge> : null}
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden p-4 max-sm:overflow-y-auto max-sm:overflow-x-hidden max-sm:p-3">
        <section className="mx-auto grid h-full min-h-0 max-w-[1440px] grid-cols-[minmax(0,1fr)_320px] gap-4 max-lg:h-auto max-lg:grid-cols-1">
          <Card className={cn("grid min-h-0 min-w-0 overflow-hidden py-0", hideStatusBar ? "grid-rows-[minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]")}>
            {!hideStatusBar ? (
              isMemoryMatch ? (
                <CardContent className="relative flex min-h-16 items-center justify-between gap-4 border-b px-4 py-3">
                  <div className={cn("memory-tension-timer flex items-center gap-2 text-xl font-black leading-none", `memory-tension-${tensionLevel}`)}>
                    <Clock3 className="size-5 text-primary" />
                    {timerLabel}
                  </div>
                  <div className={cn("relative flex min-w-10 items-center justify-end gap-2 text-lg font-black transition duration-200", showScoreFeedback && "scale-110 text-emerald-600")}>
                    <Trophy className="size-5 text-primary" />
                    {score}
                    {showScoreFeedback ? (
                      <span className="absolute -top-5 right-0 text-xs font-black text-emerald-600" aria-live="polite">+{scoreFeedbackDelta}</span>
                    ) : null}
                  </div>
                </CardContent>
              ) : (
                <CardContent className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b p-3 max-sm:grid-cols-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#fff4c7]">
                      <Sparkles className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">Current expression: {formatExpression(expression)}</div>
                      <div className="truncate text-xs font-semibold text-muted-foreground">Avatar feedback is shared across every arcade game.</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    {status === "running" || status === "paused" ? (
                      <>
                        <Button type="button" size="icon" variant="outline" aria-label={isRunning ? "Pause" : "Play"} title={isRunning ? "Pause" : "Play"} onClick={isRunning ? onPause ?? onRestart : onStart}>
                          {isRunning ? <Pause /> : <Play />}
                        </Button>
                        <Button type="button" size="icon" variant="outline" aria-label="Restart" title="Restart" onClick={onRestart}>
                          <RotateCcw />
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm font-black max-sm:justify-start">
                    <Trophy className="size-4 text-primary" />
                    {score}
                  </div>
                </CardContent>
              )
            ) : null}
            <CardContent className="relative min-h-0 overflow-hidden bg-[#f8fbf7] p-3">
              {status === "ended" && showFinalScreen ? (
                <GameFinalScreen
                  gameName={name}
                  score={score}
                  finalEntry={finalEntry}
                  submittedEntry={leaderboard.submittedEntry}
                  daily={leaderboard.daily}
                  allTime={leaderboard.allTime}
                  onRestart={onRestart}
                />
              ) : children}
              {showStartOverlay && status === "ready" ? <GameStartOverlay onStart={onStart} className="inset-3" /> : null}
            </CardContent>
          </Card>

          <LeaderboardPanel daily={leaderboard.daily} allTime={leaderboard.allTime} />
        </section>
      </section>
    </main>
  );
}

export function GameStartOverlay({ onStart, disabled = false, className }: { onStart: () => void; disabled?: boolean; className?: string }) {
  return (
    <div
      data-testid="game-start-overlay"
      className={cn("absolute z-50 grid place-items-center rounded-md bg-[#07111f]/28 backdrop-blur-[3px]", className)}
    >
      <Button
        type="button"
        size="icon"
        className="size-28 rounded-full border-4 border-white/80 bg-primary text-primary-foreground opacity-100 shadow-xl disabled:cursor-wait disabled:opacity-100"
        aria-label="Play"
        title="Play"
        disabled={disabled}
        onClick={onStart}
      >
        <Play className="ml-1 size-[72px] fill-current stroke-[1.4]" />
      </Button>
    </div>
  );
}

function VoiceFlappyGame({ avatarAsset, manifest, playerId, playerName }: GameProps & { playerId: string }) {
  const config = getGameConfig("voice-flappy");
  const testMode = useMemo(() => import.meta.env.DEV && new URLSearchParams(window.location.search).get("voiceTest") === "1", []);
  const pipelineMode = ARCADE_CONFIG.voicePipelineMode;
  const initialWorld = useMemo<VoiceFlappyWorld>(() => ({ width: 640, height: 520 }), []);
  const [runId, setRunId] = useState(0);
  const [world, setWorld] = useState(initialWorld);
  const [round, setRound] = useState(() => createVoiceFlappyRound(initialWorld));
  const [sensorLabel, setSensorLabel] = useState(() => getVoiceFlappyIdleLabel(testMode, pipelineMode));
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [backgroundNoiseLevel, setBackgroundNoiseLevel] = useState(0);
  const [noiseGateLevel, setNoiseGateLevel] = useState(VOICE_FLAPPY_NOISE_GATE_DEFAULT);
  const [expression, setExpression] = useState<AvatarExpression>("neutral");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [testerMode, setTesterMode] = useState<"manual" | "auto">("manual");
  const [simulatedVoiceLevel, setSimulatedVoiceLevel] = useState(0);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [audioSnapshot, setAudioSnapshot] = useState<AudioFoundationSnapshot>(() => ({ ...EMPTY_AUDIO_FOUNDATION_SNAPSHOT }));
  const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const playfieldRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(initialWorld);
  const roundRef = useRef(round);
  const testerModeRef = useRef<"manual" | "auto">("manual");
  const simulatedVoiceRef = useRef(0);
  const flapQueuedRef = useRef(false);
  const startPendingRef = useRef(false);
  const startTokenRef = useRef(0);
  const volumeRef = useRef(0);
  const noiseGateRef = useRef(VOICE_FLAPPY_NOISE_GATE_DEFAULT);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const foundationServiceRef = useRef<AudioCaptureService | null>(null);
  const foundationUnsubscribeRef = useRef<(() => void) | null>(null);

  function updateRound(nextRound: typeof round) {
    roundRef.current = nextRound;
    setRound(nextRound);
  }

  function getFoundationService() {
    if (foundationServiceRef.current) {
      return foundationServiceRef.current;
    }
    const service = new AudioCaptureService();
    foundationServiceRef.current = service;
    foundationUnsubscribeRef.current = service.subscribe(setAudioSnapshot);
    return service;
  }

  async function refreshAudioInputDevices(service = getFoundationService()) {
    try {
      setAudioInputDevices(await service.listInputDevices());
    } catch {
      setAudioInputDevices([]);
    }
  }

  async function startFoundationCapture(autoCalibrate: boolean, requestToken?: number) {
    const isCurrentRequest = () => requestToken === undefined || requestToken === startTokenRef.current;
    if (!ARCADE_CONFIG.voiceEnabled || !navigator.mediaDevices?.getUserMedia) {
      if (isCurrentRequest()) {
        setSensorLabel("Space fallback");
      }
      return false;
    }

    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    try {
      setSensorLabel("Requesting microphone");
      const service = getFoundationService();
      const snapshot = await service.start({ deviceId: selectedAudioInputId || undefined });
      if (!isCurrentRequest()) {
        await service.stop();
        return false;
      }
      void refreshAudioInputDevices(service);
      if (snapshot.settings?.deviceId && selectedAudioInputId) {
        setSelectedAudioInputId(snapshot.settings.deviceId);
      }
      if (autoCalibrate) {
        setSensorLabel("Quiet calibration - 3 seconds");
        await service.calibrateNoise();
        if (!isCurrentRequest()) {
          await service.stop();
          return false;
        }
      }
      setSensorLabel(autoCalibrate ? "Foundation ready - Space to flap" : "Diagnostics ready");
      return true;
    } catch {
      if (isCurrentRequest()) {
        setSensorLabel("Microphone unavailable - Space fallback");
      }
      return false;
    }
  }

  function startFoundationDiagnostics() {
    if (roundRef.current.status === "running") {
      return;
    }
    void startFoundationCapture(false);
  }

  function calibrateFoundationNoise() {
    const service = foundationServiceRef.current;
    if (!service) {
      return;
    }
    setSensorLabel("Quiet calibration - 3 seconds");
    void service.calibrateNoise()
      .then(() => setSensorLabel("Noise profile ready"))
      .catch(() => setSensorLabel("Calibration cancelled"));
  }

  function runSyntheticAudioDiagnostic() {
    if (roundRef.current.status === "running") {
      return;
    }
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    void getFoundationService().runSyntheticDiagnostic()
      .then(() => setSensorLabel("Synthetic diagnostics ready"))
      .catch(() => setSensorLabel("Synthetic diagnostics failed"));
  }

  function stopFoundationDiagnostics() {
    void foundationServiceRef.current?.stop();
    setSensorLabel(getVoiceFlappyIdleLabel(testMode, pipelineMode));
  }

  function restart() {
    startTokenRef.current += 1;
    startPendingRef.current = false;
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    void foundationServiceRef.current?.stop();
    setRunId((value) => value + 1);
    updateRound(createVoiceFlappyRound(worldRef.current));
    setExpression("neutral");
    setStartedAt(0);
    setEndedAt(0);
    setSensorLabel(getVoiceFlappyIdleLabel(testMode, pipelineMode));
    setVoiceLevel(0);
    setBackgroundNoiseLevel(0);
    flapQueuedRef.current = false;
    volumeRef.current = 0;
  }

  function beginRound() {
    const now = performance.now();
    const currentRound = roundRef.current;
    if (currentRound.status === "ended") {
      const restartedRound = { ...createVoiceFlappyRound(worldRef.current), status: "running" as const };
      updateRound(restartedRound);
      setRunId((value) => value + 1);
      setStartedAt(now);
      setEndedAt(0);
      setExpression("neutral");
    } else {
      updateRound({ ...currentRound, status: "running" });
      setStartedAt((value) => value || now);
    }
  }

  function start() {
    if (roundRef.current.status === "running" || startPendingRef.current) {
      return;
    }
    if (testMode) {
      setSensorLabel(testerModeRef.current === "auto" ? "Test autopilot" : "Test voice input");
      beginRound();
      return;
    }
    if (pipelineMode === "personalized") {
      setSensorLabel(playerId === "default-player"
        ? "Registered player required - Space fallback"
        : "Enrollment pending - Space fallback");
      beginRound();
      return;
    }
    startPendingRef.current = true;
    const requestToken = startTokenRef.current + 1;
    startTokenRef.current = requestToken;
    if (pipelineMode === "foundation") {
      void startFoundationCapture(true, requestToken).finally(() => {
        if (requestToken !== startTokenRef.current) {
          return;
        }
        startPendingRef.current = false;
        beginRound();
      });
      return;
    }
    void foundationServiceRef.current?.stop();
    setSensorLabel("Starting mic");
    void startLegacyVoiceInput(setSensorLabel, volumeRef, noiseGateRef, setVoiceLevel, setBackgroundNoiseLevel, audioCleanupRef).finally(() => {
      if (requestToken !== startTokenRef.current) {
        return;
      }
      startPendingRef.current = false;
      beginRound();
    });
  }

  function flap() {
    flapQueuedRef.current = true;
    setExpression("excited");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        if (roundRef.current.status !== "running") {
          start();
        }
        flap();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pipelineMode, playerId, selectedAudioInputId, testMode]);

  useEffect(() => {
    if (diagnosticsOpen) {
      void refreshAudioInputDevices();
    }
  }, [diagnosticsOpen]);

  useEffect(() => {
    const playfield = playfieldRef.current;
    if (!playfield) {
      return;
    }
    const updateSize = () => {
      const bounds = playfield.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) {
        return;
      }
      const nextWorld = { width: Math.round(bounds.width), height: Math.round(bounds.height) };
      const previousWorld = worldRef.current;
      if (nextWorld.width === previousWorld.width && nextWorld.height === previousWorld.height) {
        return;
      }
      worldRef.current = nextWorld;
      setWorld(nextWorld);
      if (roundRef.current.status === "ready") {
        updateRound(createVoiceFlappyRound(nextWorld));
      }
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(playfield);
    updateSize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    startTokenRef.current += 1;
    startPendingRef.current = false;
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    foundationUnsubscribeRef.current?.();
    foundationUnsubscribeRef.current = null;
    const foundationService = foundationServiceRef.current;
    foundationServiceRef.current = null;
    void foundationService?.stop();
  }, []);

  useEffect(() => {
    if (round.status !== "running") {
      return;
    }
    let frameId = 0;
    let previousTime = performance.now();
    const tick = (currentTime: number) => {
      const currentRound = roundRef.current;
      if (currentRound.status !== "running") {
        return;
      }
      const currentWorld = worldRef.current;
      const activeVoiceLevel = testMode
        ? testerModeRef.current === "auto"
          ? getVoiceFlappyRecommendedLevel(currentRound, currentWorld)
          : simulatedVoiceRef.current
        : pipelineMode === "legacy"
          ? volumeRef.current
          : 0;
      const nextRound = stepVoiceFlappyRound(currentRound, {
        deltaSeconds: (currentTime - previousTime) / 1000,
        voiceLevel: activeVoiceLevel,
        flap: flapQueuedRef.current,
        world: currentWorld
      });
      previousTime = currentTime;
      flapQueuedRef.current = false;
      updateRound(nextRound);
      if (testMode) {
        setVoiceLevel(activeVoiceLevel);
      }
      if (nextRound.status === "ended") {
        setExpression("dizzy");
        setEndedAt(currentTime);
        audioCleanupRef.current?.();
        audioCleanupRef.current = null;
        void foundationServiceRef.current?.stop();
        return;
      }
      if (nextRound.score > currentRound.score) {
        setExpression("happy");
      } else if (activeVoiceLevel > 0.62 || nextRound.velocity < -90) {
        setExpression("excited");
      } else if (activeVoiceLevel > 0.3) {
        setExpression("happy");
      } else {
        setExpression("neutral");
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [pipelineMode, round.status, testMode]);

  const finalEntry = round.status === "ended" && !testMode
    ? makeEntry("voice-flappy", playerName, round.score, startedAt, endedAt, round.score)
    : null;
  const targetVoiceLevel = getVoiceFlappyRecommendedLevel(round, world);
  const playableHeight = getVoiceFlappyPlayableHeight(world.height);

  return (
    <GameShell {...config} status={round.status} score={round.score} timerLabel="pipes" sensorLabel={sensorLabel} expression={expression} runId={runId} finalEntry={finalEntry} finalScreenDelayMs={2500} onStart={start} onPause={() => updateRound({ ...roundRef.current, status: "paused" })} onRestart={restart}>
      <div
        ref={playfieldRef}
        data-testid="voice-flappy-playfield"
        data-status={round.status}
        data-score={round.score}
        data-distance={round.distance.toFixed(2)}
        data-player-id={playerId}
        data-voice-pipeline-mode={pipelineMode}
        className="relative h-full min-h-[420px] overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#dff6ff]"
        onPointerDown={() => { if (roundRef.current.status !== "running") start(); flap(); }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#dff6ff_0%,#f7fdff_64%,#d8f3dc_100%)]" />
        {ARCADE_CONFIG.voiceDiagnosticsEnabled && !diagnosticsOpen ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="absolute left-3 top-3 z-[60] border-2 border-[#07111f] bg-white/90 shadow-sm"
            aria-label="Voice diagnostics"
            title="Voice diagnostics"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setDiagnosticsOpen(true);
            }}
          >
            <AudioLines />
          </Button>
        ) : null}
        <VoiceFlappyScenery distance={round.distance} worldWidth={world.width} />
        {round.pipes.map((pipe) => (
          <div
            key={pipe.id}
            data-testid="voice-flappy-pipe"
            data-pipe-id={pipe.id}
            data-x={pipe.x.toFixed(2)}
            data-gap-y={pipe.gapY.toFixed(2)}
            data-gap-height={pipe.gapHeight.toFixed(2)}
            className="absolute top-0 z-10"
            style={{ transform: `translate3d(${pipe.x}px, 0, 0)`, width: VOICE_FLAPPY_PIPE_WIDTH, height: playableHeight }}
          >
            <div className="absolute top-0 w-full rounded-b-md border-2 border-[#07111f] bg-[#10a37f] shadow-[inset_-8px_0_rgba(0,0,0,0.08)]" style={{ height: Math.max(0, pipe.gapY - pipe.gapHeight / 2) }}>
              <span className="absolute -bottom-2 -left-1.5 h-5 w-[calc(100%+12px)] rounded-md border-2 border-[#07111f] bg-[#20bd91]" />
            </div>
            <div className="absolute bottom-0 w-full rounded-t-md border-2 border-[#07111f] bg-[#10a37f] shadow-[inset_-8px_0_rgba(0,0,0,0.08)]" style={{ height: Math.max(0, playableHeight - pipe.gapY - pipe.gapHeight / 2) }}>
              <span className="absolute -top-2 -left-1.5 h-5 w-[calc(100%+12px)] rounded-md border-2 border-[#07111f] bg-[#20bd91]" />
            </div>
          </div>
        ))}
        {testMode || pipelineMode === "legacy" ? (
          <VoiceLevelBar level={voiceLevel} targetLevel={targetVoiceLevel} noiseGateLevel={noiseGateLevel} backgroundNoiseLevel={backgroundNoiseLevel} />
        ) : null}
        <div
          data-testid="voice-flappy-bird"
          data-y={round.birdY.toFixed(2)}
          data-velocity={round.velocity.toFixed(2)}
          className="absolute z-20 grid place-items-center"
          style={{
            left: VOICE_FLAPPY_BIRD_X - VOICE_FLAPPY_BIRD_SIZE / 2,
            top: round.birdY,
            transform: `rotate(${clampArcadeValue(round.velocity * 0.08, -18, 36)}deg)`
          }}
        >
          <VoiceFlappyWings active={round.status === "running" && voiceLevel > 0.04} voiceLevel={voiceLevel} />
          <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="relative z-10 size-14" />
        </div>
        {testMode || pipelineMode === "legacy" ? (
          <VoiceNoiseGateControl
            value={noiseGateLevel}
            backgroundNoiseLevel={backgroundNoiseLevel}
            disabled={testMode}
            onChange={(nextValue) => {
              noiseGateRef.current = nextValue;
              setNoiseGateLevel(nextValue);
            }}
          />
        ) : null}
        <div
          data-testid="voice-flappy-ground"
          className="absolute bottom-0 left-0 right-0 z-20 border-t-2 border-[#07111f] bg-[#ffd66b]"
          style={{
            height: VOICE_FLAPPY_GROUND_HEIGHT,
            backgroundImage: "repeating-linear-gradient(135deg,#ffd66b 0 14px,#e7aa37 14px 28px)",
            backgroundPositionX: `${-round.distance}px`
          }}
        />
        {testMode ? (
          <VoiceFlappyTester
            mode={testerMode}
            level={testerMode === "auto" ? voiceLevel : simulatedVoiceLevel}
            onModeChange={(nextMode) => {
              testerModeRef.current = nextMode;
              setTesterMode(nextMode);
              setSensorLabel(nextMode === "auto" ? "Test autopilot" : "Test voice input");
            }}
            onLevelChange={(nextLevel) => {
              simulatedVoiceRef.current = nextLevel;
              setSimulatedVoiceLevel(nextLevel);
              if (testerModeRef.current === "manual") {
                setVoiceLevel(nextLevel);
              }
            }}
            onFlap={() => {
              if (roundRef.current.status !== "running") start();
              flap();
            }}
          />
        ) : null}
      </div>
      <VoiceDiagnosticsSheet
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        pipelineMode={pipelineMode}
        playerId={playerId}
        playerName={playerName}
        modelBaseUrl={ARCADE_CONFIG.voiceModelBaseUrl}
        snapshot={audioSnapshot}
        devices={audioInputDevices}
        selectedDeviceId={selectedAudioInputId}
        captureControlsDisabled={round.status === "running"}
        onSelectedDeviceChange={setSelectedAudioInputId}
        onStart={startFoundationDiagnostics}
        onStop={stopFoundationDiagnostics}
        onCalibrate={calibrateFoundationNoise}
        onSynthetic={runSyntheticAudioDiagnostic}
      />
    </GameShell>
  );
}

function VoiceFlappyWings({ active, voiceLevel }: { active: boolean; voiceLevel: number }) {
  const wingCycleMs = Math.round(760 - clampArcadeValue(voiceLevel, 0, 1) * 620);
  return (
    <span
      data-testid="voice-flappy-wings"
      data-active={active}
      data-voice-level={voiceLevel.toFixed(3)}
      data-cycle-ms={wingCycleMs}
      className={cn("voice-flappy-wings pointer-events-none absolute left-1/2 top-1/2 z-0 h-16 w-24 -translate-x-1/2 -translate-y-1/2", active && "voice-flappy-wings-active")}
      style={{ "--voice-flappy-wing-cycle": `${wingCycleMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <svg className="voice-flappy-wing-frame voice-flappy-wing-frame-up absolute inset-0 size-full" viewBox="0 0 112 64" fill="none">
        <path d="M49 31C35 25 29 8 10 5C13 24 22 37 46 41L49 31Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M63 31C77 25 83 8 102 5C99 24 90 37 66 41L63 31Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M43 31C31 26 24 17 17 10M69 31C81 26 88 17 95 10" stroke="#A9D8EA" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <svg className="voice-flappy-wing-frame voice-flappy-wing-frame-level absolute inset-0 size-full" viewBox="0 0 112 64" fill="none">
        <path d="M49 31C34 29 21 21 5 28C17 42 30 47 48 42L49 31Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M63 31C78 29 91 21 107 28C95 42 82 47 64 42L63 31Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M43 34C30 32 20 31 11 31M69 34C82 32 92 31 101 31" stroke="#A9D8EA" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <svg className="voice-flappy-wing-frame voice-flappy-wing-frame-down absolute inset-0 size-full" viewBox="0 0 112 64" fill="none">
        <path d="M48 29C33 34 24 50 9 58C13 39 25 27 48 24V29Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M64 29C79 34 88 50 103 58C99 39 87 27 64 24V29Z" fill="#F8FBFF" stroke="#07111F" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M42 31C30 38 22 47 16 53M70 31C82 38 90 47 96 53" stroke="#A9D8EA" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

type FaceCameraStatus = "off" | "loading" | "ready" | "blocked" | "error";
type FaceExpressionSample = { expression: FaceRhythmExpression; confidence: number };
type FaceMeshConnection = { start: number; end: number };
type FaceMeshConnections = {
  tessellation: FaceMeshConnection[];
  contours: FaceMeshConnection[];
};

function FaceRhythmGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("face-rhythm");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [remaining, setRemaining] = useState(45);
  const targetDeckRef = useRef(createFaceRhythmDeck(64));
  const [target, setTarget] = useState(() => createRhythmTarget(0, targetDeckRef.current));
  const [expression, setExpression] = useState<AvatarExpression>("neutral");
  const [detectedExpression, setDetectedExpression] = useState<FaceRhythmExpression>("happy");
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [faceExpressionRanking, setFaceExpressionRanking] = useState<FaceExpressionScore[]>(EMPTY_FACE_EXPRESSION_RANKING);
  const [facePresent, setFacePresent] = useState(false);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<FaceCameraStatus>("off");
  const [trackerStatus, setTrackerStatus] = useState<VisionTrackerStatus>("idle");
  const [sensorLabel, setSensorLabel] = useState(ARCADE_CONFIG.faceEnabled ? "Camera on play" : "Camera unavailable");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const faceFrameRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const lastFaceSampleAtRef = useRef(0);
  const faceSamplesRef = useRef<FaceExpressionSample[]>([]);
  const detectedExpressionRef = useRef<FaceRhythmExpression>("happy");
  const resolvedTargetRef = useRef<number | null>(null);
  const faceMeshConnectionsRef = useRef<FaceMeshConnections>({ tessellation: [], contours: [] });

  function restart() {
    setRunId((value) => value + 1);
    setStatus("ready");
    setScore(0);
    setCombo(0);
    setHits(0);
    setAttempts(0);
    setRemaining(45);
    targetDeckRef.current = createFaceRhythmDeck(64);
    setTarget(createRhythmTarget(0, targetDeckRef.current));
    setExpression("neutral");
    setDetectedExpression("happy");
    detectedExpressionRef.current = "happy";
    setFaceConfidence(0);
    setFaceExpressionRanking(EMPTY_FACE_EXPRESSION_RANKING);
    faceSamplesRef.current = [];
    resolvedTargetRef.current = null;
    setStartedAt(0);
    setEndedAt(0);
  }

  function start() {
    setStatus("running");
    setStartedAt((value) => value || performance.now());
    if (ARCADE_CONFIG.faceEnabled && cameraStatus !== "loading" && trackerStatus !== "loading" && (cameraStatus !== "ready" || trackerStatus !== "ready")) {
      void startFaceCamera();
    }
  }

  function submitExpression(actual: FaceRhythmExpression, currentTarget = target) {
    if (status !== "running") {
      start();
    }
    if (resolvedTargetRef.current === currentTarget.id) {
      return;
    }
    const distanceMs = Math.abs(currentTarget.y - 78) * 8;
    const judged = judgeRhythmHit({ expected: currentTarget.expression, actual, distanceMs });
    setAttempts((value) => value + 1);
    setExpression(actual);
    if (judged.correct) {
      resolvedTargetRef.current = currentTarget.id;
      setScore((value) => value + 1);
      setHits((value) => value + 1);
      setCombo((value) => value + 1);
      setTarget(createRhythmTarget(currentTarget.id + 1, targetDeckRef.current));
    } else {
      setCombo(0);
    }
  }

  async function startFaceCamera() {
    if (!ARCADE_CONFIG.faceEnabled) {
      setCameraStatus("blocked");
      setSensorLabel("Camera unavailable");
      return;
    }
    if (cameraStatus === "loading" || trackerStatus === "loading") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      setSensorLabel("Camera unavailable");
      return;
    }

    if (!cameraStreamRef.current) {
      setCameraStatus("loading");
      setSensorLabel("Starting camera");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("ready");
        setSensorLabel("Camera live · Loading face tracker");
      } catch (error) {
        const isPermissionError = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        stopFaceCamera(isPermissionError ? "blocked" : "error");
        setSensorLabel(isPermissionError ? "Camera blocked · Allow access and retry" : "Camera unavailable · Check that it is connected");
        return;
      }
    }

    if (faceLandmarkerRef.current) {
      setTrackerStatus("ready");
      faceSamplesRef.current = [];
      lastFaceSampleAtRef.current = 0;
      setSensorLabel("Finding face");
      runFaceLoop();
      return;
    }

    setTrackerStatus("loading");
    setSensorLabel("Camera live · Loading face tracker");
    try {
      const { FilesetResolver, FaceLandmarker: FaceLandmarkerTask } = await import("@mediapipe/tasks-vision");
      if (!faceLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM_URL);
        faceLandmarkerRef.current = await FaceLandmarkerTask.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true
        });
        faceMeshConnectionsRef.current = {
          tessellation: FaceLandmarkerTask.FACE_LANDMARKS_TESSELATION,
          contours: FaceLandmarkerTask.FACE_LANDMARKS_CONTOURS
        };
      }
      faceSamplesRef.current = [];
      lastFaceSampleAtRef.current = 0;
      setTrackerStatus("ready");
      setSensorLabel("Finding face");
      runFaceLoop();
    } catch (error) {
      setTrackerStatus("error");
      setSensorLabel("Camera live · Face tracking unavailable");
    }
  }

  function stopFaceCamera(nextStatus: FaceCameraStatus = "off") {
    if (faceFrameRef.current !== null) {
      cancelAnimationFrame(faceFrameRef.current);
      faceFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    faceSamplesRef.current = [];
    setFacePresent(false);
    setFaceConfidence(0);
    setFaceExpressionRanking(EMPTY_FACE_EXPRESSION_RANKING);
    setLandmarkCount(0);
    drawFaceRhythmMesh(faceCanvasRef.current, undefined, faceMeshConnectionsRef.current);
    setCameraStatus(nextStatus);
    setTrackerStatus(faceLandmarkerRef.current ? "ready" : "idle");
    if (nextStatus === "off") {
      setSensorLabel("Camera off");
    }
  }

  function runFaceLoop() {
    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = faceLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        faceFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const now = performance.now();
      if (now - lastFaceSampleAtRef.current < FACE_RHYTHM_SAMPLE_INTERVAL_MS) {
        faceFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      lastFaceSampleAtRef.current = now;

      try {
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.faceLandmarks[0];
        drawFaceRhythmMesh(faceCanvasRef.current, landmarks, faceMeshConnectionsRef.current);
        if (!landmarks?.length) {
          faceSamplesRef.current = [];
          setFacePresent(false);
          setLandmarkCount(0);
          setFaceConfidence(0);
          setFaceExpressionRanking(EMPTY_FACE_EXPRESSION_RANKING);
          setSensorLabel("Face not found");
        } else {
          setFacePresent(true);
          setLandmarkCount(landmarks.length);
          const ranking = rankFaceExpressions(result.faceBlendshapes[0]?.categories ?? []);
          const sample = ranking[0];
          setFaceExpressionRanking(ranking);
          const samples = [...faceSamplesRef.current, sample].slice(-FACE_RHYTHM_SAMPLE_WINDOW_SIZE);
          faceSamplesRef.current = samples;
          const consensus = resolveFaceExpressionConsensus(samples);
          if (consensus) {
            detectedExpressionRef.current = consensus.expression;
            setDetectedExpression(consensus.expression);
            setExpression(consensus.expression);
            setFaceConfidence(consensus.confidence);
            setSensorLabel(`Detected ${formatFaceRhythmPose(consensus.expression)}`);
          } else {
            setSensorLabel("Reading expression");
          }
        }
      } catch {
        stopFaceCamera("error");
        setSensorLabel("Face tracking failed");
        return;
      }
      faceFrameRef.current = requestAnimationFrame(detectFrame);
    };

    if (faceFrameRef.current !== null) {
      cancelAnimationFrame(faceFrameRef.current);
    }
    faceFrameRef.current = requestAnimationFrame(detectFrame);
  }

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setStatus("ended");
          setEndedAt(performance.now());
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [status]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setTarget((current) => {
        const speed = FACE_RHYTHM_TARGET_BASE_STEP + Math.floor(hits / 10) * FACE_RHYTHM_TARGET_LEVEL_STEP;
        return { ...current, y: current.y + speed };
      });
    }, 80);
    return () => window.clearInterval(intervalId);
  }, [hits, status]);

  useEffect(() => {
    if (
      status !== "running"
      || cameraStatus !== "ready"
      || !facePresent
      || detectedExpression !== target.expression
      || Math.abs(target.y - 78) > 18
      || resolvedTargetRef.current === target.id
    ) {
      return;
    }
    submitExpression(detectedExpression, target);
  }, [cameraStatus, detectedExpression, facePresent, status, target]);

  useEffect(() => {
    if (status !== "running" || target.y <= 104 || resolvedTargetRef.current === target.id) {
      return;
    }
    resolvedTargetRef.current = target.id;
    setAttempts((value) => value + 1);
    setCombo(0);
    setExpression(detectedExpressionRef.current);
    setTarget(createRhythmTarget(target.id + 1, targetDeckRef.current));
  }, [status, target]);

  useEffect(() => {
    return () => {
      if (faceFrameRef.current !== null) {
        cancelAnimationFrame(faceFrameRef.current);
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      faceLandmarkerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (status === "ended") {
      stopFaceCamera();
    }
  }, [status]);

  const accuracy = attempts > 0 ? hits / attempts : 0;
  const finalEntry = status === "ended"
    ? makeEntry("face-rhythm", playerName, score, startedAt, endedAt, combo, accuracy)
    : null;
  const targetProgress = clampArcadeValue((target.y + 16) / 120, 0, 1);

  return (
    <GameShell {...config} status={status} score={score} timerLabel={`${remaining}s`} sensorLabel={sensorLabel} expression={expression} hideStatusBar showStartOverlay={false} runId={runId} finalEntry={finalEntry} onStart={start} onPause={() => setStatus("paused")} onRestart={restart}>
      <div className="grid h-full min-h-[420px] grid-cols-[minmax(0,1fr)_290px] gap-3 max-md:grid-cols-[minmax(0,1fr)_250px] max-sm:grid-cols-1">
        <div
          data-testid="face-rhythm-stage"
          className="relative min-h-[420px] overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#0b1220]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            style={{
              backgroundImage: "linear-gradient(rgba(90, 231, 209, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(90, 231, 209, 0.09) 1px, transparent 1px)",
              backgroundSize: "34px 34px"
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-black/30" />

          <div className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-white backdrop-blur">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              aria-label={status === "running" ? "Pause Face Rhythm" : "Play Face Rhythm"}
              title={status === "running" ? "Pause" : "Play"}
              onClick={status === "running" ? () => setStatus("paused") : start}
            >
              {status === "running" ? <Pause /> : <Play />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              aria-label="Reset Face Rhythm"
              title="Reset"
              onClick={restart}
            >
              <RotateCcw />
            </Button>
            <div className="flex min-w-10 items-center justify-center gap-1 rounded-full bg-white/10 px-2 text-xs font-black">
              <Trophy className="size-3.5 text-primary" />
              {score}
            </div>
          </div>

          <div className="absolute left-4 top-4 z-40 rounded-md border border-cyan-200/20 bg-black/45 px-2.5 py-1.5 font-mono text-[10px] font-bold text-cyan-100">
            COMBO {String(combo).padStart(2, "0")}
          </div>
          <div className="absolute right-4 top-4 z-40 rounded-md border border-cyan-200/20 bg-black/45 px-2.5 py-1.5 font-mono text-[10px] font-bold text-cyan-100">
            HIT {hits}/{attempts}
          </div>

          <div className="absolute left-0 right-0 top-[78%] z-20 h-1 bg-primary shadow-[0_0_18px_rgba(255,75,0,0.75)]">
            <span className="absolute left-3 top-1.5 font-mono text-[9px] font-bold text-primary">SYNC ZONE</span>
          </div>
          <div
            key={target.id}
            data-expression={target.expression}
            className="absolute left-1/2 z-30 grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 transition-[top] duration-75"
            style={{ top: `${target.y}%` }}
          >
            <div className="relative grid size-56 place-items-center rounded-md border border-cyan-100/35 bg-white/10 shadow-[0_0_26px_rgba(94,234,212,0.18)] backdrop-blur-sm">
              <span className="absolute left-1 top-1 size-3 border-l-2 border-t-2 border-primary" />
              <span className="absolute right-1 top-1 size-3 border-r-2 border-t-2 border-primary" />
              <span className="absolute bottom-1 left-1 size-3 border-b-2 border-l-2 border-primary" />
              <span className="absolute bottom-1 right-1 size-3 border-b-2 border-r-2 border-primary" />
              <AvatarSprite asset={avatarAsset} manifest={manifest} expression={target.expression} className="size-48" />
            </div>
            <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-black text-white">
              {formatFaceRhythmPose(target.expression)}
            </span>
          </div>

          <div className="absolute inset-x-4 bottom-4 z-30 grid gap-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-white/15 bg-black/55 p-2 text-white backdrop-blur">
              <FaceRhythmReadout label="Target" expression={target.expression} avatarAsset={avatarAsset} manifest={manifest} active />
              <Target className="size-5 text-primary" />
              <FaceRhythmReadout label="Detected" expression={detectedExpression} avatarAsset={avatarAsset} manifest={manifest} active={facePresent && detectedExpression === target.expression} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${targetProgress * 100}%` }} />
            </div>
          </div>
          {status === "ready" ? <GameStartOverlay onStart={start} className="inset-0" /> : null}
        </div>

        <aside
          data-testid="face-rhythm-camera"
          data-camera-status={cameraStatus}
          data-face-present={facePresent ? "true" : "false"}
          data-detected-expression={detectedExpression}
          className="grid content-start gap-3 rounded-lg border-2 border-[#07111f] bg-card p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-black">
              <ScanFace className="size-4 shrink-0 text-primary" />
              <span className="truncate">Face tracking</span>
            </div>
            <Badge variant={cameraStatus === "ready" ? "default" : "secondary"} className="font-mono text-[9px]">
              {cameraStatus === "ready" ? "LIVE" : cameraStatus.toUpperCase()}
            </Badge>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-cyan-950/40 bg-[#07111f]">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage: "linear-gradient(rgba(94, 234, 212, 0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(94, 234, 212, 0.11) 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }}
            />
            <video
              ref={videoRef}
              className={cn("absolute inset-0 size-full -scale-x-100 object-cover transition-opacity", cameraStatus === "ready" ? "opacity-75" : "opacity-0")}
              muted
              playsInline
              aria-label="Face Rhythm camera preview"
            />
            <canvas
              ref={faceCanvasRef}
              data-testid="face-rhythm-landmarks"
              className={cn("absolute inset-0 size-full -scale-x-100 transition-opacity", cameraStatus === "ready" ? "opacity-100" : "opacity-35")}
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-3 border border-cyan-200/20">
              <span className="absolute -left-px -top-px size-5 border-l-2 border-t-2 border-primary" />
              <span className="absolute -right-px -top-px size-5 border-r-2 border-t-2 border-primary" />
              <span className="absolute -bottom-px -left-px size-5 border-b-2 border-l-2 border-primary" />
              <span className="absolute -bottom-px -right-px size-5 border-b-2 border-r-2 border-primary" />
              <span className="absolute left-1/2 top-0 h-full border-l border-dashed border-cyan-100/20" />
              <span className="absolute left-0 top-1/2 w-full border-t border-dashed border-cyan-100/20" />
            </div>
            <div className="absolute left-2 top-2 rounded bg-black/55 px-2 py-1 font-mono text-[9px] font-bold text-cyan-100">
              MEDIAPIPE FACE 01
            </div>
            {cameraStatus !== "ready" ? (
              <div className="absolute inset-0 grid place-items-center text-cyan-50/70">
                <div className="grid justify-items-center gap-2 text-center">
                  {cameraStatus === "loading" ? <ScanFace className="size-9 animate-pulse" /> : <Camera className="size-9" />}
                  <span className="max-w-40 text-xs font-black">{sensorLabel}</span>
                </div>
              </div>
            ) : null}
            {cameraStatus === "ready" && trackerStatus !== "ready" ? (
              <div className="absolute left-2 top-9 rounded bg-black/70 px-2 py-1 text-[10px] font-black text-cyan-50 backdrop-blur">
                {sensorLabel}
              </div>
            ) : null}
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded bg-black/65 px-2 py-1.5 text-white backdrop-blur">
              <span className="truncate text-[10px] font-black">{facePresent ? formatFaceRhythmPose(detectedExpression) : "Scanning"}</span>
              <span className="font-mono text-[9px] text-cyan-100">{Math.round(faceConfidence * 100)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x rounded-md border border-input bg-muted/55 py-2 text-center font-mono">
            <FaceTelemetry label="Face" value={facePresent ? "01" : "--"} />
            <FaceTelemetry label="Points" value={landmarkCount ? String(landmarkCount) : "---"} />
            <FaceTelemetry label="Match" value={`${Math.round(faceConfidence * 100)}%`} />
          </div>

          <Button
            type="button"
            variant={cameraStatus === "ready" ? "outline" : "default"}
            disabled={!ARCADE_CONFIG.faceEnabled || cameraStatus === "loading" || trackerStatus === "loading"}
            onClick={cameraStatus === "ready" ? () => stopFaceCamera() : startFaceCamera}
          >
            {cameraStatus === "ready" ? <CameraOff data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
            {cameraStatus === "ready" ? "Camera off" : cameraStatus === "loading" ? "Loading" : "Camera"}
          </Button>

          <div data-testid="face-expression-ranking" className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase text-muted-foreground">
              <span>Expression match</span>
              <span>High to low</span>
            </div>
            <div className="grid grid-cols-4 gap-1" role="list" aria-label="Expression matches ranked from high to low">
              {faceExpressionRanking.map((match, index) => (
                <div
                  key={match.expression}
                  data-expression={match.expression}
                  data-confidence={match.confidence}
                  data-rank={index + 1}
                  role="listitem"
                  aria-label={`${index + 1}. ${formatFaceRhythmPose(match.expression)}, ${facePresent ? Math.round(match.confidence * 100) : 0}% match`}
                  title={`${formatFaceRhythmPose(match.expression)}: ${facePresent ? Math.round(match.confidence * 100) : 0}%`}
                  className="grid min-w-0 justify-items-center gap-1"
                >
                  <AvatarSprite
                    asset={avatarAsset}
                    manifest={manifest}
                    expression={match.expression}
                    className={cn("size-10 transition-[box-shadow,transform] duration-150 min-[1100px]:size-12", facePresent && index === 0 && "scale-105 ring-2 ring-primary ring-offset-2")}
                  />
                  <span className={cn("font-mono text-[9px] font-black", facePresent && index === 0 ? "text-primary" : "text-muted-foreground")}>
                    {facePresent ? `${Math.round(match.confidence * 100)}%` : "--"}
                  </span>
                  <span className="w-full truncate text-center text-[8px] font-black text-muted-foreground">
                    {formatFaceRhythmPose(match.expression)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </GameShell>
  );
}

function FaceRhythmReadout({
  label,
  expression,
  avatarAsset,
  manifest,
  active
}: {
  label: string;
  expression: FaceRhythmExpression;
  avatarAsset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
  active: boolean;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1.5", active ? "bg-white/15" : "bg-white/5")}>
      <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="size-10" />
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase text-white/60">{label}</span>
        <span className="block truncate text-xs font-black">{formatFaceRhythmPose(expression)}</span>
      </span>
    </div>
  );
}

function FaceTelemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 px-1">
      <span className="text-[8px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="text-[10px] font-black">{value}</span>
    </div>
  );
}

function DirectionalControlMeter({ label, value }: { label: string; value: number }) {
  const clampedValue = clampUnit(value);
  const fillStyle: CSSProperties = clampedValue < 0
    ? { left: `${50 + clampedValue * 50}%`, width: `${Math.abs(clampedValue) * 50}%` }
    : { left: "50%", width: `${clampedValue * 50}%` };
  const labelText = clampedValue < -0.12 ? "Left" : clampedValue > 0.12 ? "Right" : "Center";

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-bold uppercase text-muted-foreground">{label}</span>
        <span className="text-[9px] font-black uppercase">{labelText}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-background shadow-inner">
        <span className="absolute left-1/2 top-0 z-10 h-full w-px bg-foreground/45" />
        <span className="absolute top-0 h-full rounded-full bg-primary transition-all" style={fillStyle} />
      </div>
      <div className="grid grid-cols-3 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Left</span>
        <span className="text-center">Zero</span>
        <span className="text-right">Right</span>
      </div>
    </div>
  );
}

function LinearControlMeter({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald";
}) {
  const clampedValue = clampUnit(value);
  return (
    <div className="grid gap-1">
      <span className="text-[8px] font-bold uppercase text-muted-foreground">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-background shadow-inner">
        <div
          className={cn("h-full rounded-full transition-[width]", tone === "amber" ? "bg-amber-400" : "bg-emerald-500")}
          style={{ width: `${clampedValue * 100}%` }}
        />
      </div>
    </div>
  );
}

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function MemoryMatchGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("memory-match");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const deckSeedRef = useRef(Math.floor(Math.random() * 1_000_000_000));
  const [deck, setDeck] = useState(() => createMemoryMatchDeck(MEMORY_EXPRESSIONS, deckSeedRef.current));
  const [selected, setSelected] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [remaining, setRemaining] = useState(MEMORY_MATCH_DURATION_SECONDS);
  const [expression, setExpression] = useState<AvatarExpression>("neutral");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [redealPhase, setRedealPhase] = useState<"idle" | "hold" | "flipping">("idle");
  const memoryAvatarManifest = useMemo(
    () => avatarAsset.spriteSheet ? spriteSheetToAvatarManifest(avatarAsset.spriteSheet) : manifest,
    [avatarAsset.spriteSheet, manifest]
  );

  function dealFreshDeck() {
    deckSeedRef.current += 1;
    setDeck(createMemoryMatchDeck(MEMORY_EXPRESSIONS, deckSeedRef.current));
    setSelected([]);
    setMatched([]);
  }

  function restart() {
    setRunId((value) => value + 1);
    setStatus("ready");
    dealFreshDeck();
    setScore(0);
    setMistakes(0);
    setRemaining(MEMORY_MATCH_DURATION_SECONDS);
    setExpression("neutral");
    setStartedAt(0);
    setEndedAt(0);
    setRedealPhase("idle");
  }

  function start() {
    if (status === "ended" || remaining === 0) {
      setRunId((value) => value + 1);
      dealFreshDeck();
      setScore(0);
      setMistakes(0);
      setRemaining(MEMORY_MATCH_DURATION_SECONDS);
      setExpression("neutral");
      setEndedAt(0);
      setStartedAt(performance.now());
      setRedealPhase("idle");
      setStatus("running");
      return;
    }
    setStatus("running");
    setStartedAt((value) => value || performance.now());
  }

  function flip(cardId: string) {
    if (status !== "running" || redealPhase !== "idle") {
      return;
    }
    if (matched.includes(cardId) || selected.includes(cardId) || selected.length >= 2) {
      return;
    }
    const nextSelected = [...selected, cardId];
    setSelected(nextSelected);
    if (nextSelected.length === 2) {
      const [a, b] = nextSelected.map((id) => deck.find((card) => card.id === id));
      if (a && b && getAvatarVisualMatchKey(memoryAvatarManifest, a.expression) === getAvatarVisualMatchKey(memoryAvatarManifest, b.expression)) {
        setMatched((ids) => [...ids, a.id, b.id]);
        setScore((value) => value + scoreMemoryMatchPair(remaining, MEMORY_MATCH_DURATION_SECONDS));
        setExpression("excited");
        setSelected([]);
      } else {
        setMistakes((value) => value + 1);
        setExpression("sad");
        window.setTimeout(() => setSelected([]), 1000);
      }
    }
  }

  useEffect(() => {
    if (status !== "running" || redealPhase !== "idle" || matched.length !== deck.length) {
      return;
    }
    setRedealPhase("hold");
  }, [deck.length, matched.length, redealPhase, status]);

  useEffect(() => {
    if (status !== "running" || redealPhase === "idle") {
      return;
    }
    if (redealPhase === "hold") {
      const holdTimeout = window.setTimeout(() => {
        setSelected([]);
        setMatched([]);
        setRedealPhase("flipping");
      }, 700);
      return () => window.clearTimeout(holdTimeout);
    }
    const shuffleTimeout = window.setTimeout(() => {
      deckSeedRef.current += 1;
      setDeck(createMemoryMatchDeck(MEMORY_EXPRESSIONS, deckSeedRef.current));
      setExpression("neutral");
      setRedealPhase("idle");
    }, 550);
    return () => window.clearTimeout(shuffleTimeout);
  }, [redealPhase, status]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setStatus("ended");
          setEndedAt(performance.now());
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [status]);

  const finalEntry = status === "ended"
    ? makeEntry("memory-match", playerName, score, startedAt, endedAt, -mistakes)
    : null;
  const tensionLevel = getMemoryTensionLevel(remaining, status === "running");

  return (
    <GameShell {...config} status={status} score={score} timerLabel={`Time ${formatCountdown(remaining)}`} tensionLevel={tensionLevel} sensorLabel={`${mistakes} mistakes`} expression={expression} runId={runId} finalEntry={finalEntry} onStart={start} onPause={() => setStatus("paused")} onRestart={restart}>
      <div
        data-testid="memory-match-board"
        className={cn("memory-match-board relative grid h-full min-h-[420px]", tensionLevel !== "calm" && "memory-tension-surface", `memory-tension-${tensionLevel}`)}
      >
        {deck.map((card) => {
          const visible = selected.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className="memory-match-card group grid place-self-center rounded-full bg-transparent outline-none transition hover:scale-[1.03] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:scale-100"
              onClick={() => flip(card.id)}
              onDragStart={(event) => event.preventDefault()}
              aria-label={`Flip ${card.expression}`}
              data-testid="memory-match-card"
              disabled={status !== "running" || redealPhase !== "idle"}
              style={{ perspective: "900px" }}
            >
              <span
                className="relative block size-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                style={{
                  transform: visible ? "rotateY(180deg)" : "rotateY(0deg)",
                  transformStyle: "preserve-3d",
                  willChange: "transform"
                }}
              >
                <span
                  className="absolute inset-0 grid size-full place-items-center overflow-hidden rounded-full bg-[#101720] shadow-sm"
                  style={{ backfaceVisibility: "hidden" }}
                  aria-hidden={visible}
                >
                  <img src={prompthonSquareDarkLogo} alt="" className="size-1/2 object-contain" aria-hidden="true" draggable={false} />
                </span>
                <span
                  className="absolute inset-0 block size-full"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  aria-hidden={!visible}
                >
                  <AvatarSprite asset={avatarAsset} manifest={manifest} expression={card.expression} className="size-full" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}

function WhackAvatarGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("whack-avatar");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(WHACK_DURATION_SECONDS);
  const [roundSeed, setRoundSeed] = useState(0);
  const [targetSeed, setTargetSeed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [expression, setExpression] = useState<AvatarExpression>("neutral");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [levelBreakRemaining, setLevelBreakRemaining] = useState(0);
  const [mode, setMode] = useState<WhackMode | null>(null);
  const [endlessLevel, setEndlessLevel] = useState(1);
  const [readyScreen, setReadyScreen] = useState<"welcome" | "mode">("welcome");
  const [showEndlessLevels, setShowEndlessLevels] = useState(false);
  const level = mode === "levels" ? getWhackLevel(remaining) : mode === "endless" ? endlessLevel : 1;
  const expressionPool = getWhackExpressionPool(level);
  const target = getWhackTarget(targetSeed, expressionPool);
  const visible = useMemo(() => createWhackState(roundSeed, target, expressionPool), [expressionPool, roundSeed, target]);
  const isLevelBreak = status === "running" && levelBreakRemaining > 0;

  function restart() {
    setRunId((value) => value + 1);
    setStatus("ready");
    setScore(0);
    setRemaining(WHACK_DURATION_SECONDS);
    setRoundSeed(0);
    setTargetSeed(0);
    setStreak(0);
    setHits(0);
    setAttempts(0);
    setFeedback("idle");
    setExpression("neutral");
    setStartedAt(0);
    setEndedAt(0);
    setLevelBreakRemaining(0);
    setMode(null);
    setEndlessLevel(1);
    setReadyScreen("welcome");
    setShowEndlessLevels(false);
  }

  function start(nextMode: WhackMode = "levels", nextEndlessLevel = 1) {
    setMode(nextMode);
    setEndlessLevel(Math.max(1, Math.min(WHACK_LEVEL_COUNT, nextEndlessLevel)));
    setShowEndlessLevels(false);
    setRemaining(nextMode === "levels" ? WHACK_DURATION_SECONDS : 0);
    setStatus("running");
    setStartedAt((value) => value || performance.now());
  }

  function hit(index: number) {
    if (status !== "running" || isLevelBreak) {
      return;
    }
    const visibleExpression = visible[index];
    if (!visibleExpression) {
      setAttempts((value) => value + 1);
      setStreak(0);
      setExpression("sad");
      setFeedback("wrong");
      setRoundSeed((value) => value + 1);
      return;
    }
    const result = scoreWhackHit({ visibleExpression, targetExpression: target, currentScore: score });
    setAttempts((value) => value + 1);
    setScore(result.score);
    if (result.correct) {
      setHits((value) => value + 1);
      setStreak((value) => value + 1);
      setExpression("excited");
      setFeedback("correct");
      setTargetSeed((value) => value + 1);
      setRoundSeed((value) => value + 1);
    } else {
      setStreak(0);
      setExpression("sad");
      setFeedback("wrong");
      setRoundSeed((value) => value + 1);
    }
  }

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const timerId = window.setInterval(() => {
      if (levelBreakRemaining > 0) {
        setLevelBreakRemaining((value) => Math.max(0, value - 1));
        return;
      }
      if (mode === "endless") {
        return;
      }
      setRemaining((value) => {
        if (value <= 1) {
          setStatus("ended");
          setEndedAt(performance.now());
          return 0;
        }
        const nextValue = value - 1;
        if (mode === "levels" && nextValue > 0 && nextValue % WHACK_LEVEL_DURATION_SECONDS === 0) {
          setLevelBreakRemaining(WHACK_LEVEL_BREAK_SECONDS);
          setStreak(0);
          setFeedback("idle");
        }
        return nextValue;
      });
    }, 1000);
    const popupId = levelBreakRemaining > 0
      ? null
      : window.setInterval(() => {
          setRoundSeed((value) => value + 1);
          setStreak(0);
          setFeedback("idle");
        }, getWhackPopupIntervalMs(level));
    return () => {
      window.clearInterval(timerId);
      if (popupId !== null) {
        window.clearInterval(popupId);
      }
    };
  }, [level, levelBreakRemaining, mode, status]);

  useEffect(() => {
    if (feedback === "idle") {
      return;
    }
    const timeoutId = window.setTimeout(() => setFeedback("idle"), 320);
    return () => window.clearTimeout(timeoutId);
  }, [feedback, roundSeed]);

  const accuracy = attempts > 0 ? hits / attempts : 0;
  const finalEntry = status === "ended"
    ? makeEntry("whack-avatar", playerName, score, startedAt, endedAt, streak, accuracy)
    : null;

  return (
    <GameShell
      {...config}
      status={status}
      score={score}
      timerLabel={mode === "endless" ? "Endless" : mode === "levels" ? `${remaining}s` : "Choose mode"}
      sensorLabel={`Target ${formatExpression(target)}`}
      expression={expression}
      runId={runId}
      finalEntry={finalEntry}
      showStartOverlay={false}
      onStart={() => start(mode ?? "levels")}
      onPause={() => setStatus("paused")}
      onRestart={restart}
    >
      <div className={cn("grid h-full min-h-[420px] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-[#fff2f7]", feedback === "correct" && "bg-emerald-50/70", feedback === "wrong" && "bg-red-50/70")}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border-2 border-[#07111f] bg-[#ffeaf2] px-4 py-3 max-sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10">
              <Target className="size-5 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-muted-foreground">Whack this face</span>
              <span className="block truncate text-sm font-black">{formatExpression(target)}</span>
            </span>
            <AvatarSprite asset={avatarAsset} manifest={manifest} expression={target} className="size-28 shrink-0" showExpressionOverlay />
          </div>
          <div className="grid min-w-16 justify-items-center rounded-md bg-[#ffd6e7] px-3 py-2">
            <span className="text-[9px] font-black uppercase text-muted-foreground">Level</span>
            <span className="text-lg font-black">{level}</span>
          </div>
          <div className="grid min-w-16 justify-items-center rounded-md bg-[#ffd6e7] px-3 py-2">
            <span className="text-[9px] font-black uppercase text-muted-foreground">Streak</span>
            <span className="text-lg font-black">{streak}</span>
          </div>
          <div className="grid min-w-16 justify-items-center rounded-md bg-[#ffd6e7] px-3 py-2 max-sm:hidden">
            <span className="text-[9px] font-black uppercase text-muted-foreground">Hit rate</span>
            <span className="text-lg font-black">{Math.round(accuracy * 100)}%</span>
          </div>
        </div>

        <div data-testid="whack-avatar-board" className="relative grid min-h-0 grid-cols-3 grid-rows-3 gap-3 rounded-lg border-2 border-[#07111f] bg-[#ffd6e7] p-3">
          {visible.map((visibleExpression, index) => (
            <button
              key={index}
              type="button"
              className="group relative grid min-h-0 place-items-center overflow-hidden rounded-md border border-[#07111f]/20 bg-[#ffeaf2] p-2 shadow-sm transition hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => hit(index)}
              aria-label={visibleExpression ? `Whack ${formatExpression(visibleExpression)}` : `Empty hole ${index + 1}`}
              data-expression={visibleExpression ?? "empty"}
              data-target={visibleExpression === target ? "true" : "false"}
            >
              {visibleExpression ? (
                <span className="relative z-10 grid min-h-0 place-items-center gap-1">
                  <AvatarSprite
                    asset={avatarAsset}
                    manifest={manifest}
                    expression={visibleExpression}
                    className="size-[min(22cqh,9rem)] transition-transform duration-150 group-hover:scale-105"
                    showExpressionOverlay
                  />
                  <span className="max-w-full rounded bg-white/80 px-2 py-1 text-xs font-black uppercase leading-none text-[#07111f] shadow-sm">
                    {formatExpression(visibleExpression)}
                  </span>
                </span>
              ) : null}
            </button>
          ))}
          {isLevelBreak ? (
            <div className="absolute inset-0 z-40 grid place-items-center bg-[#ffd6e7]/95 p-6 text-center backdrop-blur-sm">
              <div className="grid max-w-sm justify-items-center gap-3 rounded-lg border-2 border-[#07111f] bg-[#ffeaf2] px-8 py-7 shadow-lg">
                <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Rest break</div>
                <div className="text-3xl font-black text-[#07111f]">Starting Level {level}</div>
                <div className="text-sm font-bold text-muted-foreground">Commencing in</div>
                <div className="grid size-16 place-items-center rounded-full bg-primary text-3xl font-black text-primary-foreground">
                  {levelBreakRemaining}
                </div>
              </div>
            </div>
          ) : null}
          {status === "ready" ? (
            <div className="absolute inset-0 z-50 grid place-items-center bg-[#ffd6e7]/95 p-6 text-center backdrop-blur-sm">
              {readyScreen === "welcome" ? (
                <div className="grid w-full max-w-md justify-items-center gap-5 rounded-lg border-2 border-[#07111f] bg-[#ffeaf2] p-8 shadow-lg">
                  <AvatarSprite asset={avatarAsset} manifest={manifest} expression="excited" className="size-32" showExpressionOverlay />
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Whack Avatar</div>
                    <div className="mt-1 text-4xl font-black text-[#07111f]">Welcome to Wack the Avatar</div>
                  </div>
                  <Button
                    type="button"
                    className="h-14 min-w-36 bg-[#ff8fbd] text-lg font-black text-[#07111f] hover:bg-[#ff7ab1]"
                    onClick={() => {
                      setReadyScreen("mode");
                      setShowEndlessLevels(false);
                    }}
                  >
                    Play
                  </Button>
                </div>
              ) : (
                <div className="grid w-full max-w-xl gap-4 rounded-lg border-2 border-[#07111f] bg-[#ffeaf2] p-6 shadow-lg">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Choose Whack Avatar mode</div>
                    <div className="mt-1 text-3xl font-black text-[#07111f]">New Round</div>
                  </div>
                  <div className="grid gap-3">
                    <Button type="button" className="h-auto flex-col gap-1 bg-[#ff8fbd] py-5 text-[#07111f] hover:bg-[#ff7ab1]" onClick={() => start("levels")}>
                      <span className="text-base font-black">5 Level Journey</span>
                      <span className="text-xs font-semibold opacity-85">15 seconds per level</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto flex-col gap-1 border-2 border-[#07111f] bg-[#fff2f7] py-5 text-[#07111f] hover:bg-white"
                      onClick={() => setShowEndlessLevels((value) => !value)}
                    >
                      <span className="text-base font-black">Endless Practice</span>
                      <span className="text-xs font-semibold text-muted-foreground">Choose a level to repeat forever</span>
                    </Button>
                    {showEndlessLevels ? (
                      <div className="grid gap-2 rounded-md border-2 border-[#07111f] bg-[#ffd6e7] p-3">
                        <div className="text-sm font-black text-[#07111f]">Pick Endless Level</div>
                        <div className="grid grid-cols-5 gap-2 max-sm:grid-cols-2">
                          {Array.from({ length: WHACK_LEVEL_COUNT }, (_, levelIndex) => levelIndex + 1).map((levelNumber) => (
                            <Button
                              key={levelNumber}
                              type="button"
                              variant="outline"
                              className="h-12 border-2 border-[#07111f] bg-[#ffeaf2] text-sm font-black text-[#07111f] hover:bg-white"
                              onClick={() => start("endless", levelNumber)}
                            >
                              Level {levelNumber}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </GameShell>
  );
}

function CoinCatchGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("avatar-pong");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [motion, setMotion] = useState<CoinCatchMotion>(COIN_CATCH_INITIAL_MOTION);
  const [items, setItems] = useState<CoinCatchItem[]>([]);
  const [cameraStatus, setCameraStatus] = useState<PoseCameraStatus>("off");
  const [trackerStatus, setTrackerStatus] = useState<VisionTrackerStatus>("idle");
  const [sensorLabel, setSensorLabel] = useState("Camera on play");
  const [poseDirection, setPoseDirection] = useState<"left" | "center" | "right">("center");
  const [moveBalance, setMoveBalance] = useState(0);
  const [runIntensity, setRunIntensity] = useState(0);
  const [lastCatch, setLastCatch] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [expression, setExpression] = useState<AvatarExpression>("happy");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const poseFrameRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const lastPoseSampleAtRef = useRef(0);
  const previousPoseSampleRef = useRef<CoinCatchPoseSample | null>(null);
  const poseCenterRef = useRef<number | null>(null);
  const poseControlRef = useRef<CoinCatchPoseControl>({ direction: 0, runIntensity: 0, centerX: 0.5 });
  const keyboardDirectionRef = useRef(0);
  const motionRef = useRef<CoinCatchMotion>(COIN_CATCH_INITIAL_MOTION);
  const itemsRef = useRef<CoinCatchItem[]>([]);
  const scoreRef = useRef(0);
  const spawnIndexRef = useRef(0);
  const isPoseControlActive = cameraStatus === "ready" && trackerStatus === "ready";

  function restart() {
    stopCoinCamera();
    setRunId((value) => value + 1);
    setStatus("ready");
    setScore(0);
    scoreRef.current = 0;
    setElapsed(0);
    setMotion(COIN_CATCH_INITIAL_MOTION);
    motionRef.current = COIN_CATCH_INITIAL_MOTION;
    setItems([]);
    itemsRef.current = [];
    spawnIndexRef.current = 0;
    keyboardDirectionRef.current = 0;
    poseControlRef.current = { direction: 0, runIntensity: 0, centerX: 0.5 };
    poseCenterRef.current = null;
    setPoseDirection("center");
    setMoveBalance(0);
    setRunIntensity(0);
    setLastCatch("");
    setStartedAt(0);
    setEndedAt(0);
    setExpression("happy");
  }

  function start() {
    if (status === "ended") {
      restart();
    }
    if (itemsRef.current.length === 0) {
      const firstItem = createCoinCatchItem(spawnIndexRef.current, scoreRef.current, true);
      spawnIndexRef.current += 1;
      itemsRef.current = [firstItem];
      setItems([firstItem]);
    }
    setStatus("running");
    setStartedAt((value) => value || performance.now());
    if (cameraStatus !== "loading" && trackerStatus !== "loading" && (cameraStatus !== "ready" || trackerStatus !== "ready")) {
      void startCoinCamera();
    }
  }

  function pause() {
    setStatus("paused");
  }

  async function startCoinCamera() {
    if (cameraStatus === "loading" || trackerStatus === "loading") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      setSensorLabel("Camera unavailable");
      return;
    }

    if (!cameraStreamRef.current) {
      setCameraStatus("loading");
      setSensorLabel("Starting camera");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("ready");
        setSensorLabel("Camera live · Loading body tracker");
      } catch (error) {
        const isPermissionError = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        stopCoinCamera(isPermissionError ? "blocked" : "error");
        setSensorLabel(isPermissionError ? "Camera blocked · Allow access and retry" : "Camera unavailable · Check that it is connected");
        return;
      }
    }

    if (poseLandmarkerRef.current) {
      setTrackerStatus("ready");
      previousPoseSampleRef.current = null;
      poseCenterRef.current = null;
      lastPoseSampleAtRef.current = 0;
      setSensorLabel("Stand in frame");
      runCoinPoseLoop();
      return;
    }

    setTrackerStatus("loading");
    setSensorLabel("Camera live · Loading body tracker");
    try {
      const { FilesetResolver, PoseLandmarker: PoseLandmarkerTask } = await import("@mediapipe/tasks-vision");
      if (!poseLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(POSE_LANDMARKER_WASM_URL);
        poseLandmarkerRef.current = await PoseLandmarkerTask.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_LANDMARKER_MODEL_URL,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        });
      }
      previousPoseSampleRef.current = null;
      poseCenterRef.current = null;
      lastPoseSampleAtRef.current = 0;
      setTrackerStatus("ready");
      setSensorLabel("Stand in frame");
      runCoinPoseLoop();
    } catch (error) {
      setTrackerStatus("error");
      setSensorLabel("Camera live · Body tracking unavailable");
    }
  }

  function stopCoinCamera(nextStatus: PoseCameraStatus = "off") {
    if (poseFrameRef.current !== null) {
      cancelAnimationFrame(poseFrameRef.current);
      poseFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    previousPoseSampleRef.current = null;
    poseCenterRef.current = null;
    poseControlRef.current = { direction: 0, runIntensity: 0, centerX: 0.5 };
    setPoseDirection("center");
    setMoveBalance(0);
    setRunIntensity(0);
    drawStellarSkeleton(skeletonCanvasRef.current, undefined);
    setCameraStatus(nextStatus);
    setTrackerStatus(poseLandmarkerRef.current ? "ready" : "idle");
    if (nextStatus === "off") {
      setSensorLabel("Camera off");
    }
  }

  function runCoinPoseLoop() {
    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = poseLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        poseFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      const now = performance.now();
      if (now - lastPoseSampleAtRef.current < COIN_CATCH_POSE_INTERVAL_MS) {
        poseFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      lastPoseSampleAtRef.current = now;
      try {
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.landmarks[0];
        drawStellarSkeleton(skeletonCanvasRef.current, landmarks);
        if (!landmarks?.length) {
          poseControlRef.current = {
            ...poseControlRef.current,
            direction: poseControlRef.current.direction * 0.7,
            runIntensity: poseControlRef.current.runIntensity * 0.7
          };
          setPoseDirection("center");
          setMoveBalance(poseControlRef.current.direction);
          setRunIntensity(0);
          setSensorLabel("Find your body");
        } else {
          const control = getCoinCatchPoseControl(landmarks, previousPoseSampleRef.current, now, poseCenterRef.current);
          if (poseCenterRef.current === null) {
            poseCenterRef.current = control.centerX;
          }
          const smoothedControl = {
            direction: poseControlRef.current.direction * 0.55 + control.direction * 0.45,
            runIntensity: poseControlRef.current.runIntensity * 0.6 + control.runIntensity * 0.4,
            centerX: control.centerX
          };
          poseControlRef.current = smoothedControl;
          previousPoseSampleRef.current = { landmarks, capturedAt: now };
          const nextDirection = smoothedControl.direction < -0.12 ? "left" : smoothedControl.direction > 0.12 ? "right" : "center";
          setPoseDirection(nextDirection);
          setMoveBalance(smoothedControl.direction);
          setRunIntensity(smoothedControl.runIntensity);
          setSensorLabel(nextDirection === "center" ? "Stand center" : `Move ${nextDirection}`);
        }
      } catch {
        stopCoinCamera("error");
        setSensorLabel("Body tracking failed");
        return;
      }
      poseFrameRef.current = requestAnimationFrame(detectFrame);
    };

    if (poseFrameRef.current !== null) {
      cancelAnimationFrame(poseFrameRef.current);
    }
    poseFrameRef.current = requestAnimationFrame(detectFrame);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keyboardDirectionRef.current = -1;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keyboardDirectionRef.current = 1;
      if (event.code === "Space" && status !== "running") {
        start();
      }
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (["arrowleft", "arrowright", "a", "d"].includes(event.key.toLowerCase())) {
        keyboardDirectionRef.current = 0;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    let animationFrame = 0;
    let previousFrameAt = performance.now();
    let spawnAccumulator = 0;
    const tick = (now: number) => {
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - previousFrameAt) / 1000));
      previousFrameAt = now;
      const control = isPoseControlActive
        ? poseControlRef.current
        : { direction: keyboardDirectionRef.current, runIntensity: Math.abs(keyboardDirectionRef.current), centerX: 0.5 };
      if (!isPoseControlActive) {
        setPoseDirection(control.direction < -0.12 ? "left" : control.direction > 0.12 ? "right" : "center");
        setMoveBalance(control.direction);
        setRunIntensity(control.runIntensity);
      }
      const nextMotion = stepCoinCatchMotion({
        motion: motionRef.current,
        direction: control.direction,
        runIntensity: control.runIntensity,
        deltaSeconds
      });
      motionRef.current = nextMotion;
      setMotion(nextMotion);
      setElapsed(Math.max(0, (now - (startedAt || now)) / 1000));

      spawnAccumulator += deltaSeconds;
      let nextItems = itemsRef.current;
      const spawnInterval = Math.max(0.48, 0.88 - scoreRef.current * 0.006);
      if (spawnAccumulator >= spawnInterval) {
        spawnAccumulator = 0;
        nextItems = [...nextItems, createCoinCatchItem(spawnIndexRef.current, scoreRef.current)];
        spawnIndexRef.current += 1;
      }

      let gainedScore = 0;
      let hitBomb = false;
      nextItems = nextItems.flatMap((item) => {
        const movedItem = { ...item, y: item.y + item.speed * deltaSeconds };
        if (coinCatchItemHitsAvatar(movedItem, nextMotion.x)) {
          const result = resolveCoinCatchItem(movedItem.kind, movedItem.value);
          hitBomb ||= result.gameOver;
          gainedScore += result.points;
          return [];
        }
        return movedItem.y - movedItem.size / 2 > 1.08 ? [] : [movedItem];
      });
      itemsRef.current = nextItems;
      setItems(nextItems);

      if (gainedScore > 0) {
        scoreRef.current += gainedScore;
        setScore(scoreRef.current);
        setExpression("excited");
        setLastCatch(`+${gainedScore}`);
      }
      if (hitBomb) {
        setStatus("ended");
        setExpression("dizzy");
        setLastCatch("BOOM");
        setEndedAt(now);
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPoseControlActive, startedAt, status]);

  useEffect(() => {
    if (!lastCatch || lastCatch === "BOOM") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLastCatch("");
      setExpression("happy");
    }, 520);
    return () => window.clearTimeout(timeoutId);
  }, [lastCatch]);

  useEffect(() => {
    if (status === "ended") {
      stopCoinCamera();
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (poseFrameRef.current !== null) {
        cancelAnimationFrame(poseFrameRef.current);
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      poseLandmarkerRef.current?.close();
    };
  }, []);

  const finalEntry = status === "ended"
    ? makeEntry("avatar-pong", playerName, score, startedAt, endedAt, Math.round(elapsed))
    : null;
  const velocityPercent = Math.min(100, Math.round(Math.abs(motion.velocity) / 0.405 * 100));

  return (
    <GameShell {...config} status={status} score={score} timerLabel={`${Math.floor(elapsed)}s`} sensorLabel={sensorLabel} expression={expression} hideStatusBar showStartOverlay={false} runId={runId} finalEntry={finalEntry} onStart={start} onPause={pause} onRestart={restart}>
      <div className="grid h-full min-h-[420px] grid-cols-[minmax(0,1fr)_290px] gap-3 max-md:grid-cols-[minmax(0,1fr)_250px] max-sm:grid-cols-1">
        <div data-testid="coin-catch-stage" className="relative min-h-[420px] overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#10231d]">
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage: "linear-gradient(rgba(134,239,172,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.12) 1px, transparent 1px)",
              backgroundSize: "36px 36px"
            }}
          />
          <div className="absolute inset-x-0 top-0 h-24 bg-black/25" />
          <div className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-white backdrop-blur">
            <Button type="button" variant="outline" size="icon" className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" aria-label={status === "running" ? "Pause Coin Catch" : "Play Coin Catch"} title={status === "running" ? "Pause" : "Play"} onClick={status === "running" ? pause : start}>
              {status === "running" ? <Pause /> : <Play />}
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" aria-label="Reset Coin Catch" title="Reset" onClick={restart}>
              <RotateCcw />
            </Button>
            <div className="flex min-w-12 items-center justify-center gap-1 rounded-full bg-white/10 px-2 text-xs font-black">
              <Coins className="size-3.5 text-amber-300" />
              {score}
            </div>
          </div>

          <div className="absolute left-4 top-4 z-30 rounded-md border border-emerald-200/20 bg-black/45 px-2.5 py-1.5 font-mono text-[10px] font-bold text-emerald-100">
            SPEED {String(velocityPercent).padStart(3, "0")}%
          </div>
          <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-md border border-red-200/20 bg-black/45 px-2.5 py-1.5 text-[10px] font-bold text-red-100">
            <ShieldAlert className="size-3.5" /> BOMB = GAME OVER
          </div>

          {items.map((item) => (
            <CoinCatchFallingItem key={item.id} item={item} />
          ))}

          <div className="absolute inset-x-[7%] bottom-[5%] h-px bg-emerald-100/25" />
          <CoinCatchRunner avatarAsset={avatarAsset} manifest={manifest} expression={expression} motion={motion} runIntensity={isPoseControlActive ? runIntensity : Math.abs(keyboardDirectionRef.current)} />
          {lastCatch ? (
            <div className={cn("pointer-events-none absolute left-1/2 top-[42%] z-40 -translate-x-1/2 text-4xl font-black", lastCatch === "BOOM" ? "text-red-400" : "text-amber-300")}>
              {lastCatch}
            </div>
          ) : null}

          <div className="absolute inset-x-4 bottom-3 z-30 grid gap-1.5 rounded-md border border-white/15 bg-black/55 px-3 py-2 text-white backdrop-blur">
            <div className="flex items-center justify-between text-[10px] font-black">
              <span>{poseDirection === "center" ? "STANDING" : `RUNNING ${poseDirection.toUpperCase()}`}</span>
              <span>{Math.round(runIntensity * 100)}% BODY SPEED</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${velocityPercent}%` }} />
            </div>
          </div>
          {status === "ready" ? <GameStartOverlay onStart={start} className="inset-0" /> : null}
        </div>

        <aside data-testid="coin-catch-camera" data-camera-status={cameraStatus} className="grid content-start gap-3 rounded-lg border-2 border-[#07111f] bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black"><MoveHorizontal className="size-4 text-primary" /> Body control</div>
            <Badge variant={cameraStatus === "ready" ? "default" : "secondary"} className="font-mono text-[9px]">{cameraStatus === "ready" ? "LIVE" : cameraStatus.toUpperCase()}</Badge>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-emerald-950/40 bg-[#07111f]">
            <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(rgba(134,239,172,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.1) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <video ref={videoRef} className={cn("absolute inset-0 size-full -scale-x-100 object-cover transition-opacity", cameraStatus === "ready" ? "opacity-70" : "opacity-0")} muted playsInline aria-label="Coin Catch body camera preview" />
            <canvas ref={skeletonCanvasRef} className={cn("absolute inset-0 size-full -scale-x-100", cameraStatus === "ready" ? "opacity-100" : "opacity-0")} aria-hidden="true" />
            <div className="pointer-events-none absolute inset-3 border border-emerald-200/20">
              <span className="absolute left-1/2 top-0 h-full border-l border-dashed border-emerald-100/30" />
              <span className="absolute left-0 top-1/2 w-full border-t border-dashed border-emerald-100/20" />
            </div>
            {cameraStatus !== "ready" ? (
              <div className="absolute inset-0 grid place-items-center text-emerald-50/70">
                <div className="grid justify-items-center gap-2 text-center"><Camera className="size-9" /><span className="max-w-40 text-xs font-black">{sensorLabel}</span></div>
              </div>
            ) : null}
            {cameraStatus === "ready" && trackerStatus !== "ready" ? (
              <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-black text-emerald-50 backdrop-blur">
                {sensorLabel}
              </div>
            ) : null}
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded bg-black/65 px-2 py-1.5 text-[10px] font-black text-white backdrop-blur">
              <span>{poseDirection === "center" ? "STAND" : poseDirection.toUpperCase()}</span>
              <span className="font-mono text-emerald-100">RUN {Math.round(runIntensity * 100)}%</span>
            </div>
          </div>
          <div className="grid gap-2 rounded-md border border-input bg-muted/55 p-2">
            <DirectionalControlMeter label="Move" value={moveBalance} />
            <LinearControlMeter label="Run" value={runIntensity} tone="emerald" />
            <LinearControlMeter label="Speed" value={velocityPercent / 100} tone="amber" />
          </div>
          <Button type="button" variant={cameraStatus === "ready" ? "outline" : "default"} disabled={cameraStatus === "loading" || trackerStatus === "loading"} onClick={cameraStatus === "ready" ? () => stopCoinCamera() : startCoinCamera}>
            {cameraStatus === "ready" ? <CameraOff data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
            {cameraStatus === "ready" ? "Camera off" : cameraStatus === "loading" ? "Loading" : "Camera"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={isPoseControlActive} onPointerDown={() => { keyboardDirectionRef.current = -1; }} onPointerUp={() => { keyboardDirectionRef.current = 0; }} onPointerLeave={() => { keyboardDirectionRef.current = 0; }}><MoveHorizontal className="rotate-180" /> Left</Button>
            <Button type="button" variant="outline" disabled={isPoseControlActive} onPointerDown={() => { keyboardDirectionRef.current = 1; }} onPointerUp={() => { keyboardDirectionRef.current = 0; }} onPointerLeave={() => { keyboardDirectionRef.current = 0; }}><MoveHorizontal /> Right</Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-md bg-muted p-2 text-center">
            {COIN_CATCH_VALUES.map((value) => <div key={value} className="grid justify-items-center gap-1"><CircleDollarSign className={cn("text-amber-500", value === 1 ? "size-4" : value === 3 ? "size-5" : "size-6")} /><span className="text-[9px] font-black">+{value}</span></div>)}
          </div>
        </aside>
      </div>
    </GameShell>
  );
}

function CoinCatchFallingItem({ item }: { item: CoinCatchItem }) {
  return (
    <div
      role="img"
      aria-label={item.kind === "bomb" ? "Falling bomb" : `Falling coin worth ${item.value}`}
      data-kind={item.kind}
      data-value={item.value}
      className={cn(
        "pointer-events-none absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-lg",
        item.kind === "bomb"
          ? "border-red-300 bg-[#111827] text-red-400 shadow-red-950/50"
          : "border-amber-100 bg-[#f6c344] text-[#3d2b00] shadow-amber-950/30"
      )}
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        width: `${item.size * 100}%`,
        aspectRatio: "1"
      }}
    >
      {item.kind === "bomb" ? (
        <Bomb className="size-[60%]" />
      ) : (
        <>
          <CircleDollarSign className="size-[60%]" />
          <span className="absolute -bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black text-white">+{item.value}</span>
        </>
      )}
    </div>
  );
}

function CoinCatchRunner({
  avatarAsset,
  manifest,
  expression,
  motion,
  runIntensity
}: {
  avatarAsset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
  expression: AvatarExpression;
  motion: CoinCatchMotion;
  runIntensity: number;
}) {
  const isRunning = Math.abs(motion.velocity) > 0.02;
  const cycleMs = Math.round(620 - clampArcadeValue(runIntensity, 0, 1) * 390);
  return (
    <div
      className="coin-catch-runner pointer-events-none absolute bottom-[9%] z-30 h-32 w-20 -translate-x-1/2 transition-[left] duration-75"
      data-running={isRunning ? "true" : "false"}
      data-direction={motion.velocity < -0.01 ? "left" : motion.velocity > 0.01 ? "right" : "center"}
      style={{ left: `${motion.x * 100}%`, "--coin-catch-cycle": `${cycleMs}ms` } as CSSProperties}
    >
      <span className="absolute bottom-0 left-1/2 h-3 w-16 -translate-x-1/2 rounded-[50%] bg-black/35" />
      <span className="coin-catch-arm coin-catch-left-arm absolute left-2 top-[46%] h-11 w-3 origin-top rounded-full bg-[#ffb36b]" />
      <span className="coin-catch-arm coin-catch-right-arm absolute right-2 top-[46%] h-11 w-3 origin-top rounded-full bg-[#ffb36b]" />
      <span className="absolute left-1/2 top-[42%] h-14 w-11 -translate-x-1/2 rounded-md border-2 border-white/70 bg-primary shadow-md" />
      <span className="coin-catch-leg coin-catch-left-leg absolute bottom-2 left-[27%] h-12 w-3 origin-top rounded-full bg-[#172033]" />
      <span className="coin-catch-leg coin-catch-right-leg absolute bottom-2 right-[27%] h-12 w-3 origin-top rounded-full bg-[#172033]" />
      <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="absolute left-1/2 top-0 z-10 size-16 -translate-x-1/2" />
    </div>
  );
}

function getCoinCatchPoseControl(
  landmarks: NormalizedLandmark[],
  previousSample: CoinCatchPoseSample | null,
  capturedAt: number,
  neutralCenterX: number | null
): CoinCatchPoseControl {
  const visibleTorsoLandmarks = COIN_CATCH_TORSO_LANDMARK_INDEXES.flatMap((index) => {
    const landmark = getVisiblePoseLandmark(landmarks, index);
    return landmark ? [landmark] : [];
  });
  const centerX = visibleTorsoLandmarks.length > 0
    ? visibleTorsoLandmarks.reduce((total, landmark) => total + landmark.x, 0) / visibleTorsoLandmarks.length
    : 0.5;

  if (!previousSample || neutralCenterX === null) {
    return { direction: 0, runIntensity: 0, centerX };
  }

  const deltaSeconds = Math.max(0.04, (capturedAt - previousSample.capturedAt) / 1000);
  const previousTorsoLandmarks = COIN_CATCH_TORSO_LANDMARK_INDEXES.flatMap((index) => {
    const landmark = getVisiblePoseLandmark(previousSample.landmarks, index);
    return landmark ? [landmark] : [];
  });
  const previousCenterX = previousTorsoLandmarks.length > 0
    ? previousTorsoLandmarks.reduce((total, landmark) => total + landmark.x, 0) / previousTorsoLandmarks.length
    : centerX;
  const positionOffset = neutralCenterX - centerX;
  const mirroredVelocityX = (previousCenterX - centerX) / deltaSeconds;
  const direction = Math.abs(positionOffset) < COIN_CATCH_TORSO_DIRECTION_DEADZONE
    ? 0
    : clampArcadeValue(positionOffset / COIN_CATCH_TORSO_DIRECTION_FULL_SPEED, -1, 1);
  const runIntensity = Math.max(
    Math.abs(direction),
    clampArcadeValue(Math.abs(mirroredVelocityX) / COIN_CATCH_TORSO_RUN_FULL_SPEED, 0, 1)
  );
  return { direction, runIntensity, centerX };
}

function createCoinCatchItem(index: number, score: number, forceCoin = false): CoinCatchItem {
  const randomX = seededArcadeFraction(index * 17 + 5);
  const value = COIN_CATCH_VALUES[(index * 7 + 1) % COIN_CATCH_VALUES.length];
  const kind: CoinCatchItem["kind"] = !forceCoin && index >= 4 && index % 5 === 4 ? "bomb" : "coin";
  const size = kind === "bomb" ? 0.09 : value === 1 ? 0.065 : value === 3 ? 0.082 : 0.105;
  return {
    id: index,
    kind,
    value,
    x: 0.12 + randomX * 0.76,
    y: forceCoin ? 0.04 : -0.1,
    size,
    speed: (0.2 + Math.min(0.16, score * 0.0025) + seededArcadeFraction(index * 13 + 9) * 0.055) * 0.6
  };
}

function seededArcadeFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function FaceSimonGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("face-simon");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [sequence, setSequence] = useState<FaceRhythmExpression[]>(["happy"]);
  const [inputIndex, setInputIndex] = useState(0);
  const [showIndex, setShowIndex] = useState(0);
  const [showing, setShowing] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(FACE_SIMON_MAX_LIVES);
  const [remaining, setRemaining] = useState(FACE_SIMON_DURATION_SECONDS);
  const [correctInputs, setCorrectInputs] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [expression, setExpression] = useState<AvatarExpression>("happy");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);

  function restart() {
    setRunId((value) => value + 1);
    setStatus("ready");
    setSequence(["happy"]);
    setInputIndex(0);
    setShowIndex(0);
    setShowing(false);
    setScore(0);
    setLives(FACE_SIMON_MAX_LIVES);
    setRemaining(FACE_SIMON_DURATION_SECONDS);
    setCorrectInputs(0);
    setAttempts(0);
    setFeedback("idle");
    setExpression("happy");
    setStartedAt(0);
    setEndedAt(0);
  }

  function start() {
    setStatus("running");
    setStartedAt((value) => value || performance.now());
    setShowing(true);
    setShowIndex(0);
  }

  function choose(actual: FaceRhythmExpression) {
    if (status !== "running" || showing) {
      return;
    }
    setAttempts((value) => value + 1);
    setExpression(actual);
    if (actual !== sequence[inputIndex]) {
      setFeedback("wrong");
      setInputIndex(0);
      setShowIndex(0);
      const nextLives = Math.max(0, lives - 1);
      setLives(nextLives);
      if (nextLives === 0) {
        setStatus("ended");
        setEndedAt(performance.now());
      } else {
        setShowing(true);
      }
      return;
    }
    setCorrectInputs((value) => value + 1);
    if (inputIndex + 1 === sequence.length) {
      setScore((value) => value + sequence.length * 10);
      setSequence((current) => nextSimonSequence(current, current.length));
      setInputIndex(0);
      setShowing(true);
      setShowIndex(0);
      setFeedback("correct");
      return;
    }
    setInputIndex((value) => value + 1);
  }

  useEffect(() => {
    if (!showing || status !== "running") {
      return;
    }
    setExpression(sequence[showIndex]);
    const timeoutId = window.setTimeout(() => {
      if (showIndex + 1 >= sequence.length) {
        setShowing(false);
        setExpression("happy");
      } else {
        setShowIndex((value) => value + 1);
      }
    }, 780);
    return () => window.clearTimeout(timeoutId);
  }, [sequence, showIndex, showing, status]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setStatus("ended");
          setEndedAt(performance.now());
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [status]);

  useEffect(() => {
    if (feedback === "idle") {
      return;
    }
    const timeoutId = window.setTimeout(() => setFeedback("idle"), 420);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const accuracy = attempts > 0 ? correctInputs / attempts : 0;
  const finalEntry = status === "ended"
    ? makeEntry("face-simon", playerName, score, startedAt, endedAt, sequence.length, accuracy)
    : null;

  return (
    <GameShell {...config} status={status} score={score} timerLabel={`${remaining}s`} sensorLabel={showing ? "Watch" : "Your turn"} expression={expression} runId={runId} finalEntry={finalEntry} onStart={start} onPause={() => setStatus("paused")} onRestart={restart}>
      <div className="grid h-full min-h-[420px] grid-cols-[minmax(0,1fr)_260px] gap-3 max-sm:grid-cols-1">
        <div className={cn("relative grid place-items-center overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#101827] p-4 text-white transition-colors", feedback === "correct" && "border-emerald-400 bg-[#10251f]", feedback === "wrong" && "border-red-400 bg-[#291516]")}>
          <div className="absolute left-4 top-4 flex gap-1.5" aria-label={`${lives} lives remaining`}>
            {Array.from({ length: FACE_SIMON_MAX_LIVES }, (_, index) => (
              <Heart key={index} className={cn("size-5", index < lives ? "fill-primary text-primary" : "text-white/20")} />
            ))}
          </div>
          <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-black">
            ROUND {sequence.length}
          </div>
          <div className="grid max-w-xl justify-items-center gap-5 text-center">
            <Badge variant={showing ? "default" : "secondary"} className="font-mono">{showing ? "WATCH" : "REPEAT"}</Badge>
            <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="size-40 shadow-[0_0_34px_rgba(255,75,0,0.2)]" />
            <div>
              <div className="text-lg font-black">{showing ? formatFaceRhythmPose(sequence[showIndex]) : `Step ${inputIndex + 1} of ${sequence.length}`}</div>
              <div className="mt-1 text-xs font-semibold text-white/60">{showing ? "Remember the order" : "Choose the next pose from memory"}</div>
            </div>
            <div className="flex max-w-full flex-wrap justify-center gap-2" aria-label={`Sequence length ${sequence.length}`}>
              {sequence.map((item, index) => (
                <span key={`${item}-${index}`} className={cn("grid size-8 place-items-center rounded-full border text-[10px] font-black", showing && index === showIndex ? "scale-110 border-primary bg-primary text-primary-foreground" : index < inputIndex ? "border-emerald-300 bg-emerald-400 text-emerald-950" : "border-white/20 bg-white/10 text-white/60")}>
                  {index + 1}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3 rounded-lg border-2 border-[#07111f] bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black"><ScanFace className="size-4 text-primary" /> Expression controls</div>
            <Badge variant="secondary">{inputIndex}/{sequence.length}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FACE_RHYTHM_EXPRESSIONS.map((faceExpression) => (
              <Button key={faceExpression} type="button" variant="outline" className="h-auto min-h-28 flex-col gap-2 p-2" disabled={showing || status !== "running"} onClick={() => choose(faceExpression)}>
                <AvatarSprite asset={avatarAsset} manifest={manifest} expression={faceExpression} className="size-16" />
                <span className="text-[10px] font-black">{formatFaceRhythmPose(faceExpression)}</span>
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 divide-x rounded-md border border-input bg-muted/55 py-2 text-center font-mono">
            <FaceTelemetry label="Lives" value={`${lives}/${FACE_SIMON_MAX_LIVES}`} />
            <FaceTelemetry label="Accuracy" value={`${Math.round(accuracy * 100)}%`} />
          </div>
        </div>
      </div>
    </GameShell>
  );
}

type DancePoseId = "hands-up" | "t-pose" | "arms-crossed" | "left-reach" | "right-reach" | "left-leg" | "right-leg";
const STELLAR_DANCE_START_BEAT_MS = 6800;
const STELLAR_DANCE_MIN_BEAT_MS = 3600;
const STELLAR_DANCE_MAX_HEALTH = 5;
const STELLAR_DANCE_MIN_MUSIC_BEAT_GAP_MS = 2400;
const STELLAR_DANCE_EARLY_HIT_MIN_PROGRESS = 0.08;
const STELLAR_DANCE_MOVE_SPEEDUP_MULTIPLIER = 0.995;
const AVATAR_GRID_CROP_PADDING_RATIO = 0;
const STELLAR_DANCE_ENABLE_T_POSE = false;
const STELLAR_DANCE_POSES: DancePoseId[] = ["hands-up", "arms-crossed", "left-reach", "right-reach", "left-leg", "right-leg"];
const STELLAR_DANCE_SKELETON_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
] as const;

type StellarAudioAnalyzer = {
  context: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  source: MediaElementAudioSourceNode;
  ambient: number;
  peak: number;
  latestEnergy: number;
  lastBeatAt: number;
  estimatedBeatMs: number;
  beatIndex: number;
};

function StellarDanceGame({ avatarAsset, manifest, playerName }: GameProps) {
  const config = getGameConfig("stellar-dance");
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(STELLAR_DANCE_MAX_HEALTH);
  const [beatIndex, setBeatIndex] = useState(0);
  const [targetPose, setTargetPose] = useState<DancePoseId>(() => getDancePoseForBeat(0));
  const [detectedPose, setDetectedPose] = useState<DancePoseId | "none">("none");
  const [cameraStatus, setCameraStatus] = useState<PoseCameraStatus>("off");
  const [trackerStatus, setTrackerStatus] = useState<VisionTrackerStatus>("idle");
  const [sensorLabel, setSensorLabel] = useState("Camera off");
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicName, setMusicName] = useState("Metronome pace");
  const [beatMode, setBeatMode] = useState("Metronome pace");
  const [fallProgress, setFallProgress] = useState(0);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [expression, setExpression] = useState<AvatarExpression>("playful");
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const poseFrameRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detectedPoseRef = useRef<DancePoseId | "none">("none");
  const judgedBeatRef = useRef(-1);
  const audioAnalyzerRef = useRef<StellarAudioAnalyzer | null>(null);
  const fallbackBeatStartedAtRef = useRef(0);
  const fallbackBeatDurationMsRef = useRef(STELLAR_DANCE_START_BEAT_MS);

  function restart() {
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setRunId((value) => value + 1);
    setStatus("ready");
    setScore(0);
    setHealth(STELLAR_DANCE_MAX_HEALTH);
    setBeatIndex(0);
    setFallProgress(0);
    setTargetPose(getDancePoseForBeat(0));
    setDetectedPose("none");
    detectedPoseRef.current = "none";
    judgedBeatRef.current = -1;
    setExpression("playful");
    setStartedAt(0);
    setEndedAt(0);
    fallbackBeatStartedAtRef.current = 0;
    fallbackBeatDurationMsRef.current = STELLAR_DANCE_START_BEAT_MS;
    resetStellarAudioAnalyzer(audioAnalyzerRef.current);
  }

  function start() {
    if (status === "ended") {
      restart();
    }
    setStatus("running");
    setStartedAt((value) => value || performance.now());
    judgedBeatRef.current = -1;
    if (!fallbackBeatStartedAtRef.current) {
      fallbackBeatStartedAtRef.current = performance.now();
    }
    if (audioRef.current) {
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0;
      }
      if (musicUrl) {
        void ensureStellarAudioAnalyzer(audioRef.current, audioAnalyzerRef).then((analyzer) => {
          resetStellarAudioAnalyzer(analyzer);
          setBeatMode("Music reactive");
        }).catch(() => {
          setBeatMode("Metronome fallback");
        });
      }
      void audioRef.current.play().catch(() => {
        setSensorLabel(cameraStatus === "ready" ? "Camera ready" : "Camera off");
      });
    }
    if (cameraStatus !== "loading" && trackerStatus !== "loading" && (cameraStatus !== "ready" || trackerStatus !== "ready")) {
      void startPoseCamera();
    }
  }

  function pause() {
    audioRef.current?.pause();
    setStatus("paused");
  }

  function toggleStageFullscreen() {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (isStageFullscreen) {
      setIsStageFullscreen(false);
      return;
    }
    setIsStageFullscreen(true);
    if (stage.requestFullscreen) {
      void stage.requestFullscreen().catch(() => undefined);
      return;
    }
  }

  function handleMusicChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setMusicUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return URL.createObjectURL(file);
    });
    setMusicName(file.name);
    setBeatMode("Music reactive");
    setBeatIndex(0);
    setFallProgress(0);
    setTargetPose(getDancePoseForBeat(0));
    judgedBeatRef.current = -1;
    fallbackBeatStartedAtRef.current = 0;
    fallbackBeatDurationMsRef.current = STELLAR_DANCE_START_BEAT_MS;
    resetStellarAudioAnalyzer(audioAnalyzerRef.current);
  }

  function judgeCurrentPose(beat: number, expectedPose: DancePoseId, progress: number) {
    if (judgedBeatRef.current === beat) {
      return;
    }
    judgedBeatRef.current = beat;
    const actualPose = detectedPoseRef.current;
    if (actualPose === expectedPose) {
      setScore((value) => value + getStellarDanceScoreForProgress(progress));
      setExpression("excited");
      return;
    }
    setExpression("sad");
    setHealth((value) => {
      const nextHealth = Math.max(0, value - 1);
      if (nextHealth <= 0) {
        setStatus("ended");
        setEndedAt(performance.now());
        audioRef.current?.pause();
        setExpression("dizzy");
      }
      return nextHealth;
    });
  }

  async function startPoseCamera() {
    if (cameraStatus === "loading" || trackerStatus === "loading") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      setSensorLabel("Camera unavailable");
      return;
    }

    if (!cameraStreamRef.current) {
      setCameraStatus("loading");
      setSensorLabel("Starting camera");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("ready");
        setSensorLabel("Camera live · Loading pose tracker");
      } catch (error) {
        const isPermissionError = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        stopPoseCamera(isPermissionError ? "blocked" : "error");
        setSensorLabel(isPermissionError ? "Camera blocked · Allow access and retry" : "Camera unavailable · Check that it is connected");
        return;
      }
    }

    if (poseLandmarkerRef.current) {
      setTrackerStatus("ready");
      setSensorLabel("Pose camera ready");
      runPoseLoop();
      return;
    }

    setTrackerStatus("loading");
    setSensorLabel("Camera live · Loading pose tracker");
    try {
      const { FilesetResolver, PoseLandmarker: PoseLandmarkerTask } = await import("@mediapipe/tasks-vision");
      if (!poseLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(POSE_LANDMARKER_WASM_URL);
        poseLandmarkerRef.current = await PoseLandmarkerTask.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_LANDMARKER_MODEL_URL,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        });
      }
      setTrackerStatus("ready");
      setSensorLabel("Pose camera ready");
      runPoseLoop();
    } catch (error) {
      setTrackerStatus("error");
      setSensorLabel("Camera live · Pose tracking unavailable");
    }
  }

  function stopPoseCamera(nextStatus: PoseCameraStatus = "off") {
    if (poseFrameRef.current !== null) {
      cancelAnimationFrame(poseFrameRef.current);
      poseFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setDetectedPose("none");
    detectedPoseRef.current = "none";
    setCameraStatus(nextStatus);
    setTrackerStatus(poseLandmarkerRef.current ? "ready" : "idle");
    if (nextStatus === "off") {
      setSensorLabel("Camera off");
    }
  }

  function runPoseLoop() {
    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = poseLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        poseFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      const result = landmarker.detectForVideo(video, performance.now());
      const landmarks = result.landmarks[0];
      drawStellarSkeleton(skeletonCanvasRef.current, landmarks);
      const nextPose = classifyDancePose(landmarks);
      detectedPoseRef.current = nextPose;
      setDetectedPose(nextPose);
      setSensorLabel(nextPose === "none" ? "Find full body" : `Detected ${formatDancePose(nextPose)}`);
      poseFrameRef.current = requestAnimationFrame(detectFrame);
    };

    if (poseFrameRef.current !== null) {
      cancelAnimationFrame(poseFrameRef.current);
    }
    poseFrameRef.current = requestAnimationFrame(detectFrame);
  }

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio?.ended) {
        setStatus("ended");
        setEndedAt(performance.now());
        setExpression("excited");
        return;
      }

      const analyzer = musicUrl ? audioAnalyzerRef.current : null;
      if (audio && analyzer) {
        const now = performance.now();
        const energy = readStellarAudioEnergy(analyzer);
        const lastBeatAge = now - analyzer.lastBeatAt;
        const phase = Math.max(0, Math.min(1, lastBeatAge / analyzer.estimatedBeatMs));
        const currentBeat = analyzer.beatIndex;
        const currentTargetPose = getDancePoseForBeat(currentBeat);
        setBeatIndex(currentBeat);
        setTargetPose(currentTargetPose);
        setFallProgress(phase);
        const matchedEarly = phase >= STELLAR_DANCE_EARLY_HIT_MIN_PROGRESS && detectedPoseRef.current === currentTargetPose;
        const musicBeatArrived = shouldTriggerStellarMusicBeat(analyzer, energy, now);
        if (matchedEarly || musicBeatArrived || phase >= 1) {
          judgeCurrentPose(currentBeat, currentTargetPose, phase);
          if (analyzer.lastBeatAt > 0) {
            const measuredInterval = now - analyzer.lastBeatAt;
            analyzer.estimatedBeatMs = Math.max(
              STELLAR_DANCE_MIN_BEAT_MS,
              Math.min(STELLAR_DANCE_START_BEAT_MS, analyzer.estimatedBeatMs * 0.72 + measuredInterval * 0.28)
            );
          }
          analyzer.beatIndex += 1;
          analyzer.lastBeatAt = now;
          setBeatIndex(analyzer.beatIndex);
          setTargetPose(getDancePoseForBeat(analyzer.beatIndex));
          setFallProgress(0);
        }
        return;
      }

      const now = performance.now();
      if (!fallbackBeatStartedAtRef.current) {
        fallbackBeatStartedAtRef.current = now;
      }
      const phase = (now - fallbackBeatStartedAtRef.current) / fallbackBeatDurationMsRef.current;
      const boundedPhase = Math.max(0, Math.min(1, phase));
      const currentBeat = beatIndex;
      const currentTargetPose = getDancePoseForBeat(currentBeat);
      setFallProgress(boundedPhase);

      if (
        phase >= 1
        || (boundedPhase >= STELLAR_DANCE_EARLY_HIT_MIN_PROGRESS && detectedPoseRef.current === currentTargetPose)
      ) {
        judgeCurrentPose(currentBeat, currentTargetPose, boundedPhase);
        const nextBeat = currentBeat + 1;
        fallbackBeatStartedAtRef.current = now;
        fallbackBeatDurationMsRef.current = Math.max(STELLAR_DANCE_MIN_BEAT_MS, fallbackBeatDurationMsRef.current * STELLAR_DANCE_MOVE_SPEEDUP_MULTIPLIER);
        setBeatIndex(nextBeat);
        setTargetPose(getDancePoseForBeat(nextBeat));
        setFallProgress(0);
      }
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [beatIndex, musicUrl, startedAt, status]);

  useEffect(() => {
    return () => {
      stopPoseCamera();
      void audioAnalyzerRef.current?.context.close();
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsStageFullscreen(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (musicUrl) {
        URL.revokeObjectURL(musicUrl);
      }
    };
  }, [musicUrl]);

  const accuracy = beatIndex > 0 ? score / Math.max(1, beatIndex) : 0;
  const finalEntry = status === "ended"
    ? makeEntry("stellar-dance", playerName, score, startedAt, endedAt, health, accuracy)
    : null;

  return (
    <GameShell {...config} status={status} score={score} timerLabel={`${health}/${STELLAR_DANCE_MAX_HEALTH} health`} sensorLabel={sensorLabel} expression={expression} hideStatusBar runId={runId} finalEntry={finalEntry} onStart={start} onPause={pause} onRestart={restart}>
      <div className="grid h-full min-h-[420px] grid-cols-[minmax(0,1fr)_250px] gap-3 max-sm:grid-cols-1">
        <div
          ref={stageRef}
          className={cn(
            "relative overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#101624]",
            isStageFullscreen && "fixed inset-0 z-50 h-dvh w-screen rounded-none border-0"
          )}
        >
          <video
            ref={videoRef}
            className={cn("absolute inset-0 size-full -scale-x-100 object-cover opacity-65", cameraStatus !== "ready" && "opacity-0")}
            playsInline
            muted
          />
          <canvas
            ref={skeletonCanvasRef}
            className={cn("absolute inset-0 size-full -scale-x-100 opacity-95", cameraStatus !== "ready" && "hidden")}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,176,0,0.25),transparent_34%),linear-gradient(180deg,rgba(16,24,39,0.16),rgba(16,24,39,0.9))]" />
          {cameraStatus === "ready" && trackerStatus !== "ready" ? (
            <div className="absolute bottom-3 left-3 z-50 rounded bg-black/70 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
              {sensorLabel}
            </div>
          ) : null}
          <div className="absolute left-4 top-4 z-40 flex gap-1.5">
            {Array.from({ length: STELLAR_DANCE_MAX_HEALTH }).map((_, index) => (
              <Heart key={index} className={cn("size-5", index < health ? "fill-primary text-primary" : "text-white/35")} />
            ))}
          </div>
          <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/35 px-2 py-1 text-white backdrop-blur">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              aria-label={status === "running" ? "Pause Stellar Dance" : "Play Stellar Dance"}
              title={status === "running" ? "Pause" : "Play"}
              onClick={status === "running" ? pause : start}
            >
              {status === "running" ? <Pause /> : <Play />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              aria-label="Reset Stellar Dance"
              title="Reset"
              onClick={restart}
            >
              <RotateCcw />
            </Button>
            <div className="flex min-w-10 items-center justify-center gap-1 rounded-full bg-white/10 px-2 text-xs font-black">
              <Trophy className="size-3.5 text-primary" />
              {score}
            </div>
          </div>
          <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
            <div className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-black text-white">
              Beat {beatIndex + 1}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-white/25 bg-black/35 text-white hover:bg-white/15 hover:text-white"
              aria-label={isStageFullscreen ? "Exit Stellar Dance full screen" : "Show Stellar Dance full screen"}
              title={isStageFullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleStageFullscreen}
            >
              {isStageFullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
          <div className="absolute left-0 right-0 top-[76%] z-20 h-1 bg-primary shadow-[0_0_18px_rgba(255,75,0,0.65)]" />
          <div
            key={beatIndex}
            className="absolute left-1/2 z-30 grid -translate-x-1/2 justify-items-center gap-1 rounded-md border border-white/20 bg-white/15 px-6 py-4 text-white shadow-lg backdrop-blur transition-[top,opacity]"
            style={{ top: `${8 + fallProgress * 62}%`, opacity: Math.max(0, 1 - fallProgress) }}
          >
            <div className="text-lg font-black uppercase text-white/70">Target pose</div>
            <DancePoseFigure pose={targetPose} className="my-6" />
            <div className="text-[22px] font-black">{formatDancePose(targetPose)}</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-30 grid gap-3 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-white/20 bg-black/40 p-3 text-white backdrop-blur">
              <DancePoseCard label="Target" pose={targetPose} active />
              <div className="grid size-12 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                VS
              </div>
              <DancePoseCard label="You" pose={detectedPose} active={detectedPose === targetPose} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${fallProgress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3 rounded-lg border-2 border-[#07111f] bg-card p-3">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-sm font-black">
              <Music className="size-4 text-primary" />
              {musicName}
            </div>
            <div className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
              {beatMode}
            </div>
            <input ref={fileInputRef} className="hidden" type="file" accept="audio/*" onChange={handleMusicChange} />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload data-icon="inline-start" />
              Music
            </Button>
            <audio ref={audioRef} src={musicUrl ?? undefined} preload="metadata" />
          </div>
          <div className="grid gap-2 rounded-md bg-muted p-2">
            {STELLAR_DANCE_POSES.map((pose) => (
              <div key={pose} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2 rounded-md bg-card px-2 py-1.5">
                <DancePoseFigure pose={pose} small />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">{formatDancePose(pose)}</span>
                  <span className="block truncate text-[10px] font-semibold text-muted-foreground">
                    {describeDancePose(pose)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <Button type="button" variant={cameraStatus === "ready" ? "outline" : "default"} disabled={cameraStatus === "loading" || trackerStatus === "loading"} onClick={cameraStatus === "ready" ? () => stopPoseCamera() : startPoseCamera}>
            <Camera data-icon="inline-start" />
            {cameraStatus === "ready" ? "Camera off" : cameraStatus === "loading" ? "Loading" : "Camera"}
          </Button>
        </div>
      </div>
    </GameShell>
  );
}

function DancePoseCard({ label, pose, active }: { label: string; pose: DancePoseId | "none"; active: boolean }) {
  return (
    <div className={cn("grid justify-items-center gap-2 rounded-md p-2", active ? "bg-white/20" : "bg-white/10")}>
      <div className="text-[11px] font-black uppercase text-white/70">{label}</div>
      <DancePoseFigure pose={pose} />
      <div className="text-center text-xs font-black">{formatDancePose(pose)}</div>
    </div>
  );
}

function DancePoseFigure({ pose, small = false, className }: { pose: DancePoseId | "none"; small?: boolean; className?: string }) {
  const sizeClass = small ? "size-9" : "size-20";
  const limbClass = small ? "h-1 rounded-full" : "h-1.5 rounded-full";
  const color = pose === "none" ? "bg-muted-foreground/50" : "bg-current";
  if (pose === "arms-crossed") {
    return (
      <span className={cn("relative grid overflow-hidden rounded-sm bg-white", sizeClass, className)} aria-hidden="true">
        <img
          src={stellarDanceArmsCrossedIcon}
          alt=""
          className="size-full object-contain"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span className={cn("relative block text-primary", sizeClass, className)} aria-hidden="true">
      <span className={cn("absolute left-1/2 top-[12%] -translate-x-1/2 rounded-full bg-current", small ? "size-2.5" : "size-5")} />
      <span className={cn("absolute left-1/2 top-[34%] -translate-x-1/2 rounded-full bg-current", small ? "h-4 w-1.5" : "h-8 w-3")} />
      <span className={cn("absolute left-1/2 top-[38%] origin-left", limbClass, color, getDanceLimbClass(pose, "leftArm", small))} />
      <span className={cn("absolute left-1/2 top-[38%] origin-left", limbClass, color, getDanceLimbClass(pose, "rightArm", small))} />
      <span className={cn("absolute left-1/2 top-[66%] origin-left", limbClass, color, getDanceLimbClass(pose, "leftLeg", small))} />
      <span className={cn("absolute left-1/2 top-[66%] origin-left", limbClass, color, getDanceLimbClass(pose, "rightLeg", small))} />
    </span>
  );
}

export function buildWordSnakeEntry(input: Parameters<typeof buildWordSnakeLeaderboardEntry>[0]) {
  return buildWordSnakeLeaderboardEntry(input);
}

type GameProps = {
  avatarAsset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
  playerName: string;
};

function ExpressionPad({
  expressions,
  avatarAsset,
  manifest,
  onSelect,
  disabled = false
}: {
  expressions: AvatarExpression[];
  avatarAsset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
  onSelect: (expression: AvatarExpression) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid content-start gap-2 rounded-lg border-2 border-[#07111f] bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-black">
        <Camera className="size-4 text-primary" />
        Expression input
      </div>
      <div className="grid grid-cols-2 gap-2">
        {expressions.map((expression) => (
          <Button key={expression} type="button" variant="outline" className="h-auto flex-col gap-1 py-2" disabled={disabled} onClick={() => onSelect(expression)}>
            <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="size-10" />
            <span className="text-[11px] font-black">{formatExpression(expression)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function GameFinalScreen({
  gameName,
  score,
  finalEntry,
  submittedEntry,
  daily,
  allTime,
  onRestart
}: {
  gameName: string;
  score: number;
  finalEntry?: NewLeaderboardEntry | null;
  submittedEntry: LeaderboardEntry | null;
  daily: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
  onRestart: () => void;
}) {
  const dailyRank = getLeaderboardRank(daily, submittedEntry);
  const allTimeRank = getLeaderboardRank(allTime, submittedEntry);

  return (
    <section className="grid h-full min-h-[420px] place-items-center px-4 py-8">
      <div className="grid w-full max-w-2xl justify-items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-[#fff4c7] text-primary">
          <Trophy className="size-8" />
        </span>
        <div className="mt-4 text-xs font-black uppercase text-muted-foreground">Round complete</div>
        <h2 className="mt-1 text-2xl font-black tracking-normal">{gameName} summary</h2>

        <div className="mt-6 text-sm font-bold text-muted-foreground">Final score</div>
        <div className="text-6xl font-black leading-none text-primary">{score}</div>

        <div className="mt-8 grid w-full grid-cols-3 divide-x border-y border-input py-4 max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
          <FinalStat icon={<Clock3 />} label="Play time" value={formatRoundDuration(finalEntry?.durationMs ?? 0)} />
          <FinalStat icon={<Medal />} label="Daily prize" value={formatPrizeRank(dailyRank)} />
          <FinalStat icon={<Trophy />} label="All-time place" value={formatLeaderboardRank(allTimeRank)} />
        </div>

        <Button type="button" className="mt-8 gap-2" onClick={onRestart}>
          <RotateCcw />
          New round
        </Button>
      </div>
    </section>
  );
}

function FinalStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid min-h-16 place-items-center content-center gap-1 px-4 max-sm:py-3">
      <span className="text-primary [&>svg]:size-4">{icon}</span>
      <span className="text-[11px] font-black uppercase text-muted-foreground">{label}</span>
      <span className="text-base font-black">{value}</span>
    </div>
  );
}

function LeaderboardPanel({ daily, allTime }: { daily: LeaderboardEntry[]; allTime: LeaderboardEntry[] }) {
  return (
    <Card className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm uppercase text-muted-foreground">
          <Medal className="size-4" />
          Prize leaderboard
        </CardTitle>
      </CardHeader>
      <ScrollArea className="min-h-0">
        <CardContent className="grid gap-4 p-3">
          <LeaderboardList title="Daily" entries={daily} />
          <LeaderboardList title="All time" entries={allTime} />
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

function LeaderboardList({ title, entries }: { title: string; entries: LeaderboardEntry[] }) {
  return (
    <section className="grid gap-2 rounded-lg border border-input p-3">
      <div className="text-xs font-black uppercase text-muted-foreground">{title}</div>
      {entries.length === 0 ? (
        <div className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">No scores yet</div>
      ) : (
        entries.slice(0, 5).map((entry, index) => (
          <div key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
            <span className={cn("grid size-6 place-items-center rounded-full text-xs font-black", getPrizeRankClassName(index + 1))}>{index + 1}</span>
            <span className="truncate font-semibold">{entry.playerName}</span>
            <span className="font-black">{entry.score}</span>
          </div>
        ))
      )}
    </section>
  );
}

function useLeaderboard(gameId: string, finalEntry: NewLeaderboardEntry | null | undefined, runId: number) {
  const store = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createLeaderboardStore(window.localStorage, ARCADE_CONFIG.leaderboardStorageKey);
  }, []);
  const [revision, setRevision] = useState(0);
  const [submittedResult, setSubmittedResult] = useState<{ runId: number; entry: LeaderboardEntry } | null>(null);
  const submittedRunRef = useRef<number | null>(null);

  useEffect(() => {
    if (!store || !finalEntry || submittedRunRef.current === runId) {
      return;
    }
    const entry = store.addEntry(finalEntry);
    submittedRunRef.current = runId;
    setSubmittedResult({ runId, entry });
    setRevision((value) => value + 1);
  }, [finalEntry, runId, store]);

  return {
    daily: store?.getDailyLeaderboard(gameId) ?? [],
    allTime: store?.getAllTimeLeaderboard(gameId) ?? [],
    submittedEntry: submittedResult?.runId === runId ? submittedResult.entry : null,
    revision
  };
}

export function useArcadeAvatarManifest() {
  const [manifest, setManifest] = useState<AvatarManifest>(DEFAULT_AVATAR_MANIFEST);

  useEffect(() => {
    let cancelled = false;
    async function loadManifest() {
      try {
        const response = await fetch(ARCADE_CONFIG.avatarManifestUrl, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const candidate = normalizeAvatarManifest(await response.json());
        if (!cancelled && candidate) {
          setManifest(candidate);
        }
      } catch {
        if (!cancelled) {
          setManifest(DEFAULT_AVATAR_MANIFEST);
        }
      }
    }
    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  return manifest;
}

function normalizeAvatarManifest(value: unknown): AvatarManifest | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as {
    canvas?: { width?: number; height?: number };
    frames?: AvatarManifest["frames"];
    grid?: { circles?: Array<{ emotion?: string; x?: number; y?: number; diameter?: number }> };
  };
  if (candidate.frames) {
    return {
      imageWidth: candidate.canvas?.width,
      imageHeight: candidate.canvas?.height,
      frames: candidate.frames
    };
  }
  const circles = candidate.grid?.circles;
  if (!Array.isArray(circles)) {
    return null;
  }
  const frames: AvatarManifest["frames"] = {};
  for (const circle of circles) {
    if (!circle.emotion || typeof circle.x !== "number" || typeof circle.y !== "number" || typeof circle.diameter !== "number") {
      continue;
    }
    if (!frames[circle.emotion]) {
      frames[circle.emotion] = expandAvatarGridCrop(circle.x, circle.y, circle.diameter, candidate.canvas?.width, candidate.canvas?.height);
    }
  }
  return {
    imageWidth: candidate.canvas?.width,
    imageHeight: candidate.canvas?.height,
    frames
  };
}

function expandAvatarGridCrop(x: number, y: number, diameter: number, imageWidth?: number, imageHeight?: number): AvatarFrame {
  const padding = Math.round(diameter * AVATAR_GRID_CROP_PADDING_RATIO);
  const expandedSize = diameter + padding * 2;
  const maxX = typeof imageWidth === "number" ? imageWidth - expandedSize : Number.POSITIVE_INFINITY;
  const maxY = typeof imageHeight === "number" ? imageHeight - expandedSize : Number.POSITIVE_INFINITY;
  return {
    x: Math.max(0, Math.min(x - padding, maxX)),
    y: Math.max(0, Math.min(y - padding, maxY)),
    width: expandedSize,
    height: expandedSize
  };
}

function getGameConfig(id: ArcadeGameId) {
  return ARCADE_GAME_CONFIGS.find((game) => game.id === id)!;
}

function makeEntry(gameId: ArcadeGameId, playerName: string, score: number, startedAt: number, endedAt: number, secondaryScore?: number, accuracy?: number): NewLeaderboardEntry {
  return {
    gameId,
    playerName,
    avatarId: "current-avatar",
    score,
    secondaryScore,
    durationMs: Math.max(0, Math.round((endedAt || performance.now()) - (startedAt || performance.now()))),
    accuracy
  };
}

function getLeaderboardRank(entries: LeaderboardEntry[], submittedEntry: LeaderboardEntry | null) {
  if (!submittedEntry) {
    return null;
  }
  const index = entries.findIndex((entry) => entry.id === submittedEntry.id);
  return index >= 0 ? index + 1 : null;
}

function getPrizeRankClassName(rank: number) {
  if (rank === 1) {
    return "bg-[#f6c344] text-[#2d2200]";
  }
  if (rank === 2) {
    return "bg-[#d9dee7] text-[#1f2937]";
  }
  if (rank === 3) {
    return "bg-[#b96f3c] text-white";
  }
  return "bg-primary text-primary-foreground";
}

function formatPrizeRank(rank: number | null) {
  if (rank === 1) {
    return "Gold - #1";
  }
  if (rank === 2) {
    return "Silver - #2";
  }
  if (rank === 3) {
    return "Bronze - #3";
  }
  return formatLeaderboardRank(rank);
}

function formatLeaderboardRank(rank: number | null) {
  return rank ? `#${rank}` : "Calculating";
}

function formatRoundDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  return formatCountdown(totalSeconds);
}

function formatGameStatus(status: GameStatus) {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "paused") {
    return "Paused";
  }
  return "Ended";
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatExpression(expression: AvatarExpression) {
  return expression.charAt(0).toUpperCase() + expression.slice(1);
}

function formatFaceRhythmPose(expression: FaceRhythmExpression) {
  return FACE_RHYTHM_POSE_LABELS[expression];
}

async function ensureStellarAudioAnalyzer(
  audio: HTMLAudioElement,
  analyzerRef: MutableRefObject<StellarAudioAnalyzer | null>
) {
  if (analyzerRef.current) {
    if (analyzerRef.current.context.state === "suspended") {
      await analyzerRef.current.context.resume();
    }
    return analyzerRef.current;
  }

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("AudioContext unavailable");
  }
  const context = new AudioContextClass();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  const source = context.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(context.destination);
  const analyzer: StellarAudioAnalyzer = {
    context,
    analyser,
    data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
    source,
    ambient: 0,
    peak: 0,
    latestEnergy: 0,
    lastBeatAt: performance.now(),
    estimatedBeatMs: STELLAR_DANCE_START_BEAT_MS,
    beatIndex: 0
  };
  analyzerRef.current = analyzer;
  if (context.state === "suspended") {
    await context.resume();
  }
  return analyzer;
}

function resetStellarAudioAnalyzer(analyzer: StellarAudioAnalyzer | null) {
  if (!analyzer) {
    return;
  }
  analyzer.ambient = 0;
  analyzer.peak = 0;
  analyzer.latestEnergy = 0;
  analyzer.lastBeatAt = performance.now();
  analyzer.estimatedBeatMs = STELLAR_DANCE_START_BEAT_MS;
  analyzer.beatIndex = 0;
}

function readStellarAudioEnergy(analyzer: StellarAudioAnalyzer) {
  analyzer.analyser.getByteFrequencyData(analyzer.data);
  const startBin = 3;
  const endBin = Math.min(96, analyzer.data.length);
  let sum = 0;
  for (let index = startBin; index < endBin; index += 1) {
    const normalized = analyzer.data[index] / 255;
    sum += normalized * normalized;
  }
  const energy = Math.sqrt(sum / Math.max(1, endBin - startBin));
  analyzer.latestEnergy = energy;
  analyzer.ambient = analyzer.ambient === 0 ? energy : analyzer.ambient * 0.965 + energy * 0.035;
  analyzer.peak = Math.max(energy, analyzer.peak * 0.94);
  return energy;
}

function shouldTriggerStellarMusicBeat(analyzer: StellarAudioAnalyzer, energy: number, now: number) {
  if (now - analyzer.lastBeatAt < STELLAR_DANCE_MIN_MUSIC_BEAT_GAP_MS) {
    return false;
  }
  const adaptiveThreshold = Math.max(0.06, analyzer.ambient * 1.42 + 0.025, analyzer.peak * 0.58);
  return energy > adaptiveThreshold;
}

function getStellarDanceScoreForProgress(progress: number) {
  if (progress < 0.35) {
    return 3;
  }
  if (progress < 0.7) {
    return 2;
  }
  return 1;
}

function resolveFaceExpressionConsensus(samples: FaceExpressionSample[]): FaceExpressionSample | null {
  const grouped = new Map<FaceRhythmExpression, { count: number; confidence: number }>();
  for (const sample of samples) {
    const current = grouped.get(sample.expression) ?? { count: 0, confidence: 0 };
    grouped.set(sample.expression, {
      count: current.count + 1,
      confidence: current.confidence + sample.confidence
    });
  }
  let strongest: { expression: FaceRhythmExpression; count: number; confidence: number } | null = null;
  for (const [expression, result] of grouped) {
    if (!strongest || result.count > strongest.count || (result.count === strongest.count && result.confidence > strongest.confidence)) {
      strongest = { expression, ...result };
    }
  }
  if (!strongest || strongest.count < FACE_RHYTHM_MIN_CONSENSUS) {
    return null;
  }
  return {
    expression: strongest.expression,
    confidence: Number((strongest.confidence / strongest.count).toFixed(2))
  };
}

function drawFaceRhythmMesh(
  canvas: HTMLCanvasElement | null,
  landmarks: NormalizedLandmark[] | undefined,
  connections: FaceMeshConnections
) {
  if (!canvas) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const nextHeight = Math.max(1, Math.floor(rect.height * pixelRatio));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(94, 234, 212, 0.2)";
  context.lineWidth = 1;
  context.setLineDash([4, 6]);
  context.beginPath();
  for (const fraction of [0.25, 0.5, 0.75]) {
    context.moveTo(rect.width * fraction, 0);
    context.lineTo(rect.width * fraction, rect.height);
    context.moveTo(0, rect.height * fraction);
    context.lineTo(rect.width, rect.height * fraction);
  }
  context.stroke();
  context.setLineDash([]);

  if (!landmarks?.length) {
    context.restore();
    return;
  }

  context.strokeStyle = "rgba(94, 234, 212, 0.22)";
  context.lineWidth = 0.7;
  context.beginPath();
  for (const connection of connections.tessellation) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!start || !end) {
      continue;
    }
    context.moveTo(start.x * rect.width, start.y * rect.height);
    context.lineTo(end.x * rect.width, end.y * rect.height);
  }
  context.stroke();

  context.shadowColor = "rgba(255, 75, 0, 0.55)";
  context.shadowBlur = 7;
  context.strokeStyle = "rgba(255, 112, 51, 0.95)";
  context.lineWidth = 1.6;
  context.beginPath();
  for (const connection of connections.contours) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!start || !end) {
      continue;
    }
    context.moveTo(start.x * rect.width, start.y * rect.height);
    context.lineTo(end.x * rect.width, end.y * rect.height);
  }
  context.stroke();

  context.shadowColor = "rgba(94, 234, 212, 0.7)";
  context.shadowBlur = 5;
  context.fillStyle = "rgba(207, 250, 254, 0.95)";
  context.beginPath();
  for (const landmark of landmarks) {
    const x = landmark.x * rect.width;
    const y = landmark.y * rect.height;
    context.moveTo(x + 1.25, y);
    context.arc(x, y, 1.25, 0, Math.PI * 2);
  }
  context.fill();

  const xs = landmarks.map((landmark) => landmark.x * rect.width);
  const ys = landmarks.map((landmark) => landmark.y * rect.height);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(94, 234, 212, 0.9)";
  context.lineWidth = 1.2;
  context.setLineDash([7, 5]);
  context.strokeRect(left, top, right - left, bottom - top);
  context.setLineDash([]);

  const center = landmarks[1];
  if (center) {
    const x = center.x * rect.width;
    const y = center.y * rect.height;
    context.beginPath();
    context.moveTo(x - 10, y);
    context.lineTo(x + 10, y);
    context.moveTo(x, y - 10);
    context.lineTo(x, y + 10);
    context.stroke();
  }
  context.restore();
}

function drawStellarSkeleton(canvas: HTMLCanvasElement | null, landmarks: NormalizedLandmark[] | undefined) {
  if (!canvas) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const nextHeight = Math.max(1, Math.floor(rect.height * pixelRatio));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) {
    return;
  }

  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(255, 75, 0, 0.45)";
  context.shadowBlur = 12;
  context.strokeStyle = "#ff4b00";
  context.lineWidth = 5;
  for (const [start, end] of STELLAR_DANCE_SKELETON_CONNECTIONS) {
    const a = getVisiblePoseLandmark(landmarks, start);
    const b = getVisiblePoseLandmark(landmarks, end);
    if (!a || !b) {
      continue;
    }
    context.beginPath();
    context.moveTo(a.x * rect.width, a.y * rect.height);
    context.lineTo(b.x * rect.width, b.y * rect.height);
    context.stroke();
  }

  context.shadowBlur = 8;
  context.fillStyle = "#ffffff";
  for (const landmark of landmarks) {
    if (typeof landmark.visibility === "number" && landmark.visibility < 0.35) {
      continue;
    }
    context.beginPath();
    context.arc(landmark.x * rect.width, landmark.y * rect.height, 4.5, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function getDancePoseForBeat(beat: number): DancePoseId {
  return STELLAR_DANCE_POSES[(beat * 2 + Math.floor(beat / 3)) % STELLAR_DANCE_POSES.length];
}

function formatDancePose(pose: DancePoseId | "none") {
  if (pose === "hands-up") {
    return "Stellar";
  }
  if (pose === "t-pose") {
    return "T-pose";
  }
  if (pose === "arms-crossed") {
    return "Arms crossed";
  }
  if (pose === "left-reach") {
    return "Left reach";
  }
  if (pose === "right-reach") {
    return "Right reach";
  }
  if (pose === "left-leg") {
    return "Left leg";
  }
  if (pose === "right-leg") {
    return "Right leg";
  }
  return "No pose";
}

function describeDancePose(pose: DancePoseId | "none") {
  if (pose === "hands-up") {
    return "Raise both arms high";
  }
  if (pose === "t-pose") {
    return "Hold both arms straight out";
  }
  if (pose === "arms-crossed") {
    return "Cross your arms over your chest";
  }
  if (pose === "left-reach") {
    return "Raise your left arm";
  }
  if (pose === "right-reach") {
    return "Raise your right arm";
  }
  if (pose === "left-leg") {
    return "Lift your left leg";
  }
  if (pose === "right-leg") {
    return "Lift your right leg";
  }
  return "Find your body";
}

function classifyDancePose(landmarks: NormalizedLandmark[] | undefined): DancePoseId | "none" {
  if (!landmarks) {
    return "none";
  }
  const leftShoulder = getVisiblePoseLandmark(landmarks, 11);
  const rightShoulder = getVisiblePoseLandmark(landmarks, 12);
  const leftElbow = getVisiblePoseLandmark(landmarks, 13);
  const rightElbow = getVisiblePoseLandmark(landmarks, 14);
  const leftWrist = getVisiblePoseLandmark(landmarks, 15);
  const rightWrist = getVisiblePoseLandmark(landmarks, 16);
  const leftHip = getVisiblePoseLandmark(landmarks, 23);
  const rightHip = getVisiblePoseLandmark(landmarks, 24);
  const leftKnee = getVisiblePoseLandmark(landmarks, 25);
  const rightKnee = getVisiblePoseLandmark(landmarks, 26);
  const leftAnkle = getVisiblePoseLandmark(landmarks, 27);
  const rightAnkle = getVisiblePoseLandmark(landmarks, 28);
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return "none";
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const torsoHeight = Math.max(0.12, hipY - shoulderY);
  const shoulderWidth = Math.max(0.08, Math.abs(leftShoulder.x - rightShoulder.x));
  const leftSideX = Math.min(leftShoulder.x, rightShoulder.x);
  const rightSideX = Math.max(leftShoulder.x, rightShoulder.x);
  const leftHandHigh = Boolean(leftWrist && leftWrist.y < shoulderY - 0.07);
  const rightHandHigh = Boolean(rightWrist && rightWrist.y < shoulderY - 0.07);
  const leftHandWide = Boolean(leftWrist && leftWrist.x < leftSideX + shoulderWidth * 0.12);
  const rightHandWide = Boolean(rightWrist && rightWrist.x > rightSideX - shoulderWidth * 0.12);
  const leftElbowWide = Boolean(leftElbow && leftElbow.x < leftSideX - shoulderWidth * 0.08);
  const rightElbowWide = Boolean(rightElbow && rightElbow.x > rightSideX + shoulderWidth * 0.08);
  const leftArmSideways = leftHandWide && leftElbowWide;
  const rightArmSideways = rightHandWide && rightElbowWide;
  const leftArmExtended = Boolean(leftWrist && leftElbow && leftWrist.x < leftShoulder.x + shoulderWidth * 0.2 && leftElbow.x < leftSideX);
  const rightArmExtended = Boolean(rightWrist && rightElbow && rightWrist.x > rightShoulder.x - shoulderWidth * 0.2 && rightElbow.x > rightSideX);
  const leftWristTHeight = Boolean(leftWrist && leftWrist.y >= shoulderY - torsoHeight * 0.25 && leftWrist.y <= shoulderY + torsoHeight * 0.95);
  const rightWristTHeight = Boolean(rightWrist && rightWrist.y >= shoulderY - torsoHeight * 0.25 && rightWrist.y <= shoulderY + torsoHeight * 0.95);
  const leftElbowTHeight = Boolean(leftElbow && leftElbow.y >= shoulderY - torsoHeight * 0.25 && leftElbow.y <= shoulderY + torsoHeight * 0.72);
  const rightElbowTHeight = Boolean(rightElbow && rightElbow.y >= shoulderY - torsoHeight * 0.25 && rightElbow.y <= shoulderY + torsoHeight * 0.72);
  const bothHandsSideways = leftArmSideways && rightArmSideways && leftArmExtended && rightArmExtended && leftWristTHeight && rightWristTHeight && leftElbowTHeight && rightElbowTHeight;
  if (STELLAR_DANCE_ENABLE_T_POSE && bothHandsSideways) {
    return "t-pose";
  }

  const bothHandsHigh = leftHandHigh && rightHandHigh;
  if (bothHandsHigh) {
    return "hands-up";
  }

  const torsoCenterX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  const upperChestTop = shoulderY - torsoHeight * 0.08;
  const upperChestBottom = shoulderY + torsoHeight * 0.7;
  const leftWristOnTorso = Boolean(leftWrist && leftWrist.x >= leftSideX - shoulderWidth * 0.18 && leftWrist.x <= rightSideX + shoulderWidth * 0.18 && leftWrist.y >= upperChestTop && leftWrist.y <= upperChestBottom);
  const rightWristOnTorso = Boolean(rightWrist && rightWrist.x >= leftSideX - shoulderWidth * 0.18 && rightWrist.x <= rightSideX + shoulderWidth * 0.18 && rightWrist.y >= upperChestTop && rightWrist.y <= upperChestBottom);
  const wristsNearCenter = Boolean(leftWrist && rightWrist && Math.abs(leftWrist.x - torsoCenterX) <= shoulderWidth * 0.8 && Math.abs(rightWrist.x - torsoCenterX) <= shoulderWidth * 0.8);
  const wristsCrossed = Boolean(leftWrist && rightWrist && (leftShoulder.x < rightShoulder.x ? leftWrist.x > rightWrist.x : leftWrist.x < rightWrist.x));
  const elbowsVisibleBesideBody = Boolean(leftElbow && rightElbow && leftElbow.y >= shoulderY - torsoHeight * 0.15 && leftElbow.y <= hipY + torsoHeight * 0.2 && rightElbow.y >= shoulderY - torsoHeight * 0.15 && rightElbow.y <= hipY + torsoHeight * 0.2);
  if (leftWristOnTorso && rightWristOnTorso && wristsNearCenter && (wristsCrossed || elbowsVisibleBesideBody)) {
    return "arms-crossed";
  }

  const leftReach = leftHandHigh || Boolean(leftWrist && leftHandWide && leftWrist.y < hipY);
  const rightReach = rightHandHigh || Boolean(rightWrist && rightHandWide && rightWrist.y < hipY);
  if (leftReach && !rightReach) {
    return "left-reach";
  }
  if (rightReach && !leftReach) {
    return "right-reach";
  }

  const leftLegLift = Boolean(
    leftKnee && rightKnee && leftKnee.y < rightKnee.y - 0.06
      || leftAnkle && rightAnkle && leftAnkle.y < rightAnkle.y - 0.06
  );
  const rightLegLift = Boolean(
    rightKnee && leftKnee && rightKnee.y < leftKnee.y - 0.06
      || rightAnkle && leftAnkle && rightAnkle.y < leftAnkle.y - 0.06
  );
  if (leftLegLift && !rightLegLift) {
    return "left-leg";
  }
  if (rightLegLift && !leftLegLift) {
    return "right-leg";
  }

  return "none";
}

function getVisiblePoseLandmark(landmarks: NormalizedLandmark[], index: number) {
  const landmark = landmarks[index];
  if (!landmark || (typeof landmark.visibility === "number" && landmark.visibility < 0.2)) {
    return null;
  }
  return landmark;
}

function getDanceLimbClass(pose: DancePoseId | "none", limb: "leftArm" | "rightArm" | "leftLeg" | "rightLeg", small: boolean) {
  const armLength = small ? "w-5" : "w-10";
  const legLength = small ? "w-4" : "w-8";
  if (limb === "leftArm") {
    if (pose === "arms-crossed") return `${armLength} rotate-[30deg]`;
    if (pose === "t-pose") return `${armLength} rotate-180`;
    if (pose === "hands-up" || pose === "left-reach") return `${armLength} -rotate-[125deg]`;
    return `${armLength} rotate-[145deg]`;
  }
  if (limb === "rightArm") {
    if (pose === "arms-crossed") return `${armLength} rotate-[150deg]`;
    if (pose === "t-pose") return `${armLength} rotate-0`;
    if (pose === "hands-up" || pose === "right-reach") return `${armLength} -rotate-[55deg]`;
    return `${armLength} rotate-[35deg]`;
  }
  if (limb === "leftLeg") {
    if (pose === "left-leg") return `${legLength} rotate-[185deg]`;
    return `${legLength} rotate-[110deg]`;
  }
  if (pose === "right-leg") return `${legLength} -rotate-[5deg]`;
  return `${legLength} rotate-[70deg]`;
}

function VoiceFlappyScenery({ distance, worldWidth }: { distance: number; worldWidth: number }) {
  const cloudTrack = Math.max(480, worldWidth + 260);
  const clouds = [
    { start: 120, top: "15%", scale: 0.8 },
    { start: 430, top: "34%", scale: 1.05 },
    { start: 760, top: "9%", scale: 0.65 }
  ];

  return (
    <div data-testid="voice-flappy-scenery" className="pointer-events-none absolute inset-0 overflow-hidden">
      {clouds.map((cloud, index) => {
        const rawX = (cloud.start - distance * 0.22) % cloudTrack;
        const left = (rawX + cloudTrack) % cloudTrack - 130;
        return (
          <div
            key={index}
            className="absolute h-8 w-28 rounded-md border border-[#07111f]/10 bg-white/75 shadow-sm"
            style={{ left, top: cloud.top, transform: `scale(${cloud.scale})` }}
          >
            <span className="absolute -top-3 left-4 h-6 w-10 rounded-t-full bg-white" />
            <span className="absolute -top-5 right-4 h-8 w-12 rounded-t-full bg-white" />
          </div>
        );
      })}
    </div>
  );
}

function VoiceFlappyTester({
  mode,
  level,
  onModeChange,
  onLevelChange,
  onFlap
}: {
  mode: "manual" | "auto";
  level: number;
  onModeChange: (mode: "manual" | "auto") => void;
  onLevelChange: (level: number) => void;
  onFlap: () => void;
}) {
  return (
    <div
      data-testid="voice-flappy-tester"
      className="absolute left-3 z-40 w-64 rounded-lg border-2 border-[#07111f] bg-white/95 p-3 shadow-lg backdrop-blur"
      style={{ bottom: VOICE_FLAPPY_GROUND_HEIGHT + 12 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase text-[#07111f]">Voice tester</span>
        <span className="font-mono text-xs font-bold text-muted-foreground">{Math.round(level * 100)}%</span>
      </div>
      <div className="grid grid-cols-2 rounded-md bg-muted p-1" role="group" aria-label="Voice tester mode">
        {(["manual", "auto"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            className={cn("h-8 rounded-sm text-xs font-bold capitalize", mode === option ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}
            onClick={() => onModeChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_36px] items-center gap-2">
        <input
          aria-label="Simulated voice volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(level * 100)}
          disabled={mode === "auto"}
          className="h-8 w-full accent-[#ff4f00] disabled:opacity-50"
          onChange={(event) => onLevelChange(Number(event.target.value) / 100)}
        />
        <Button type="button" size="icon" variant="outline" className="size-9" title="Flap impulse" aria-label="Test flap impulse" onClick={onFlap}>
          <Gamepad2 className="size-4" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Simulated voice presets">
        {([
          { label: "Silent", value: 0 },
          { label: "Hold", value: 0.4 },
          { label: "Lift", value: 0.75 }
        ] as const).map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={mode === "auto"}
            aria-label={`Set simulated voice to ${preset.label.toLowerCase()}`}
            className={cn(
              "h-7 rounded-sm border text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40",
              mode === "manual" && Math.abs(level - preset.value) < 0.01 ? "border-[#ff4f00] bg-[#fff0e8] text-[#b73500]" : "border-border bg-white text-muted-foreground"
            )}
            onClick={() => onLevelChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function VoiceLevelBar({
  level,
  targetLevel,
  noiseGateLevel,
  backgroundNoiseLevel
}: {
  level: number;
  targetLevel: number;
  noiseGateLevel: number;
  backgroundNoiseLevel: number;
}) {
  const fillHeight = `${clampArcadeValue(level, 0, 1) * 100}%`;
  const targetBottom = `${clampArcadeValue(targetLevel, 0, 1) * 100}%`;
  const noiseGateBottom = `${clampArcadeValue(noiseGateLevel, 0, 1) * 100}%`;
  const backgroundHeight = `${clampArcadeValue(backgroundNoiseLevel, 0, 1) * 100}%`;

  return (
    <div
      data-testid="voice-flappy-meter"
      data-level={level.toFixed(3)}
      data-target-level={targetLevel.toFixed(3)}
      data-noise-gate-level={noiseGateLevel.toFixed(3)}
      data-background-noise-level={backgroundNoiseLevel.toFixed(3)}
      className="pointer-events-none absolute right-4 top-4 z-30 grid w-11 grid-rows-[1fr_auto] gap-2"
      style={{ bottom: VOICE_FLAPPY_GROUND_HEIGHT + 12 }}
    >
      <div className="relative overflow-hidden rounded-full border-2 border-[#07111f] bg-white/80 shadow-sm backdrop-blur">
        <div className="absolute bottom-0 left-0 right-0 bg-slate-400/45 transition-[height] duration-100" style={{ height: backgroundHeight }} />
        <div className="absolute bottom-0 left-0 right-0 bg-primary transition-[height] duration-100" style={{ height: fillHeight }} />
        <div className="absolute left-1 right-1 h-2 -translate-y-1/2 rounded-full border border-[#07111f] bg-[#ffb000]" style={{ bottom: targetBottom }} />
        <div className="absolute -left-0.5 right-0 h-1.5 -translate-y-1/2 rounded-full border border-[#07111f] bg-red-500" style={{ bottom: noiseGateBottom }} />
      </div>
      <div className="rounded-full border border-[#07111f] bg-white/90 px-1.5 py-1 text-center text-[10px] font-black uppercase leading-none">
        Voice
      </div>
    </div>
  );
}

function VoiceNoiseGateControl({
  value,
  backgroundNoiseLevel,
  disabled,
  onChange
}: {
  value: number;
  backgroundNoiseLevel: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      data-testid="voice-flappy-noise-gate"
      className="absolute bottom-12 left-4 z-30 grid w-56 gap-2 rounded-lg border-2 border-[#07111f] bg-white/90 p-2 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase text-[#07111f]">Background noise gate</span>
        <span className="font-mono text-[10px] font-black text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
        <span className="absolute inset-y-0 left-0 bg-slate-400" style={{ width: `${clampArcadeValue(backgroundNoiseLevel, 0, 1) * 100}%` }} />
        <span className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-red-500" style={{ left: `${clampArcadeValue(value, 0, 1) * 100}%` }} />
      </div>
      <input
        aria-label="Background noise gate"
        type="range"
        min={0}
        max={0.9}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full accent-red-500"
      />
    </div>
  );
}

async function startLegacyVoiceInput(
  setSensorLabel: (value: string) => void,
  volumeRef: MutableRefObject<number>,
  noiseGateRef: MutableRefObject<number>,
  setVoiceLevel: (value: number) => void,
  setBackgroundNoiseLevel: (value: number) => void,
  cleanupRef: MutableRefObject<(() => void) | null>
) {
  if (cleanupRef.current) {
    return;
  }
  if (!ARCADE_CONFIG.voiceEnabled || !navigator.mediaDevices?.getUserMedia) {
    setSensorLabel("Space fallback");
    return;
  }
  let cancelled = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  cleanupRef.current = () => {
    cancelled = true;
  };
  try {
    setSensorLabel("Calibrating mic");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      },
      video: false
    });
    if (cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      cleanupRef.current = null;
      return;
    }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      stream.getTracks().forEach((track) => track.stop());
      setSensorLabel("Space fallback");
      cleanupRef.current = null;
      return;
    }
    context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const calibrationStarted = performance.now();
    let ambient = 0;
    let hasAmbientSample = false;
    let smoothedLevel = 0;
    let frameId = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((sum, value) => {
        const centered = (value - 128) / 128;
        return sum + centered * centered;
      }, 0) / data.length);
      if (!hasAmbientSample) {
        ambient = rms;
        hasAmbientSample = true;
      }
      const calibrating = performance.now() - calibrationStarted < 1200;
      if (rms <= ambient * 1.6 + 0.002) {
        const ambientWeight = calibrating ? 0.18 : 0.008;
        ambient = ambient * (1 - ambientWeight) + rms * ambientWeight;
      }
      const backgroundLevel = clampArcadeValue((ambient * 1.25 + 0.0015) * 18, 0, 1);
      const rawLevel = clampArcadeValue(rms * 18, 0, 1);
      const effectiveGate = Math.max(noiseGateRef.current, backgroundLevel);
      const gatedSignal = rawLevel <= effectiveGate
        ? 0
        : (rawLevel - effectiveGate) / Math.max(0.08, 1 - effectiveGate);
      const normalizedSignal = Math.pow(clampArcadeValue(gatedSignal, 0, 1), 0.75);
      smoothedLevel = smoothedLevel * 0.68 + normalizedSignal * 0.32;
      volumeRef.current = smoothedLevel;
      setVoiceLevel(smoothedLevel);
      setBackgroundNoiseLevel(backgroundLevel);
      setSensorLabel(calibrating ? "Calibrating mic" : smoothedLevel > 0.04 ? "Voice accepted" : "Noise gated");
      frameId = requestAnimationFrame(tick);
    };
    tick();
    cleanupRef.current = () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      volumeRef.current = 0;
      setVoiceLevel(0);
      setBackgroundNoiseLevel(0);
      void context?.close();
    };
  } catch {
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close();
    cleanupRef.current = null;
    setSensorLabel("Space fallback");
  }
}

function createRhythmTarget(step: number, deck: readonly FaceRhythmExpression[]) {
  return {
    id: step,
    expression: deck[step % deck.length] ?? FACE_RHYTHM_EXPRESSIONS[0],
    y: -16
  };
}

function getWhackExpressionPool(level: number) {
  return WHACK_LEVEL_EXPRESSIONS[Math.max(0, Math.min(WHACK_LEVEL_EXPRESSIONS.length - 1, level - 1))] ?? WHACK_EXPRESSIONS;
}

function getWhackTarget(seed: number, expressions: readonly AvatarExpression[] = WHACK_EXPRESSIONS) {
  return expressions[Math.floor(seededArcadeFraction(seed * 19 + 3) * expressions.length)] ?? WHACK_EXPRESSIONS[0];
}

function getWhackLevel(remainingSeconds: number) {
  const elapsedSeconds = Math.max(0, WHACK_DURATION_SECONDS - remainingSeconds);
  return Math.min(WHACK_LEVEL_COUNT, Math.floor(elapsedSeconds / WHACK_LEVEL_DURATION_SECONDS) + 1);
}

function getWhackPopupIntervalMs(level: number) {
  const levelIndex = Math.max(0, Math.min(WHACK_LEVEL_COUNT - 1, level - 1));
  const levelSpeed = WHACK_LEVEL_SPEED_BOOST ** levelIndex;
  const base = WHACK_LEVEL_ONE_POPUP_MS.base / levelSpeed;
  return base;
}

function createWhackState(seed: number, target: AvatarExpression, expressions: readonly AvatarExpression[] = WHACK_EXPRESSIONS): Array<AvatarExpression | null> {
  const targetIndex = Math.floor(seededArcadeFraction(seed * 23 + 11) * 9);
  const availableIndexes = Array.from({ length: 9 }, (_, index) => index).filter((index) => index !== targetIndex);
  const decoyIndexes = new Set<number>(
    availableIndexes
      .sort((left, right) => seededArcadeFraction(seed * 31 + left * 7) - seededArcadeFraction(seed * 31 + right * 7))
      .slice(0, 2)
  );
  const decoys = expressions.filter((expression) => expression !== target);

  return Array.from({ length: 9 }, (_, index) => {
    if (index === targetIndex) {
      return target;
    }
    if (!decoyIndexes.has(index)) {
      return null;
    }
    return decoys[Math.floor(seededArcadeFraction(seed * 37 + index * 13) * decoys.length)] ?? null;
  });
}
