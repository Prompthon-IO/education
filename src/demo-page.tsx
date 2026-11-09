import { useEffect, useState } from "react";
import {
  Clapperboard,
  Gamepad2,
  Mic2,
  Move,
  Pause,
  Play,
  RotateCcw,
  ScanFace,
  SkipForward,
  Sparkles,
  Volume2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  AvatarSprite,
  useArcadeAvatarManifest,
  type ArcadeAvatarAsset
} from "./arcade-ui";
import type { AvatarExpression, AvatarManifest } from "./arcade";
import voiceFlappyControlImage from "./assets/demo-controls/voice-flappy-control.webp";
import wordSnakeControlImage from "./assets/demo-controls/word-snake-control.webp";
import faceSimonControlImage from "./assets/demo-controls/face-simon-control.webp";

export type DemoGameId = "voice-flappy" | "word-snake" | "face-simon";

type DemoScene = {
  id: DemoGameId;
  name: string;
  mode: string;
  durationMs: number;
  accent: string;
  controlImage: string;
  controlLabel: string;
  controlDetail: string;
};

type DemoVisualProps = {
  elapsedMs: number;
  avatarAsset: ArcadeAvatarAsset;
  manifest: AvatarManifest;
};

const DEMO_TICK_MS = 40;
const DEMO_SCENES: DemoScene[] = [
  {
    id: "voice-flappy",
    name: "Voice Flappy",
    mode: "Voice controlled",
    durationMs: 8_000,
    accent: "#10a37f",
    controlImage: voiceFlappyControlImage,
    controlLabel: "Use your voice",
    controlDetail: "Make a sound to lift the avatar."
  },
  {
    id: "word-snake",
    name: "Word Snake",
    mode: "Gesture guided",
    durationMs: 8_500,
    accent: "#ff5a00",
    controlImage: wordSnakeControlImage,
    controlLabel: "Steer with one finger",
    controlDetail: "Move your finger to turn the snake."
  },
  {
    id: "face-simon",
    name: "Face Simon",
    mode: "Expression memory",
    durationMs: 8_000,
    accent: "#d946ef",
    controlImage: faceSimonControlImage,
    controlLabel: "Play with expressions",
    controlDetail: "Copy each face in the sequence."
  }
];
const DEMO_TOTAL_SECONDS = Math.round(DEMO_SCENES.reduce((total, scene) => total + scene.durationMs, 0) / 1000);
const FALLBACK_AVATAR_ASSET: ArcadeAvatarAsset = {
  dataUrl: "/generated-avatar/current-sprite-sheet.png",
  previewUrl: "/generated-avatar/current-sprite-sheet-preview.png",
  name: "Demo avatar"
};

export function DemoPage({
  avatarAsset,
  onOpenGame
}: {
  avatarAsset: ArcadeAvatarAsset | null;
  onOpenGame: (gameId: DemoGameId) => void;
}) {
  const manifest = useArcadeAvatarManifest();
  const activeAvatarAsset = avatarAsset ?? FALLBACK_AVATAR_ASSET;
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const scene = DEMO_SCENES[activeIndex];

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMs((currentElapsedMs) => currentElapsedMs + DEMO_TICK_MS);
    }, DEMO_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  useEffect(() => {
    if (elapsedMs < scene.durationMs) {
      return;
    }
    setElapsedMs(0);
    setActiveIndex((currentIndex) => (currentIndex + 1) % DEMO_SCENES.length);
  }, [elapsedMs, scene.durationMs]);

  function selectScene(index: number) {
    setActiveIndex(index);
    setElapsedMs(0);
  }

  function showNextScene() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % DEMO_SCENES.length);
    setElapsedMs(0);
  }

  const progress = Math.min(100, (elapsedMs / scene.durationMs) * 100);

  return (
    <div data-testid="demo-page" className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f7f7f4] text-[#07111f]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-white px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="size-7" aria-label="Toggle application navigation" />
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[#07111f] text-white">
            <Clapperboard className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black">Demo Reel</h1>
            <p className="truncate text-xs font-semibold text-muted-foreground">Arcade visitor preview</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="hidden gap-1.5 bg-white sm:flex">
            <span className={cn("size-1.5 rounded-full", isPlaying ? "bg-[#10a37f]" : "bg-[#ffb000]")} />
            {isPlaying ? "Auto playing" : "Paused"}
          </Badge>
          <span className="text-xs font-black tabular-nums text-muted-foreground">{activeIndex + 1}/{DEMO_SCENES.length}</span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4">
          <div className="grid min-h-[640px] flex-1 gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="relative min-h-[520px] overflow-hidden rounded-lg border-2 border-[#07111f] bg-white shadow-[4px_4px_0_#07111f] xl:min-h-0">
              <div key={scene.id} className="absolute inset-0 animate-in fade-in zoom-in-95 duration-500">
                <DemoSceneVisual sceneId={scene.id} elapsedMs={elapsedMs} avatarAsset={activeAvatarAsset} manifest={manifest} />
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-3 border-b-2 border-[#07111f] bg-white/95 px-3 py-2 backdrop-blur-sm sm:px-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: scene.accent }} />
                    <h2 className="truncate text-base font-black sm:text-lg">{scene.name}</h2>
                  </div>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{scene.mode}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="hidden text-[10px] font-black uppercase text-muted-foreground sm:block">How to control</p>
                    <p className="max-w-24 text-[10px] font-black leading-tight sm:max-w-40 sm:text-xs">{scene.controlLabel}</p>
                  </div>
                  <img
                    src={scene.controlImage}
                    alt={scene.controlDetail}
                    className="size-14 rounded-md border-2 border-[#07111f] object-cover shadow-[2px_2px_0_#07111f] sm:size-16"
                    draggable={false}
                  />
                  <Badge className="hidden shrink-0 bg-[#07111f] text-white hover:bg-[#07111f] md:inline-flex">Simulation</Badge>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-40 border-t-2 border-[#07111f] bg-white px-3 py-2.5 sm:px-4">
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb]" aria-hidden="true">
                  <div
                    className="h-full rounded-full transition-[width] duration-75"
                    style={{ width: `${progress}%`, backgroundColor: scene.accent }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={isPlaying ? "Pause demo" : "Play demo"}
                      title={isPlaying ? "Pause demo" : "Play demo"}
                      onClick={() => setIsPlaying((current) => !current)}
                    >
                      {isPlaying ? <Pause /> : <Play />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Restart preview"
                      title="Restart preview"
                      onClick={() => setElapsedMs(0)}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next preview"
                      title="Next preview"
                      onClick={showNextScene}
                    >
                      <SkipForward />
                    </Button>
                  </div>
                  <Button type="button" size="sm" className="gap-1.5" onClick={() => onOpenGame(scene.id)}>
                    <Gamepad2 />
                    Open game
                  </Button>
                </div>
              </div>
            </section>

            <aside className="flex min-h-0 flex-col border-l-2 border-[#07111f] bg-white px-4 py-4 xl:bg-transparent">
              <div className="hidden border-b pb-4 xl:block">
                <p className="text-xs font-black uppercase text-muted-foreground">How to control</p>
                <div className="mt-3 aspect-square overflow-hidden rounded-md border-2 border-[#07111f] bg-white shadow-[3px_3px_0_#07111f]">
                  <img src={scene.controlImage} alt="" className="size-full object-cover" draggable={false} />
                </div>
                <p className="mt-3 text-base font-black">{scene.controlLabel}</p>
                <p className="text-xs font-semibold text-muted-foreground">{scene.controlDetail}</p>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Playlist</p>
                  <h2 className="mt-1 text-lg font-black">Three quick plays</h2>
                </div>
                <Sparkles className="mt-1 size-5 text-[#ff5a00]" />
              </div>

              <div className="divide-y">
                {DEMO_SCENES.map((demoScene, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={demoScene.id}
                      type="button"
                      className={cn(
                        "group grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 py-4 text-left transition-colors",
                        isActive ? "text-[#07111f]" : "text-muted-foreground hover:text-[#07111f]"
                      )}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => selectScene(index)}
                    >
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-md border text-xs font-black",
                          isActive ? "border-[#07111f] text-white" : "border-border bg-white"
                        )}
                        style={isActive ? { backgroundColor: demoScene.accent } : undefined}
                      >
                        0{index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{demoScene.name}</span>
                        <span className="block truncate text-xs font-semibold">{demoScene.mode}</span>
                      </span>
                      <span className={cn("h-8 w-1 rounded-full", isActive ? "opacity-100" : "opacity-0")} style={{ backgroundColor: demoScene.accent }} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto border-t pt-4 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>No camera or mic needed</span>
                  <span className="font-black tabular-nums">{DEMO_TOTAL_SECONDS} sec</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function DemoSceneVisual({
  sceneId,
  elapsedMs,
  avatarAsset,
  manifest
}: DemoVisualProps & { sceneId: DemoGameId }) {
  if (sceneId === "voice-flappy") {
    return <VoiceFlappyDemo elapsedMs={elapsedMs} avatarAsset={avatarAsset} manifest={manifest} />;
  }
  if (sceneId === "word-snake") {
    return <WordSnakeDemo elapsedMs={elapsedMs} avatarAsset={avatarAsset} manifest={manifest} />;
  }
  return <FaceSimonDemo elapsedMs={elapsedMs} avatarAsset={avatarAsset} manifest={manifest} />;
}

function VoiceFlappyDemo({ elapsedMs, avatarAsset, manifest }: DemoVisualProps) {
  const seconds = elapsedMs / 1000;
  const birdTop = 44 + Math.sin(seconds * 3.1) * 4;
  const voiceLevel = 0.52 + Math.sin(seconds * 3.1) * 0.27;
  const score = 8 + Math.floor(elapsedMs / 1_450);
  const pipeGapCenters = [40, 49, 43];
  const pipeOffsets = [105, 160, 215];
  const travel = elapsedMs * 0.019;
  const expression: AvatarExpression = voiceLevel > 0.63 ? "excited" : "happy";

  return (
    <div data-testid="demo-voice-flappy" className="absolute inset-0 overflow-hidden bg-[#dff6ff]">
      <div className="absolute left-[8%] top-[20%] h-7 w-28 rounded-full border-2 border-[#07111f]/10 bg-white/90" />
      <div className="absolute left-[52%] top-[27%] h-5 w-20 rounded-full border-2 border-[#07111f]/10 bg-white/80" />
      <div className="absolute inset-x-0 bottom-[12%] h-[24%] bg-[#b7e4c7]" />

      {pipeOffsets.map((offset, index) => {
        const x = positiveModulo(offset - travel + 18, 165) - 18;
        const gapCenter = pipeGapCenters[index];
        const gapSize = 31;
        const upperHeight = gapCenter - gapSize / 2;
        const lowerTop = gapCenter + gapSize / 2;
        return (
          <div key={offset} className="absolute inset-y-0 z-10 w-[8%] min-w-12" style={{ left: `${x}%` }}>
            <div className="absolute inset-x-0 top-0 rounded-b-md border-2 border-[#07111f] bg-[#10a37f] shadow-[inset_-7px_0_rgba(0,0,0,0.09)]" style={{ height: `${upperHeight}%` }}>
              <span className="absolute -bottom-2 -left-1 h-4 w-[calc(100%+8px)] rounded-sm border-2 border-[#07111f] bg-[#20bd91]" />
            </div>
            <div className="absolute inset-x-0 bottom-[12%] rounded-t-md border-2 border-[#07111f] bg-[#10a37f] shadow-[inset_-7px_0_rgba(0,0,0,0.09)]" style={{ top: `${lowerTop}%` }}>
              <span className="absolute -top-2 -left-1 h-4 w-[calc(100%+8px)] rounded-sm border-2 border-[#07111f] bg-[#20bd91]" />
            </div>
          </div>
        );
      })}

      <div className="absolute left-4 top-[92px] z-30 flex items-center gap-2 rounded-md border-2 border-[#07111f] bg-white px-3 py-2 shadow-[2px_2px_0_#07111f]">
        <Mic2 className="size-4 text-[#10a37f]" />
        <span className="text-sm font-black tabular-nums">{Math.round(voiceLevel * 100)}%</span>
      </div>
      <div className="absolute right-4 top-[92px] z-30 text-right">
        <p className="text-[10px] font-black uppercase text-[#07111f]/60">Pipes</p>
        <p className="text-3xl font-black tabular-nums">{score}</p>
      </div>

      <div
        className="absolute left-[22%] z-30 grid size-16 place-items-center sm:size-20"
        style={{ top: `${birdTop}%`, transform: "translateY(-50%)" }}
      >
        <span className="absolute -left-3 h-8 w-10 rounded-[70%_25%_70%_25%] border-2 border-[#07111f] bg-[#ffb000]" style={{ transform: `rotate(${voiceLevel > 0.55 ? -24 : 18}deg)` }} />
        <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="relative z-10 size-14 sm:size-16" />
      </div>

      <div className="absolute bottom-[16%] left-4 z-30 flex items-end gap-1" aria-hidden="true">
        <Volume2 className="mb-0.5 size-4" />
        {[0.24, 0.42, 0.61, 0.78, 0.96].map((threshold) => (
          <span key={threshold} className={cn("w-1.5 rounded-sm", voiceLevel >= threshold ? "bg-[#ff5a00]" : "bg-white/80")} style={{ height: `${10 + threshold * 22}px` }} />
        ))}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-20 h-[12%] border-t-2 border-[#07111f] bg-[#ffd66b]"
        style={{ backgroundImage: "repeating-linear-gradient(135deg,#ffd66b 0 14px,#e7aa37 14px 28px)", backgroundPositionX: `${-elapsedMs * 0.12}px` }}
      />
    </div>
  );
}

const WORD_SNAKE_SIZE = 8;
const WORD_SNAKE_PATH = [
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 3, y: 5 },
  { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 },
  { x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 },
  { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
  { x: 6, y: 1 }
];
const WORD_SNAKE_TARGETS = [
  { x: 3, y: 5, letter: "P", step: 3 },
  { x: 5, y: 3, letter: "L", step: 7 },
  { x: 2, y: 2, letter: "A", step: 11 },
  { x: 5, y: 1, letter: "Y", step: 15 }
];
const WORD_SNAKE_DECOYS = [
  { x: 1, y: 2, letter: "S" },
  { x: 6, y: 3, letter: "R" },
  { x: 1, y: 5, letter: "T" },
  { x: 6, y: 6, letter: "O" }
];

function WordSnakeDemo({ elapsedMs, avatarAsset, manifest }: DemoVisualProps) {
  const frameStep = Math.floor(elapsedMs / 430) % (WORD_SNAKE_PATH.length + 3);
  const headIndex = Math.min(frameStep, WORD_SNAKE_PATH.length - 1);
  const collectedCount = WORD_SNAKE_TARGETS.filter((target) => frameStep > target.step).length;
  const nextLetter = "PLAY"[collectedCount] ?? "Done";

  return (
    <div data-testid="demo-word-snake" className="absolute inset-0 overflow-hidden bg-[#fff9f3] px-4 pb-20 pt-[92px] sm:px-6">
      <div className="mx-auto grid h-full max-w-4xl place-items-center gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="grid aspect-square max-h-full w-full max-w-[500px] grid-cols-8 overflow-hidden rounded-md border-2 border-[#07111f] bg-white shadow-[4px_4px_0_#ff5a00]">
          {Array.from({ length: WORD_SNAKE_SIZE * WORD_SNAKE_SIZE }, (_, index) => {
            const x = index % WORD_SNAKE_SIZE;
            const y = Math.floor(index / WORD_SNAKE_SIZE);
            const target = WORD_SNAKE_TARGETS.find((item) => item.x === x && item.y === y && frameStep <= item.step);
            const decoy = WORD_SNAKE_DECOYS.find((item) => item.x === x && item.y === y);
            const segmentOffset = [0, 1, 2, 3].find((offset) => {
              const pathPoint = WORD_SNAKE_PATH[headIndex - offset];
              return pathPoint?.x === x && pathPoint?.y === y;
            });
            const isHead = segmentOffset === 0;
            const hasBody = segmentOffset !== undefined && !isHead;
            const isCurrentTarget = Boolean(target && target.step === headIndex);

            return (
              <div key={`${x}-${y}`} className={cn("relative grid min-h-0 place-items-center border-b border-r border-[#07111f]/10", isCurrentTarget && "bg-[#fff1e7]")}>
                {target ? (
                  <span className="grid size-[66%] place-items-center rounded-sm border-2 border-[#07111f] bg-[#ffd66b] text-[clamp(0.7rem,2vw,1.35rem)] font-black shadow-[2px_2px_0_#07111f]">
                    {target.letter}
                  </span>
                ) : decoy ? (
                  <span className="grid size-[58%] place-items-center rounded-sm border border-[#07111f]/25 bg-[#edf1f4] text-[clamp(0.65rem,1.7vw,1.1rem)] font-black text-[#07111f]/55">
                    {decoy.letter}
                  </span>
                ) : null}
                {hasBody ? <span className="absolute size-[58%] rounded-full border-2 border-[#07111f] bg-[#ff7a33]" /> : null}
                {isHead ? (
                  <AvatarSprite
                    asset={avatarAsset}
                    manifest={manifest}
                    expression={isCurrentTarget ? "excited" : "happy"}
                    className="absolute z-10 size-[78%]"
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="hidden w-full self-center sm:block">
          <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
            <Move className="size-4 text-[#ff5a00]" />
            Hand control
          </div>
          <div className="space-y-2">
            {"PLAY".split("").map((letter, index) => (
              <div key={letter} className={cn("flex items-center gap-2 border-b pb-2", index < collectedCount ? "text-[#10a37f]" : "text-[#07111f]/35")}>
                <span className={cn("grid size-7 place-items-center rounded-sm border text-sm font-black", index < collectedCount && "border-[#10a37f] bg-[#dcfce7]")}>{letter}</span>
                <span className="text-xs font-bold">{index < collectedCount ? "Collected" : index === collectedCount ? "Next" : "Waiting"}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t-2 border-[#07111f] pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Next tile</p>
            <p className="text-2xl font-black">{nextLetter}</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[84px] left-4 flex items-center gap-2 rounded-md border-2 border-[#07111f] bg-white px-3 py-2 shadow-[2px_2px_0_#07111f] sm:hidden">
        <span className="text-xs font-semibold text-muted-foreground">Phrase</span>
        <span className="font-black tracking-normal">{"PLAY".slice(0, collectedCount)}<span className="text-[#07111f]/25">{"PLAY".slice(collectedCount)}</span></span>
      </div>
    </div>
  );
}

const FACE_SIMON_SEQUENCE: AvatarExpression[] = ["happy", "surprised", "sleepy", "playful"];
const FACE_SIMON_OPTIONS: AvatarExpression[] = ["happy", "playful", "surprised", "sleepy"];

function FaceSimonDemo({ elapsedMs, avatarAsset, manifest }: DemoVisualProps) {
  const cycleMs = elapsedMs % 7_600;
  const isWatching = cycleMs < 3_500;
  const sequenceIndex = isWatching
    ? Math.min(FACE_SIMON_SEQUENCE.length - 1, Math.floor(cycleMs / 875))
    : Math.min(FACE_SIMON_SEQUENCE.length - 1, Math.floor((cycleMs - 3_500) / 900));
  const activeExpression = FACE_SIMON_SEQUENCE[sequenceIndex];
  const completedCount = isWatching ? 0 : Math.min(FACE_SIMON_SEQUENCE.length, sequenceIndex + 1);

  return (
    <div data-testid="demo-face-simon" className="absolute inset-0 overflow-hidden bg-[#120d24] px-4 pb-20 pt-[92px] text-white sm:px-8">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at center,rgba(217,70,239,0.45) 0,transparent 52%)" }} />
      <div className="relative mx-auto grid h-full max-w-5xl min-h-0 items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.72fr)]">
        <div className="flex min-h-0 flex-col items-center justify-center">
          <Badge className={cn("mb-4 border-0 text-white", isWatching ? "bg-[#2563eb]" : "bg-[#ff5a00]")}>
            {isWatching ? "Watch" : "Your turn"}
          </Badge>
          <div className="relative grid size-44 place-items-center rounded-full border-2 border-white/60 bg-white/10 shadow-[0_0_64px_rgba(217,70,239,0.34)] sm:size-56">
            <span className="absolute inset-3 rounded-full border border-white/15" />
            <AvatarSprite asset={avatarAsset} manifest={manifest} expression={activeExpression} className="size-32 sm:size-40" showExpressionOverlay />
          </div>
          <p className="mt-4 text-xl font-black capitalize">{activeExpression}</p>
          <div className="mt-4 flex items-center gap-2" aria-label={`${completedCount} of ${FACE_SIMON_SEQUENCE.length} expressions repeated`}>
            {FACE_SIMON_SEQUENCE.map((expression, index) => (
              <span
                key={`${expression}-${index}`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  index === sequenceIndex ? "w-8 bg-[#ff5a00]" : index < completedCount ? "w-2.5 bg-[#10a37f]" : "w-2.5 bg-white/25"
                )}
              />
            ))}
          </div>
        </div>

        <div className="hidden min-h-0 md:block">
          <div className="mb-3 flex items-center justify-between border-b border-white/20 pb-3">
            <div className="flex items-center gap-2">
              <ScanFace className="size-4 text-[#f0abfc]" />
              <span className="text-xs font-black uppercase text-white/65">Face camera</span>
            </div>
            <span className="text-xs font-black text-[#86efac]">Tracking</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FACE_SIMON_OPTIONS.map((expression) => {
              const isActive = !isWatching && expression === activeExpression;
              return (
                <div
                  key={expression}
                  className={cn(
                    "grid aspect-square place-items-center rounded-md border-2 bg-white/5 p-3 transition-colors",
                    isActive ? "border-[#ff5a00] bg-[#ff5a00]/15" : "border-white/20"
                  )}
                >
                  <AvatarSprite asset={avatarAsset} manifest={manifest} expression={expression} className="size-[70%]" showExpressionOverlay />
                  <span className="mt-1 text-xs font-bold capitalize text-white/80">{expression}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-[92px] z-20 text-right text-white sm:right-6">
        <p className="text-[10px] font-black uppercase text-white/55">Score</p>
        <p className="text-3xl font-black tabular-nums">{24 + completedCount}</p>
      </div>
    </div>
  );
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
