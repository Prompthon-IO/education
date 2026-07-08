import {
  ChevronDown,
  CircleDot,
  Camera,
  CameraOff,
  FlaskConical,
  Gamepad2,
  Hand,
  HeartPulse,
  Info,
  ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Download,
  SkipBack,
  SkipForward,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  type Material,
  type Vector,
  MATERIALS,
  clamp,
  collide1D,
  collideWithStatic1D,
  collide2D,
  kineticEnergy,
  kineticEnergy2D,
  materialRestitution,
  momentum1D,
  playbackDeltaSeconds,
  radiusFromMass,
  reflectVelocity,
  speedToVector,
  vectorAngleDegrees,
  vectorSpeed,
  wallBounce
} from "./physics";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import prompthonLogo from "./assets/prompthon-community-light.png";
import prompthonSquareLogo from "./assets/prompthon-square-light.png";
import collisionLabConfigJson from "./data/applications/collision-lab.json";
import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { type ChangeEvent, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Mode = "1d" | "2d" | "challenge";

type SpriteEmotion = "happy" | "excited" | "sad" | "dizzy" | "playful" | "sleepy";

type SpriteSheetConfig = {
  columns: number;
  rows: number;
  frameSize?: number;
  frameWidth?: number;
  frameHeight?: number;
  renderAspectRatio?: number;
  layout?: "vertical-pairs" | "horizontal-emotions";
};

type ObjectShapeAsset = {
  dataUrl: string;
  previewUrl?: string;
  name: string;
  mimeType: "image/png" | "image/gif";
  spriteSheet?: SpriteSheetConfig;
};

type ObjectShapeAssetConfig = Omit<ObjectShapeAsset, "dataUrl"> & {
  targetFile: string;
};

type ObjectSettings = {
  id: string;
  name: string;
  color: string;
  mass: number;
  speed: number;
  angle: number;
  material: Material;
  isStatic: boolean;
  shapeAsset?: ObjectShapeAsset;
  position?: Vector;
};

type ApplicationConfigObject = Omit<ObjectSettings, "material" | "shapeAsset"> & {
  material: string;
  shapeAsset?: ObjectShapeAssetConfig;
};

type ApplicationConfig = {
  id: string;
  name: string;
  subtitle: string;
  showcaseLabel: string;
  tip: string;
  theme: {
    objectA: string;
    objectB: string;
    ink: string;
    grid: string;
    border: string;
    wall: string;
  };
  objectPalette: string[];
  simulation: {
    objectRadiusMultiplier: number;
  };
  objects: ApplicationConfigObject[];
};

type ApplicationId = "collision-lab" | "word-snake" | "settings";

type NavigationApplication = {
  id: ApplicationId;
  name: string;
};

type SimObject = {
  id: string;
  name: string;
  color: string;
  mass: number;
  material: Material;
  isStatic: boolean;
  shapeAsset?: ObjectShapeAsset;
  position: Vector;
  velocity: Vector;
  radius: number;
};

type SimulationHistoryState = {
  objects: SimObject[];
  collisionCount: number;
  collided: boolean;
  frameNumber: number;
  challengeState: ChallengeState;
};

type CollisionReaction = {
  emotion: SpriteEmotion;
  untilFrame: number;
};

type Snapshot = {
  velocityA: Vector;
  velocityB: Vector;
  momentumA: Vector;
  momentumB: Vector;
  energyA: number;
  energyB: number;
  collisionCount: number;
};

type WorldBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type DrawState = {
  origin: Vector;
  scale: number;
  bounds: WorldBounds;
};

type CanvasInteraction = {
  objectId: string;
  type: "move" | "angle";
};

type ChallengeStatus = "ready" | "running" | "won" | "lost";

type ChallengeFood = {
  id: string;
  position: Vector;
  radius: number;
  hp: number;
  active: boolean;
};

type ChallengeState = {
  warriorHp: number;
  monsterHp: number;
  foods: ChallengeFood[];
  status: ChallengeStatus;
  score: number;
  lastEvent: string;
};

const ASSET_URLS = import.meta.glob("./assets/**/*", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

const APPLICATION_CONFIG = collisionLabConfigJson as ApplicationConfig;
const WORD_SNAKE_CONFIG = {
  id: "word-snake" as const,
  name: "Word Snake",
  subtitle: "Guide the snake through characters in the exact phrase order.",
  showcaseLabel: "Student showcase: word chase",
  tip: "Tip: follow the phrase order and ignore decoys."
};
const SETTINGS_CONFIG = {
  id: "settings" as const,
  name: "Settings",
  subtitle: "Codex-guided reusable avatar sprite sheets.",
  tip: "Tip: ask Codex to generate the sprite sheet, then preview the reusable result here."
};
const APPLICATION_CONFIGS: NavigationApplication[] = [
  { id: APPLICATION_CONFIG.id as ApplicationId, name: APPLICATION_CONFIG.name },
  { id: WORD_SNAKE_CONFIG.id, name: WORD_SNAKE_CONFIG.name }
];
const LIVE_SPRITE_SHEET_PATH = "/generated-avatar/current-sprite-sheet.png";
const LIVE_SPRITE_SHEET_PREVIEW_PATH = "/generated-avatar/current-sprite-sheet-preview.png";
const SPRITE_TEMPLATE_PATH = "/generated-avatar/sprite-template-4x7.png";
const SPRITE_TEMPLATE_MANIFEST_PATH = "/generated-avatar/sprite-template-4x7-manifest.json";
const FIXED_AVATAR_SHEET_ASPECT_RATIO = "4 / 7";
const SPRITE_TEMPLATE_ASSET: ObjectShapeAsset = {
  dataUrl: SPRITE_TEMPLATE_PATH,
  previewUrl: SPRITE_TEMPLATE_PATH,
  name: "FIRA x Prompthon 4x7 avatar template",
  mimeType: "image/png"
};
const COLORS = APPLICATION_CONFIG.theme;
const OBJECT_COLORS = APPLICATION_CONFIG.objectPalette;

const MATERIAL_LABELS: Record<Material, string> = {
  rubber: "Rubber",
  steel: "Steel",
  wood: "Wood",
  clay: "Clay",
  glass: "Glass"
};

const MATERIAL_NOTES: Record<Material, string> = {
  rubber: "springy",
  steel: "very bouncy",
  wood: "medium bounce",
  clay: "sticky",
  glass: "crisp"
};

const INITIAL_OBJECTS = buildObjectSettings(APPLICATION_CONFIG.objects);
const OBJECT_RADIUS_MULTIPLIER = APPLICATION_CONFIG.simulation.objectRadiusMultiplier;
const EMPTY_SNAPSHOT: Snapshot = {
  velocityA: { x: 0, y: 0 },
  velocityB: { x: 0, y: 0 },
  momentumA: { x: 0, y: 0 },
  momentumB: { x: 0, y: 0 },
  energyA: 0,
  energyB: 0,
  collisionCount: 0
};

const MAX_HISTORY_STATES = 240;
const CHALLENGE_MAX_HP = 120;
const CHALLENGE_START_HP = 100;
const CHALLENGE_MONSTER_HP = 100;
const CHALLENGE_FOOD_RADIUS = 0.32;
const CHALLENGE_FOOD_HEAL = 22;
const CHALLENGE_DEFAULT_WIDTH = 20;
const CHALLENGE_DEFAULT_HEIGHT = 12;
const CHALLENGE_WARRIOR_RADIUS_SCALE = 0.56;
const CHALLENGE_MONSTER_RADIUS_SCALE = 0.62;
const CHALLENGE_COLLISION_DAMAGE = {
  warriorBase: 7,
  warriorSpeed: 4,
  monsterBase: 13,
  monsterSpeed: 7
};
const CHALLENGE_WALL_DAMAGE = {
  base: 16,
  speed: 3
};
const SPRITE_EMOTION_ROWS: Record<SpriteEmotion, number> = {
  happy: 0,
  excited: 1,
  sad: 2,
  dizzy: 3,
  playful: 4,
  sleepy: 5
};
const SPRITE_EMOTION_ORDER: SpriteEmotion[] = ["happy", "excited", "sad", "dizzy", "playful", "sleepy"];
const AVATAR_TEMPLATE_EMOTIONS = ["happy", "excited", "sad", "dizzy", "playful", "sleepy"] as const;
const AVATAR_TEMPLATE_STICKERS = AVATAR_TEMPLATE_EMOTIONS.flatMap((emotion) => [`${emotion} 1`, `${emotion} 2`]);
const SLEEPY_SPEED_THRESHOLD = 0.35;
const IMMINENT_COLLISION_SECONDS = 1.25;
const INITIAL_MODE: Mode = "challenge";
const INITIAL_WORLD_LENGTH = 14;
const INITIAL_WORLD_WIDTH = CHALLENGE_DEFAULT_WIDTH;
const INITIAL_WORLD_HEIGHT = CHALLENGE_DEFAULT_HEIGHT;
const INITIAL_CHALLENGE_BOUNDS: WorldBounds = {
  left: -INITIAL_WORLD_WIDTH / 2,
  right: INITIAL_WORLD_WIDTH / 2,
  top: -INITIAL_WORLD_HEIGHT / 2,
  bottom: INITIAL_WORLD_HEIGHT / 2,
  width: INITIAL_WORLD_WIDTH,
  height: INITIAL_WORLD_HEIGHT
};
const INITIAL_SIM_OBJECTS = createChallengeInitialObjects(INITIAL_OBJECTS, INITIAL_CHALLENGE_BOUNDS);
const INITIAL_CHALLENGE_STATE = createChallengeState(INITIAL_CHALLENGE_BOUNDS, INITIAL_SIM_OBJECTS);
const INITIAL_SNAPSHOT = createSnapshot(INITIAL_SIM_OBJECTS, 0);

export function App() {
  const [activeApplicationId, setActiveApplicationId] = useState<ApplicationId>("collision-lab");
  const [sharedAvatarAsset] = useState<ObjectShapeAsset | null>(null);

  if (activeApplicationId === "word-snake") {
    return (
      <WordSnakeApp
        activeApplicationId={activeApplicationId}
        onSelectApplication={setActiveApplicationId}
      />
    );
  }

  if (activeApplicationId === "settings") {
    return (
      <AvatarSettingsApp
        activeApplicationId={activeApplicationId}
        onSelectApplication={setActiveApplicationId}
        sharedAvatarAsset={sharedAvatarAsset}
      />
    );
  }

  return (
    <CollisionLabApp
      activeApplicationId={activeApplicationId}
      onSelectApplication={setActiveApplicationId}
      sharedAvatarAsset={sharedAvatarAsset}
    />
  );
}

function CollisionLabApp({
  activeApplicationId,
  onSelectApplication,
  sharedAvatarAsset
}: {
  activeApplicationId: ApplicationId;
  onSelectApplication: (applicationId: ApplicationId) => void;
  sharedAvatarAsset: ObjectShapeAsset | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const shapeImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const simRef = useRef<SimObject[]>(cloneSimObjects(INITIAL_SIM_OBJECTS));
  const collidedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const drawStateRef = useRef<DrawState | null>(null);
  const interactionRef = useRef<CanvasInteraction | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const collisionCountRef = useRef(0);
  const historyRef = useRef<SimulationHistoryState[]>([]);
  const futureRef = useRef<SimulationHistoryState[]>([]);
  const frameNumberRef = useRef(0);
  const assetFrameRef = useRef<number | null>(null);
  const collisionReactionRef = useRef<Record<string, CollisionReaction>>({});
  const challengeStateRef = useRef<ChallengeState>(cloneChallengeState(INITIAL_CHALLENGE_STATE));
  const resetInputsRef = useRef({ mode: INITIAL_MODE, worldLength: INITIAL_WORLD_LENGTH, worldWidth: INITIAL_WORLD_WIDTH, worldHeight: INITIAL_WORLD_HEIGHT });
  const [mode, setMode] = useState<Mode>(INITIAL_MODE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wallsEnabled, setWallsEnabled] = useState(false);
  const [wallMaterial, setWallMaterial] = useState<Material>("steel");
  const [worldLength, setWorldLength] = useState(INITIAL_WORLD_LENGTH);
  const [worldWidth, setWorldWidth] = useState(INITIAL_WORLD_WIDTH);
  const [worldHeight, setWorldHeight] = useState(INITIAL_WORLD_HEIGHT);
  const [zoom, setZoom] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(true);
  const [isCanvasFullDisplay, setIsCanvasFullDisplay] = useState(false);
  const [isWorldMenuOpen, setIsWorldMenuOpen] = useState(false);
  const [isReadoutPanelOpen, setIsReadoutPanelOpen] = useState(false);
  const [collapsedObjectIds, setCollapsedObjectIds] = useState<string[]>([]);
  const [objectSettings, setObjectSettings] = useState<ObjectSettings[]>(INITIAL_OBJECTS);
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL_SNAPSHOT);
  const [challengeState, setChallengeState] = useState<ChallengeState>(() => cloneChallengeState(challengeStateRef.current));
  const [timelineState, setTimelineState] = useState({ frameNumber: 0, canStepBack: false, canStepForward: true });

  const isChallengeMode = mode === "challenge";
  const activeSettings = mode === "1d"
    ? objectSettings.slice(0, 2)
    : isChallengeMode
      ? objectSettings.slice(0, 1)
      : objectSettings;
  const objectA = objectSettings[0];
  const objectB = objectSettings[1];
  const restitution = materialRestitution(objectA.material, objectB.material);
  const wallsActive = isChallengeMode || wallsEnabled;

  function resetSimulation(nextMode = mode) {
    const objects = nextMode === "challenge"
      ? createChallengeInitialObjects(objectSettings, getWorldBoundsForMode(nextMode))
      : createInitialObjects(nextMode, objectSettings);
    simRef.current = objects;
    challengeStateRef.current = nextMode === "challenge"
      ? createChallengeState(getWorldBoundsForMode(nextMode), objects)
      : createEmptyChallengeState();
    collidedRef.current = false;
    collisionCountRef.current = 0;
    historyRef.current = [];
    futureRef.current = [];
    frameNumberRef.current = 0;
    collisionReactionRef.current = {};
    lastTimeRef.current = null;
    syncTimelineState();
    setSnapshot(createSnapshot(objects, 0));
    setChallengeState(cloneChallengeState(challengeStateRef.current));
    drawScene(objects);
  }

  function stepSimulation(deltaSeconds = 1 / 30) {
    if (futureRef.current.length > 0) {
      restoreFutureSimulationState();
      return;
    }
    if (mode === "challenge" && challengeStateRef.current.status === "ready") {
      challengeStateRef.current = {
        ...challengeStateRef.current,
        status: "running",
        lastEvent: "Challenge started"
      };
    }
    pushSimulationHistory({ clearFuture: true });
    updateSimulation(playbackDeltaSeconds(deltaSeconds, playbackRate));
    frameNumberRef.current += 1;
    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
    setChallengeState(cloneChallengeState(challengeStateRef.current));
    syncTimelineState();
  }

  function stepBackSimulation() {
    const previousState = historyRef.current.pop();
    if (!previousState) {
      return;
    }
    setIsPlaying(false);
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    futureRef.current.push(captureSimulationState());
    restoreSimulationState(previousState);
  }

  function restoreFutureSimulationState() {
    const nextState = futureRef.current.pop();
    if (!nextState) {
      return;
    }
    pushSimulationHistory();
    restoreSimulationState(nextState);
  }

  function restoreSimulationState(state: SimulationHistoryState) {
    simRef.current = cloneSimObjects(state.objects);
    collisionCountRef.current = state.collisionCount;
    collidedRef.current = state.collided;
    frameNumberRef.current = state.frameNumber;
    challengeStateRef.current = cloneChallengeState(state.challengeState);
    lastTimeRef.current = null;
    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
    setChallengeState(cloneChallengeState(challengeStateRef.current));
    syncTimelineState();
  }

  useEffect(() => {
    const previousInputs = resetInputsRef.current;
    const layoutChanged =
      previousInputs.mode !== mode ||
      previousInputs.worldLength !== worldLength ||
      previousInputs.worldWidth !== worldWidth ||
      previousInputs.worldHeight !== worldHeight;
    resetInputsRef.current = { mode, worldLength, worldWidth, worldHeight };
    if (mode === "challenge" && !layoutChanged && simRef.current.length > 0) {
      applyChallengeObjectSettings();
      setIsPlaying(false);
      lastTimeRef.current = null;
      drawScene(simRef.current);
      setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
      return;
    }
    resetSimulation(mode);
    setIsPlaying(false);
  }, [mode, objectSettings, worldLength, worldWidth, worldHeight]);

  useEffect(() => {
    drawScene(simRef.current.length ? simRef.current : getFallbackObjects(mode, objectSettings));
  }, [zoom, wallsEnabled, wallMaterial, labelsEnabled, mode, worldLength, worldWidth, worldHeight, isCanvasFullDisplay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let redrawFrame: number | null = null;
    const redrawForSize = () => {
      if (redrawFrame !== null) {
        cancelAnimationFrame(redrawFrame);
      }
      redrawFrame = requestAnimationFrame(() => {
        drawScene(simRef.current.length ? simRef.current : getFallbackObjects(mode, objectSettings));
        redrawFrame = null;
      });
    };

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", redrawForSize);
      redrawForSize();
      return () => {
        window.removeEventListener("resize", redrawForSize);
        if (redrawFrame !== null) {
          cancelAnimationFrame(redrawFrame);
        }
      };
    }

    const resizeObserver = new ResizeObserver(redrawForSize);
    resizeObserver.observe(canvas);
    redrawForSize();
    return () => {
      resizeObserver.disconnect();
      if (redrawFrame !== null) {
        cancelAnimationFrame(redrawFrame);
      }
    };
  }, [mode, objectSettings, zoom, wallsEnabled, wallMaterial, labelsEnabled, worldLength, worldWidth, worldHeight, isCanvasFullDisplay]);

  useEffect(() => {
    const hasAnimatedShape = activeSettings.some((object) => object.shapeAsset?.mimeType === "image/gif" || object.shapeAsset?.spriteSheet);
    if (!hasAnimatedShape || isPlaying) {
      if (assetFrameRef.current !== null) {
        cancelAnimationFrame(assetFrameRef.current);
        assetFrameRef.current = null;
      }
      return;
    }

    function tick() {
      drawScene(simRef.current.length ? simRef.current : getFallbackObjects(mode, objectSettings));
      assetFrameRef.current = requestAnimationFrame(tick);
    }

    assetFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (assetFrameRef.current !== null) {
        cancelAnimationFrame(assetFrameRef.current);
        assetFrameRef.current = null;
      }
    };
  }, [activeSettings, isPlaying, mode, objectSettings, worldWidth, worldHeight]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isWorldMenuOpen) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && worldDetailsRef.current?.contains(target)) {
        return;
      }
      setIsWorldMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsWorldMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWorldMenuOpen]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    function tick(time: number) {
      const lastTime = lastTimeRef.current ?? time;
      const deltaSeconds = clamp((time - lastTime) / 1000, 0, 0.035);
      lastTimeRef.current = time;
      pushSimulationHistory({ clearFuture: true });
      updateSimulation(playbackDeltaSeconds(deltaSeconds, playbackRate));
      frameNumberRef.current += 1;
      drawScene(simRef.current);
      setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
      setChallengeState(cloneChallengeState(challengeStateRef.current));
      syncTimelineState();
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isPlaying, mode, wallsEnabled, wallMaterial, restitution, playbackRate]);

  useEffect(() => {
    function handleResize() {
      drawScene(simRef.current);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function updateSimulation(deltaSeconds: number) {
    const objects = simRef.current;
    if ((mode === "1d" && objects.length !== 2) || (mode !== "1d" && objects.length < 2)) {
      return;
    }
    if (mode === "challenge" && challengeStateRef.current.status !== "running") {
      return;
    }

    for (const object of objects) {
      if (object.isStatic) {
        object.velocity = { x: 0, y: 0 };
        continue;
      }
      object.position.x += object.velocity.x * deltaSeconds;
      object.position.y += object.velocity.y * deltaSeconds;
    }

    if (wallsActive) {
      resolveWallCollisions(objects);
    }

    if (mode === "1d") {
      resolve1DCollision(objects);
    } else {
      resolve2DCollision(objects);
      if (mode === "challenge") {
        resolveChallengeFoodPickups(objects);
        settleChallengeStatus();
      }
    }
  }

  function captureSimulationState(): SimulationHistoryState {
    return {
      objects: cloneSimObjects(simRef.current),
      collisionCount: collisionCountRef.current,
      collided: collidedRef.current,
      frameNumber: frameNumberRef.current,
      challengeState: cloneChallengeState(challengeStateRef.current)
    };
  }

  function pushSimulationHistory({ clearFuture = false } = {}) {
    if (simRef.current.length === 0) {
      return;
    }
    if (clearFuture) {
      futureRef.current = [];
    }
    historyRef.current.push(captureSimulationState());
    if (historyRef.current.length > MAX_HISTORY_STATES) {
      historyRef.current.shift();
    }
    syncTimelineState();
  }

  function syncTimelineState() {
    setTimelineState({
      frameNumber: frameNumberRef.current,
      canStepBack: historyRef.current.length > 0,
      canStepForward: true
    });
  }

  function updateObjectSetting(id: string, nextObject: ObjectSettings) {
    setObjectSettings((objects) =>
      objects.map((object) =>
        object.id === id
          ? { ...nextObject, speed: nextObject.isStatic ? 0 : nextObject.speed }
          : object
      )
    );
  }

  function toggleObjectCollapsed(id: string) {
    setCollapsedObjectIds((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
    );
  }

  function addObject() {
    if (objectSettings.length >= OBJECT_COLORS.length) {
      return;
    }
    const nextIndex = OBJECT_COLORS.findIndex((_, index) =>
      !objectSettings.some((object) => object.id === String.fromCharCode(65 + index))
    );
    if (nextIndex < 0) {
      return;
    }
    const nextId = String.fromCharCode(65 + nextIndex);
    setObjectSettings((objects) => [
      ...objects,
      {
        id: nextId,
        name: `Object ${nextId}`,
        color: OBJECT_COLORS[nextIndex],
        mass: 1.5 + (nextIndex % 3) * 0.5,
        speed: 1.6,
        angle: (nextIndex * 70) % 360,
        material: MATERIALS[nextIndex % MATERIALS.length],
        isStatic: false
      }
    ]);
    setCollapsedObjectIds((ids) => [...ids, nextId]);
  }

  function removeObject(id: string) {
    if (objectSettings.length <= 2) {
      return;
    }
    setObjectSettings((objects) => objects.filter((object) => object.id !== id));
    setCollapsedObjectIds((ids) => ids.filter((value) => value !== id));
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const target = getCanvasInteractionTarget(event);
    if (!target) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = target;
    setIsPlaying(false);
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    const state = drawStateRef.current;
    if (!state) {
      return;
    }

    event.preventDefault();
    const worldPoint = canvasPointToWorld(getCanvasPoint(event), state);
    const object = simRef.current.find((item) => item.id === interaction.objectId);
    if (!object) {
      return;
    }

    if (interaction.type === "move") {
      const position = clampWorldPosition(worldPoint, object.radius, state.bounds);
      object.position = mode === "1d" ? { x: position.x, y: 0 } : position;
      updateObjectPosition(object.id, object.position);
    } else if (mode !== "1d") {
      if (object.isStatic) {
        return;
      }
      const vector = {
        x: worldPoint.x - object.position.x,
        y: worldPoint.y - object.position.y
      };
      if (vectorSpeed(vector) > 0.05) {
        const angle = vectorAngleDegrees(vector);
        const speed = Math.max(0.1, vectorSpeed(object.velocity));
        object.velocity = speedToVector(speed, angle);
        updateObjectAngle(object.id, angle, speed);
      }
    }

    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
  }

  function handleCanvasPointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (interactionRef.current) {
      interactionRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function getCanvasInteractionTarget(event: ReactPointerEvent<HTMLCanvasElement>): CanvasInteraction | null {
    const state = drawStateRef.current;
    if (!state || simRef.current.length === 0) {
      return null;
    }

    const point = getCanvasPoint(event);
    for (const object of [...simRef.current].reverse()) {
      if (mode === "challenge" && object.id !== "A") {
        continue;
      }
      const center = worldToCanvas(object.position, state.origin, state.scale);
      const radius = Math.max(12, object.radius * state.scale);
      const arrowEnd = {
        x: center.x + object.velocity.x * 0.6 * state.scale,
        y: center.y + object.velocity.y * 0.6 * state.scale
      };

      if (mode !== "1d" && distance(point, arrowEnd) <= 18) {
        return { objectId: object.id, type: "angle" };
      }
      if (distance(point, center) <= radius + 10) {
        return { objectId: object.id, type: "move" };
      }
    }

    return null;
  }

  function updateObjectPosition(id: string, position: Vector) {
    setObjectSettings((objects) =>
      objects.map((object) => (object.id === id ? { ...object, position } : object))
    );
  }

  function updateObjectAngle(id: string, angle: number, speed: number) {
    setObjectSettings((objects) =>
      objects.map((object) =>
        object.id === id && !object.isStatic
          ? { ...object, angle, speed: mode === "1d" ? object.speed : speed }
          : object
      )
    );
  }

  function applyChallengeObjectSettings() {
    const warrior = simRef.current.find((object) => object.id === "A");
    if (!warrior) {
      return;
    }
    const settings = objectSettings[0];
    warrior.mass = settings.mass;
    warrior.material = settings.material;
    warrior.radius = (radiusFromMass(settings.mass) / 80) * OBJECT_RADIUS_MULTIPLIER * CHALLENGE_WARRIOR_RADIUS_SCALE;
    warrior.velocity = speedToVector(Math.abs(settings.speed), settings.angle);
    warrior.position = clampWorldPosition(warrior.position, warrior.radius, getWorldBounds());
  }

  function togglePlayback() {
    if (mode === "challenge") {
      const status = challengeStateRef.current.status;
      if (status === "won" || status === "lost") {
        resetSimulation("challenge");
      }
      if (!isPlaying) {
        challengeStateRef.current = {
          ...challengeStateRef.current,
          status: "running",
          lastEvent: challengeStateRef.current.lastEvent || "Challenge started"
        };
        setChallengeState(cloneChallengeState(challengeStateRef.current));
      }
    }
    setIsPlaying((value) => !value);
  }

  function resolve1DCollision(objects: SimObject[]) {
    const [a, b] = objects;
    const gap = Math.abs(a.position.x - b.position.x);
    const combinedRadius = a.radius + b.radius;
    const approaching =
      (a.position.x < b.position.x && a.velocity.x > b.velocity.x) ||
      (a.position.x > b.position.x && a.velocity.x < b.velocity.x);

    if (gap <= combinedRadius && approaching && !collidedRef.current) {
      if (a.isStatic && b.isStatic) {
        return;
      }
      if (a.isStatic) {
        a.velocity = { x: 0, y: 0 };
        b.velocity.x = collideWithStatic1D(b.velocity.x, restitution);
      } else if (b.isStatic) {
        a.velocity.x = collideWithStatic1D(a.velocity.x, restitution);
        b.velocity = { x: 0, y: 0 };
      } else {
        const resolved = collide1D({
          massA: a.mass,
          massB: b.mass,
          velocityA: a.velocity.x,
          velocityB: b.velocity.x,
          restitution
        });
        a.velocity.x = resolved.velocityA;
        b.velocity.x = resolved.velocityB;
      }
      separate1DObjects(a, b, combinedRadius, gap);
      markCollisionReactions(a, b);
      collidedRef.current = true;
      collisionCountRef.current += 1;
    }

    if (gap > combinedRadius * 1.15) {
      collidedRef.current = false;
    }
  }

  function resolve2DCollision(objects: SimObject[]) {
    for (let i = 0; i < objects.length; i += 1) {
      for (let j = i + 1; j < objects.length; j += 1) {
        resolve2DPair(objects[i], objects[j]);
      }
    }
  }

  function resolve2DPair(a: SimObject, b: SimObject) {
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const distance = Math.hypot(dx, dy);
    const combinedRadius = a.radius + b.radius;
    const relativeVelocity = {
      x: b.velocity.x - a.velocity.x,
      y: b.velocity.y - a.velocity.y
    };
    const approaching = distance > 0 && (dx * relativeVelocity.x + dy * relativeVelocity.y) < 0;

    if (distance <= combinedRadius && approaching) {
      const pairRestitution = materialRestitution(a.material, b.material);
      if (a.isStatic && b.isStatic) {
        return;
      }
      if (a.isStatic) {
        a.velocity = { x: 0, y: 0 };
        b.velocity = reflectVelocity(
          b.velocity,
          { x: a.position.x - b.position.x, y: a.position.y - b.position.y },
          pairRestitution
        );
      } else if (b.isStatic) {
        a.velocity = reflectVelocity(
          a.velocity,
          { x: b.position.x - a.position.x, y: b.position.y - a.position.y },
          pairRestitution
        );
        b.velocity = { x: 0, y: 0 };
      } else {
        const resolved = collide2D({
          objectA: a,
          objectB: b,
          restitution: pairRestitution
        });
        a.velocity = resolved.velocityA;
        b.velocity = resolved.velocityB;
      }
      separateObjects(a, b, combinedRadius, distance);
      markCollisionReactions(a, b);
      if (mode === "challenge") {
        applyChallengeCollisionDamage(a, b);
      }
      collisionCountRef.current += 1;
    }
  }

  function markCollisionReactions(a: SimObject, b: SimObject) {
    const duration = 90;
    const untilFrame = frameNumberRef.current + duration;
    if (a.mass === b.mass) {
      collisionReactionRef.current[a.id] = { emotion: "happy", untilFrame };
      collisionReactionRef.current[b.id] = { emotion: "happy", untilFrame };
      return;
    }

    const larger = a.mass > b.mass ? a : b;
    const smaller = a.mass > b.mass ? b : a;
    collisionReactionRef.current[larger.id] = { emotion: "playful", untilFrame };
    collisionReactionRef.current[smaller.id] = { emotion: "sad", untilFrame };
  }

  function resolveWallCollisions(objects: SimObject[]) {
    const bounds = getWorldBounds();
    for (const object of objects) {
      if (object.isStatic) {
        object.velocity = { x: 0, y: 0 };
        object.position = clampWorldPosition(object.position, object.radius, bounds);
        continue;
      }
      const restitutionForObject = materialRestitution(object.material, wallMaterial);
      if (object.position.x - object.radius < bounds.left) {
        const impactSpeed = Math.abs(object.velocity.x);
        object.position.x = bounds.left + object.radius;
        object.velocity = wallBounce(object.velocity, "x", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
      if (object.position.x + object.radius > bounds.right) {
        const impactSpeed = Math.abs(object.velocity.x);
        object.position.x = bounds.right - object.radius;
        object.velocity = wallBounce(object.velocity, "x", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
      if (mode === "2d" && object.position.y - object.radius < bounds.top) {
        const impactSpeed = Math.abs(object.velocity.y);
        object.position.y = bounds.top + object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
      if (mode === "2d" && object.position.y + object.radius > bounds.bottom) {
        const impactSpeed = Math.abs(object.velocity.y);
        object.position.y = bounds.bottom - object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
      if (mode === "challenge" && object.position.y - object.radius < bounds.top) {
        const impactSpeed = Math.abs(object.velocity.y);
        object.position.y = bounds.top + object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
      if (mode === "challenge" && object.position.y + object.radius > bounds.bottom) {
        const impactSpeed = Math.abs(object.velocity.y);
        object.position.y = bounds.bottom - object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
        applyChallengeWallDamage(object, impactSpeed);
      }
    }
  }

  function applyChallengeCollisionDamage(a: SimObject, b: SimObject) {
    if (mode !== "challenge" || !isChallengePair(a, b)) {
      return;
    }
    const impactSpeed = vectorSpeed({
      x: a.velocity.x - b.velocity.x,
      y: a.velocity.y - b.velocity.y
    });
    const warriorDamage = Math.round(CHALLENGE_COLLISION_DAMAGE.warriorBase + impactSpeed * CHALLENGE_COLLISION_DAMAGE.warriorSpeed);
    const monsterDamage = Math.round(CHALLENGE_COLLISION_DAMAGE.monsterBase + impactSpeed * CHALLENGE_COLLISION_DAMAGE.monsterSpeed);
    updateChallengeHp({
      warriorDelta: -warriorDamage,
      monsterDelta: -monsterDamage,
      lastEvent: `Hit: monster -${monsterDamage} HP, warrior -${warriorDamage} HP`
    });
  }

  function applyChallengeWallDamage(object: SimObject, impactSpeed: number) {
    if (mode !== "challenge" || impactSpeed < 0.12 || !isChallengeActor(object)) {
      return;
    }
    const damage = Math.round(CHALLENGE_WALL_DAMAGE.base + impactSpeed * CHALLENGE_WALL_DAMAGE.speed);
    updateChallengeHp({
      warriorDelta: object.id === "A" ? -damage : 0,
      monsterDelta: object.id === "B" ? -damage : 0,
      lastEvent: `${object.id === "A" ? "Warrior" : "Monster"} wall crash: -${damage} HP`
    });
  }

  function resolveChallengeFoodPickups(objects: SimObject[]) {
    if (mode !== "challenge") {
      return;
    }
    const warrior = objects.find((object) => object.id === "A");
    if (!warrior) {
      return;
    }
    let pickedFood = false;
    const nextFoods = challengeStateRef.current.foods.map((food) => {
      if (!food.active || distance(warrior.position, food.position) > warrior.radius + food.radius) {
        return food;
      }
      pickedFood = true;
      return { ...food, active: false };
    });
    if (!pickedFood) {
      return;
    }
    challengeStateRef.current = {
      ...challengeStateRef.current,
      foods: nextFoods,
      warriorHp: clamp(challengeStateRef.current.warriorHp + CHALLENGE_FOOD_HEAL, 0, CHALLENGE_MAX_HP),
      lastEvent: `Food pickup: +${CHALLENGE_FOOD_HEAL} HP`
    };
  }

  function settleChallengeStatus() {
    if (mode !== "challenge") {
      return;
    }
    const state = challengeStateRef.current;
    if (state.status === "won" || state.status === "lost") {
      return;
    }
    if (state.monsterHp <= 0) {
      const score = Math.max(0, Math.round(state.warriorHp));
      challengeStateRef.current = {
        ...state,
        monsterHp: 0,
        status: "won",
        score,
        lastEvent: `Monster defeated. Score ${score}`
      };
      setIsPlaying(false);
      return;
    }
    if (state.warriorHp <= 0) {
      challengeStateRef.current = {
        ...state,
        warriorHp: 0,
        status: "lost",
        score: 0,
        lastEvent: "Warrior defeated"
      };
      setIsPlaying(false);
    }
  }

  function updateChallengeHp({
    warriorDelta,
    monsterDelta,
    lastEvent
  }: {
    warriorDelta: number;
    monsterDelta: number;
    lastEvent: string;
  }) {
    if (mode !== "challenge") {
      return;
    }
    const state = challengeStateRef.current;
    challengeStateRef.current = {
      ...state,
      warriorHp: clamp(state.warriorHp + warriorDelta, 0, CHALLENGE_MAX_HP),
      monsterHp: clamp(state.monsterHp + monsterDelta, 0, CHALLENGE_MONSTER_HP),
      lastEvent
    };
  }

  function isChallengePair(a: SimObject, b: SimObject) {
    return (a.id === "A" && b.id === "B") || (a.id === "B" && b.id === "A");
  }

  function isChallengeActor(object: SimObject) {
    return object.id === "A" || object.id === "B";
  }

  function getWorldBounds(): WorldBounds {
    return getWorldBoundsForMode(mode);
  }

  function getWorldBoundsForMode(targetMode: Mode): WorldBounds {
    const width = targetMode === "1d"
      ? worldLength
      : targetMode === "challenge"
        ? Math.max(worldWidth, CHALLENGE_DEFAULT_WIDTH)
        : worldWidth;
    const height = targetMode === "1d"
      ? 4
      : targetMode === "challenge"
        ? Math.max(worldHeight, CHALLENGE_DEFAULT_HEIGHT)
        : worldHeight;
    return {
      left: -width / 2,
      right: width / 2,
      top: -height / 2,
      bottom: height / 2,
      width,
      height
    };
  }

  function drawScene(objects: SimObject[]) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * pixelRatio);
    canvas.height = Math.floor(rect.height * pixelRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const width = rect.width;
    const height = rect.height;
    const bounds = getWorldBounds();
    const scale = getScale(width, height, bounds.width, bounds.height);
    const origin = { x: width / 2, y: height / 2 };
    drawStateRef.current = { origin, scale, bounds };

    ctx.clearRect(0, 0, width, height);
    drawBackground(ctx, width, height);
    drawWorld(ctx, origin, bounds, scale);

    const drawableObjects = objects.length ? objects : getFallbackObjects(mode, objectSettings);
    if (mode === "challenge") {
      drawChallengeFoods(ctx, origin, scale);
    }
    for (const object of drawableObjects) {
      drawVelocityVector(ctx, object, origin, scale);
    }
    for (const object of drawableObjects) {
      drawObject(ctx, object, drawableObjects, origin, scale);
    }
    if (labelsEnabled) {
      for (const object of drawableObjects) {
        drawObjectLabel(ctx, object, origin, scale);
      }
    }
  }

  function worldToCanvas(position: Vector, origin: Vector, scale: number): Vector {
    return {
      x: origin.x + position.x * scale,
      y: origin.y + position.y * scale
    };
  }

  function canvasPointToWorld(point: Vector, state: DrawState): Vector {
    return {
      x: (point.x - state.origin.x) / state.scale,
      y: (point.y - state.origin.y) / state.scale
    };
  }

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Vector {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function clampWorldPosition(position: Vector, radius: number, bounds: WorldBounds): Vector {
    return {
      x: clamp(position.x, bounds.left + radius, bounds.right - radius),
      y: mode === "1d" ? 0 : clamp(position.y, bounds.top + radius, bounds.bottom - radius)
    };
  }

  function distance(a: Vector, b: Vector): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function getScale(width: number, height: number, worldWidthValue: number, worldHeightValue: number) {
    return Math.min(width / worldWidthValue, height / worldHeightValue) * 0.78 * zoom;
  }

  function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fffdf8");
    gradient.addColorStop(0.52, "#fff4ea");
    gradient.addColorStop(1, "#f5f8fc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawWorld(
    ctx: CanvasRenderingContext2D,
    origin: Vector,
    bounds: ReturnType<typeof getWorldBounds>,
    scale: number
  ) {
    const topLeft = worldToCanvas({ x: bounds.left, y: bounds.top }, origin, scale);
    const bottomRight = worldToCanvas({ x: bounds.right, y: bounds.bottom }, origin, scale);

    ctx.save();
    ctx.strokeStyle = wallsActive ? COLORS.border : "rgba(7, 17, 31, 0.22)";
    ctx.lineWidth = wallsActive ? 4 : 2;
    ctx.setLineDash(wallsActive ? [] : [10, 9]);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.restore();

    if (mode === "1d") {
      ctx.strokeStyle = "rgba(7, 17, 31, 0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(topLeft.x, origin.y);
      ctx.lineTo(bottomRight.x, origin.y);
      ctx.stroke();
    }
  }

  function drawObject(
    ctx: CanvasRenderingContext2D,
    object: SimObject,
    objects: SimObject[],
    origin: Vector,
    scale: number
  ) {
    const center = worldToCanvas(object.position, origin, scale);
    const radius = Math.max(12, object.radius * scale);
    const shapeImage = object.shapeAsset ? getShapeImage(object.shapeAsset) : null;
    const hasShapeAsset = Boolean(object.shapeAsset);

    if (mode === "challenge") {
      drawChallengeActor(ctx, object, center, radius);
    } else if (shapeImage?.complete && shapeImage.naturalWidth > 0) {
      drawShapeImage(ctx, shapeImage, object, objects, center, radius);
    } else if (!hasShapeAsset) {
      ctx.save();
      ctx.shadowColor = "rgba(7, 17, 31, 0.18)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = object.color;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 16px Space Grotesk, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(object.id, center.x, center.y);
    }

    if (object.isStatic) {
      drawStaticSlash(ctx, center, radius);
    }
  }

  function drawChallengeFoods(ctx: CanvasRenderingContext2D, origin: Vector, scale: number) {
    for (const food of challengeStateRef.current.foods) {
      if (!food.active) {
        continue;
      }
      const center = worldToCanvas(food.position, origin, scale);
      const radius = Math.max(10, food.radius * scale);
      ctx.save();
      ctx.shadowColor = "rgba(16, 163, 127, 0.22)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = "#10a37f";
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${Math.max(13, radius * 0.95)}px Space Grotesk, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", center.x, center.y - 1);
      ctx.restore();
    }
  }

  function drawChallengeActor(
    ctx: CanvasRenderingContext2D,
    object: SimObject,
    center: Vector,
    radius: number
  ) {
    const isWarrior = object.id === "A";
    const hp = isWarrior ? challengeStateRef.current.warriorHp : challengeStateRef.current.monsterHp;
    const hpRatio = clamp(hp / (isWarrior ? CHALLENGE_MAX_HP : CHALLENGE_MONSTER_HP), 0, 1);

    ctx.save();
    ctx.shadowColor = "rgba(7, 17, 31, 0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = isWarrior ? "#2563eb" : "#c2410c";
    if (isWarrior) {
      roundedRect(ctx, center.x - radius, center.y - radius, radius * 2, radius * 2, radius * 0.45);
      ctx.fill();
    } else {
      drawMonsterBody(ctx, center, radius);
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${Math.max(15, radius * 0.62)}px Space Grotesk, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isWarrior ? "W" : "M", center.x, center.y + 1);
    ctx.restore();

    const barWidth = radius * 2.15;
    const barHeight = 7;
    const barX = center.x - barWidth / 2;
    const barY = center.y + radius + 9;
    ctx.save();
    roundedRect(ctx, barX, barY, barWidth, barHeight, 4);
    ctx.fillStyle = "rgba(7, 17, 31, 0.16)";
    ctx.fill();
    roundedRect(ctx, barX, barY, barWidth * hpRatio, barHeight, 4);
    ctx.fillStyle = hpRatio > 0.42 ? "#10a37f" : "#ff5a00";
    ctx.fill();
    ctx.restore();
  }

  function drawMonsterBody(ctx: CanvasRenderingContext2D, center: Vector, radius: number) {
    const spikes = 14;
    ctx.beginPath();
    for (let index = 0; index < spikes * 2; index += 1) {
      const angle = (index / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const pointRadius = index % 2 === 0 ? radius * 1.08 : radius * 0.86;
      const x = center.x + Math.cos(angle) * pointRadius;
      const y = center.y + Math.sin(angle) * pointRadius;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  function getShapeImage(asset: ObjectShapeAsset) {
    const cachedImage = shapeImageCacheRef.current.get(asset.dataUrl);
    if (cachedImage) {
      return cachedImage;
    }

    const image = new Image();
    image.onload = () => {
      drawScene(simRef.current.length ? simRef.current : createInitialObjects(mode, objectSettings));
    };
    image.src = asset.dataUrl;
    shapeImageCacheRef.current.set(asset.dataUrl, image);
    return image;
  }

  function drawShapeImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    object: SimObject,
    objects: SimObject[],
    center: Vector,
    radius: number
  ) {
    const maxSize = radius * 2.35;
    const spriteFrame = object.shapeAsset?.spriteSheet
      ? getSpriteFrame(object, objects, object.shapeAsset.spriteSheet)
      : null;
    const sourceWidth = spriteFrame?.width ?? image.naturalWidth;
    const sourceHeight = spriteFrame?.height ?? image.naturalHeight;
    const aspectRatio = spriteFrame?.renderAspectRatio ?? (sourceWidth / sourceHeight || 1);
    const drawWidth = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
    const drawHeight = aspectRatio >= 1 ? maxSize / aspectRatio : maxSize;
    const x = center.x - drawWidth / 2;
    const y = center.y - drawHeight / 2;

    ctx.save();
    ctx.shadowColor = "rgba(7, 17, 31, 0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    if (spriteFrame) {
      ctx.drawImage(image, spriteFrame.x, spriteFrame.y, spriteFrame.width, spriteFrame.height, x, y, drawWidth, drawHeight);
    } else {
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }
    ctx.restore();

  }

  function getSpriteFrame(object: SimObject, objects: SimObject[], sheet: SpriteSheetConfig) {
    const emotion = getObjectSpriteEmotion(object, objects);
    const frameWidth = sheet.frameWidth ?? sheet.frameSize ?? 1;
    const frameHeight = sheet.frameHeight ?? sheet.frameSize ?? frameWidth;
    const row = sheet.layout === "horizontal-emotions" ? 0 : SPRITE_EMOTION_ROWS[emotion];
    const column = sheet.layout === "horizontal-emotions" ? SPRITE_EMOTION_ORDER.indexOf(emotion) : getSpriteFrameColumn(emotion, object.id);
    return {
      x: Math.max(column, 0) * frameWidth,
      y: row * frameHeight,
      width: frameWidth,
      height: frameHeight,
      renderAspectRatio: sheet.renderAspectRatio
    };
  }

  function getSpriteFrameColumn(emotion: SpriteEmotion, objectId: string) {
    const phaseOffset = objectId.charCodeAt(0) % 2;
    const frameBucket = Math.floor(performance.now() / (emotion === "sleepy" ? 520 : 260));
    return (frameBucket + phaseOffset) % 2;
  }

  function getObjectSpriteEmotion(object: SimObject, objects: SimObject[]): SpriteEmotion {
    const reaction = collisionReactionRef.current[object.id];
    if (reaction) {
      if (reaction.untilFrame >= frameNumberRef.current) {
        return reaction.emotion;
      }
      delete collisionReactionRef.current[object.id];
    }

    const target = getImminentCollisionTarget(object, objects);
    if (target) {
      return object.mass >= target.mass ? "excited" : "sad";
    }

    return vectorSpeed(object.velocity) <= SLEEPY_SPEED_THRESHOLD ? "sleepy" : "happy";
  }

  function getImminentCollisionTarget(object: SimObject, objects: SimObject[]) {
    let closestTarget: SimObject | null = null;
    let closestTime = Number.POSITIVE_INFINITY;
    for (const other of objects) {
      if (other.id === object.id) {
        continue;
      }
      const timeToCollision = estimateTimeToCollision(object, other);
      if (timeToCollision !== null && timeToCollision < closestTime) {
        closestTime = timeToCollision;
        closestTarget = other;
      }
    }
    return closestTarget;
  }

  function estimateTimeToCollision(object: SimObject, other: SimObject) {
    const dx = other.position.x - object.position.x;
    const dy = other.position.y - object.position.y;
    const distanceBetweenObjects = Math.hypot(dx, dy);
    if (distanceBetweenObjects === 0) {
      return 0;
    }
    const combinedRadius = object.radius + other.radius;
    const distanceToImpact = distanceBetweenObjects - combinedRadius;
    const normal = { x: dx / distanceBetweenObjects, y: dy / distanceBetweenObjects };
    const relativeVelocity = {
      x: object.velocity.x - other.velocity.x,
      y: object.velocity.y - other.velocity.y
    };
    const closingSpeed = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
    if (closingSpeed <= 0) {
      return null;
    }
    const timeToImpact = distanceToImpact <= 0 ? 0 : distanceToImpact / closingSpeed;
    return timeToImpact <= IMMINENT_COLLISION_SECONDS ? timeToImpact : null;
  }

  function drawStaticSlash(ctx: CanvasRenderingContext2D, center: Vector, radius: number) {
    const offset = radius * 0.62;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(4, radius * 0.18);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(7, 17, 31, 0.28)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(center.x - offset, center.y - offset);
    ctx.lineTo(center.x + offset, center.y + offset);
    ctx.stroke();
    ctx.restore();
  }

  function drawVelocityVector(
    ctx: CanvasRenderingContext2D,
    object: SimObject,
    origin: Vector,
    scale: number
  ) {
    const start = worldToCanvas(object.position, origin, scale);
    const vector = { x: object.velocity.x * 0.6 * scale, y: object.velocity.y * 0.6 * scale };
    const end = { x: start.x + vector.x, y: start.y + vector.y };
    const angle = Math.atan2(vector.y, vector.x);

    ctx.save();
    ctx.strokeStyle = object.color;
    ctx.fillStyle = object.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    if (Math.hypot(vector.x, vector.y) > 8) {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - 12 * Math.cos(angle - 0.45), end.y - 12 * Math.sin(angle - 0.45));
      ctx.lineTo(end.x - 12 * Math.cos(angle + 0.45), end.y - 12 * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawObjectLabel(
    ctx: CanvasRenderingContext2D,
    object: SimObject,
    origin: Vector,
    scale: number
  ) {
    const center = worldToCanvas(object.position, origin, scale);
    const radius = Math.max(12, object.radius * scale);
    const speed = mode === "1d" ? object.velocity.x : vectorSpeed(object.velocity);
    const challengeHp = object.id === "A" ? challengeStateRef.current.warriorHp : challengeStateRef.current.monsterHp;
    const speedLabel = mode === "challenge"
      ? `${Math.max(0, Math.round(challengeHp))} HP`
      : mode === "1d"
        ? `${speed.toFixed(2)} m/s`
        : `${Math.abs(speed).toFixed(2)} m/s`;
    const massLabel = mode === "challenge" ? `${Math.abs(speed).toFixed(2)} m/s` : `${object.mass.toFixed(1)} kg`;
    ctx.font = "700 12px Space Grotesk, sans-serif";
    const width = Math.max(94, Math.max(ctx.measureText(speedLabel).width, ctx.measureText(massLabel).width) + 24);
    const height = 48;
    const labelCenter = {
      x: center.x,
      y: center.y - radius - 34
    };

    ctx.save();
    ctx.shadowColor = "rgba(7, 17, 31, 0.12)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = object.color;
    ctx.lineWidth = 1.5;
    roundedRect(ctx, labelCenter.x - width / 2, labelCenter.y - height / 2, width, height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = object.color;
    ctx.font = "800 10px Space Grotesk, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.name, labelCenter.x, labelCenter.y - 13);
    ctx.fillStyle = COLORS.ink;
    ctx.font = "700 12px Space Grotesk, sans-serif";
    ctx.fillText(speedLabel, labelCenter.x, labelCenter.y + 2);
    ctx.fillStyle = "rgba(7, 17, 31, 0.62)";
    ctx.font = "700 11px Space Grotesk, sans-serif";
    ctx.fillText(massLabel, labelCenter.x, labelCenter.y + 16);
    ctx.restore();
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={!isCanvasFullDisplay}
        className="h-dvh min-h-0 overflow-hidden bg-background text-foreground"
      >
        {isCanvasFullDisplay ? null : (
          <PrimarySidebar
            applications={APPLICATION_CONFIGS}
            activeApplicationId={activeApplicationId}
            onSelectApplication={onSelectApplication}
          />
        )}
        <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background">
          <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
            {isCanvasFullDisplay ? null : (
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 shadow-sm backdrop-blur max-sm:h-auto max-sm:flex-col max-sm:items-stretch max-sm:px-3 max-sm:py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <SidebarTrigger className="size-7" aria-label="Toggle application navigation" />
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
                    <FlaskConical />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-extrabold leading-none tracking-normal">{APPLICATION_CONFIG.name}</h1>
                    <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground">{APPLICATION_CONFIG.subtitle}</p>
                  </div>
                </div>
                <ToggleGroup
                  aria-label="Simulation dimension"
                  value={[mode]}
                  onValueChange={(values) => {
                    const nextMode = values[0] as Mode | undefined;
                    if (nextMode) {
                      if (nextMode === "challenge") {
                        setWorldWidth((value) => Math.max(value, CHALLENGE_DEFAULT_WIDTH));
                        setWorldHeight((value) => Math.max(value, CHALLENGE_DEFAULT_HEIGHT));
                      }
                      setMode(nextMode);
                    }
                  }}
                  spacing={0}
                  variant="outline"
                  className="w-fit bg-card p-1 shadow-sm max-sm:w-full"
                >
                  <ToggleGroupItem value="1d" className="text-xs max-sm:flex-1">
                    <CircleDot data-icon="inline-start" />
                    1D simulation
                  </ToggleGroupItem>
                  <ToggleGroupItem value="2d" className="text-xs max-sm:flex-1">
                    <Maximize2 data-icon="inline-start" />
                    2D simulation
                  </ToggleGroupItem>
                  <ToggleGroupItem value="challenge" className="text-xs max-sm:flex-1">
                    <HeartPulse data-icon="inline-start" />
                    Challenge
                  </ToggleGroupItem>
                </ToggleGroup>
              </header>
            )}
            <section
              className={cn(
                "min-h-0 flex-1 overflow-hidden",
                isCanvasFullDisplay ? "p-0" : "p-4 max-sm:p-3"
              )}
            >
        <section
          className={cn(
            "mx-auto grid h-full min-h-0 max-w-[1440px] gap-4",
            isCanvasFullDisplay ? "max-w-none grid-rows-[minmax(0,1fr)] gap-0" : "grid-rows-[minmax(0,1fr)_auto]"
          )}
        >
          <section
            className={cn(
              "grid min-h-0 overflow-hidden",
              isCanvasFullDisplay
                ? "grid-cols-1 gap-0"
                : "grid-cols-[minmax(0,1fr)_360px] gap-4 max-lg:grid-cols-1 max-lg:grid-rows-[minmax(0,1fr)_minmax(180px,0.82fr)]"
            )}
          >
            <Card
              className={cn(
                "grid min-h-0 gap-0 overflow-hidden py-0",
                isCanvasFullDisplay ? "rounded-none border-0 ring-0 shadow-none" : "grid-rows-[auto_auto_minmax(0,1fr)]"
              )}
            >
              <CardContent className="grid min-h-12 grid-cols-[auto_auto_minmax(170px,260px)] items-center justify-between gap-3 border-b p-3 max-sm:flex max-sm:flex-col max-sm:items-stretch">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span className={cn("size-2.5 rounded-full ring-4", isPlaying ? "bg-emerald-600 ring-emerald-600/15" : "bg-primary ring-primary/15")} />
                  {isPlaying ? "Running" : "Paused"}
                </div>
                <div className="grid justify-items-center gap-1" aria-label="Simulation controls">
                  <span className="text-[10px] font-black leading-none text-muted-foreground">Frame {timelineState.frameNumber}</span>
                  <div className="flex items-center justify-center gap-1.5 max-sm:w-full">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={isPlaying ? "Pause" : "Play"}
                      title={isPlaying ? "Pause" : "Play"}
                      onClick={togglePlayback}
                      className="max-sm:flex-1"
                    >
                      {isPlaying ? <Pause /> : <Play />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Step back"
                      title="Step back"
                      disabled={!timelineState.canStepBack || isPlaying}
                      onClick={stepBackSimulation}
                      className="max-sm:flex-1"
                    >
                      <SkipBack />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="Step forward"
                      title="Step forward"
                      disabled={!timelineState.canStepForward || isPlaying}
                      onClick={() => stepSimulation()}
                      className="max-sm:flex-1"
                    >
                      <SkipForward />
                    </Button>
                    <Button type="button" size="icon" variant="outline" aria-label="Reset" title="Reset" onClick={() => resetSimulation()} className="max-sm:flex-1">
                      <RotateCcw />
                    </Button>
                  </div>
                </div>
                <RangeField
                  label="Playback speed"
                  value={playbackRate}
                  min={0.3}
                  max={2}
                  step={0.1}
                  unit="x"
                  onChange={setPlaybackRate}
                  ticks={["0.3x", "1x", "2x"]}
                />
              </CardContent>
              {isCanvasFullDisplay ? null : (
                <CardContent className="flex min-h-11 items-center justify-end border-b bg-card/60 p-2">
                  <Popover open={isWorldMenuOpen} onOpenChange={setIsWorldMenuOpen}>
                    <PopoverTrigger className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                      <span>World</span>
                      <ChevronDown data-icon="inline-end" className={cn("transition-transform", isWorldMenuOpen && "rotate-180")} />
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-80 gap-3"
                      onPointerDownCapture={(event) => event.stopPropagation()}
                    >
                      <FieldGroup className="gap-3">
                        <SegmentToggle label="Labels" checked={labelsEnabled} onChange={setLabelsEnabled} />
                        {isChallengeMode ? (
                          <Field orientation="horizontal" className="justify-between rounded-lg border border-input p-2">
                            <FieldTitle>Arena walls</FieldTitle>
                            <Badge variant="secondary">Locked on</Badge>
                          </Field>
                        ) : (
                          <SegmentToggle label="Walls" checked={wallsEnabled} onChange={setWallsEnabled} />
                        )}
                        <SelectField
                          label="Wall material"
                          value={wallMaterial}
                          onChange={(value) => setWallMaterial(value as Material)}
                        />
                        {mode === "1d" ? (
                          <RangeField
                            label="World length"
                            value={worldLength}
                            min={8}
                            max={28}
                            step={1}
                            unit="m"
                            onChange={setWorldLength}
                          />
                        ) : (
                          <>
                            <RangeField label="World width" value={worldWidth} min={8} max={28} step={1} unit="m" onChange={setWorldWidth} />
                            <RangeField label="World height" value={worldHeight} min={5} max={18} step={1} unit="m" onChange={setWorldHeight} />
                          </>
                        )}
                        <Field>
                          <div className="grid grid-cols-[2rem_minmax(70px,1fr)_2rem] items-center gap-2">
                            <Button type="button" size="icon" variant="outline" aria-label="Zoom out" onClick={() => setZoom((value) => clamp(value - 0.15, 0.45, 2.2))}>
                              <ZoomOut />
                            </Button>
                            <Badge variant="secondary" className="h-8 rounded-lg text-sm">{zoom.toFixed(2)}x</Badge>
                            <Button type="button" size="icon" variant="outline" aria-label="Zoom in" onClick={() => setZoom((value) => clamp(value + 0.15, 0.45, 2.2))}>
                              <ZoomIn />
                            </Button>
                          </div>
                        </Field>
                      </FieldGroup>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              )}
              <div className="relative min-h-0">
              <canvas
                ref={canvasRef}
                className="block size-full cursor-grab touch-none active:cursor-grabbing"
                aria-label="Collision simulation canvas"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerEnd}
                onPointerCancel={handleCanvasPointerEnd}
              />
              <Button
                className="absolute right-3 top-3"
                variant="outline"
                size="icon"
                type="button"
                aria-label={isCanvasFullDisplay ? "Return to normal view" : "Show canvas full display"}
                title={isCanvasFullDisplay ? "Return to normal view" : "Full display"}
                onClick={() => setIsCanvasFullDisplay((value) => !value)}
              >
                {isCanvasFullDisplay ? <Minimize2 /> : <Maximize2 />}
              </Button>
              </div>
            </Card>

            {isCanvasFullDisplay ? null : (
              <Card
                className={cn(
                  "min-h-0 py-0",
                  isSettingsDrawerOpen ? "overflow-hidden" : "w-14 justify-self-end p-2"
                )}
                aria-label="Collision settings"
              >
                {isSettingsDrawerOpen ? (
                  <>
                    <CardHeader className="border-b py-3">
                      <CardTitle className="text-sm uppercase text-muted-foreground">{isChallengeMode ? "Warrior" : "Objects"}</CardTitle>
                      <CardAction>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Collapse collision settings"
                          aria-expanded="true"
                          onClick={() => setIsSettingsDrawerOpen(false)}
                        >
                          <ChevronDown className="-rotate-90" />
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <ScrollArea className="min-h-0 flex-1">
                      <CardContent className="flex flex-col gap-3 p-3">
                        {activeSettings.map((object, index) => (
                          <ObjectControl
                            key={object.id}
                            object={isChallengeMode && object.id === "A" ? { ...object, name: "Warrior" } : object}
                            color={object.color}
                            mode={mode}
                            sharedAvatarAsset={sharedAvatarAsset}
                            isCollapsed={collapsedObjectIds.includes(object.id)}
                            canRemove={mode === "2d" && index > 1}
                            onToggle={() => toggleObjectCollapsed(object.id)}
                            onChange={(nextObject) => updateObjectSetting(object.id, nextObject)}
                            onRemove={() => removeObject(object.id)}
                          />
                        ))}
                        {mode === "2d" ? (
                          <div className="flex items-center gap-2">
                            <Button type="button" onClick={addObject} disabled={objectSettings.length >= OBJECT_COLORS.length}>
                              <Plus data-icon="inline-start" />
                              Add object
                            </Button>
                            <Badge variant="secondary">{objectSettings.length}/{OBJECT_COLORS.length}</Badge>
                          </div>
                        ) : null}
                      </CardContent>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center gap-3" aria-label="Collapsed collision settings">
                    {activeSettings.map((object) => (
                      <Button
                        key={object.id}
                        variant="outline"
                        size="icon"
                        type="button"
                        aria-label={`Expand ${object.name} settings`}
                        title={`Expand ${object.name} settings`}
                        onClick={() => setIsSettingsDrawerOpen(true)}
                      >
                        <ObjectDot color={object.color} isStatic={object.isStatic} />
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </section>

          {isCanvasFullDisplay ? null : (
            <Collapsible open={isReadoutPanelOpen} onOpenChange={setIsReadoutPanelOpen}>
              <section className="grid gap-2" aria-label="Simulation readouts">
                <CollapsibleTrigger className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full justify-start gap-2 bg-card px-4 shadow-sm")}>
                  <Info data-icon="inline-start" />
                  <span className="truncate text-left">{APPLICATION_CONFIG.tip}</span>
                  <ChevronDown data-icon="inline-end" className={cn("ml-auto transition-transform", isReadoutPanelOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {isChallengeMode ? (
                    <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:flex max-sm:min-h-20 max-sm:overflow-x-auto">
                      <Readout title="Status" value={formatChallengeStatus(challengeState.status)} detail={challengeState.lastEvent} />
                      <Readout title="Warrior HP" value={String(Math.round(challengeState.warriorHp))} detail={`${formatVelocity(snapshot.velocityA, mode)} speed`} />
                      <Readout title="Monster HP" value={String(Math.round(challengeState.monsterHp))} detail={`${snapshot.collisionCount} hits`} />
                      <Readout title="Food" value={`${challengeState.foods.filter((food) => food.active).length}/${challengeState.foods.length}`} detail={`+${CHALLENGE_FOOD_HEAL} HP each`} />
                      <Readout title="Score" value={String(challengeState.score || Math.max(0, Math.round(challengeState.warriorHp)))} detail="remaining warrior HP" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:flex max-sm:min-h-20 max-sm:overflow-x-auto">
                      <Readout
                        title="Restitution e"
                        value={restitution.toFixed(2)}
                        detail={`${MATERIAL_LABELS[objectA.material]} + ${MATERIAL_LABELS[objectB.material]}`}
                        info="Restitution tells how bouncy a collision is. A value near 1 means objects bounce back strongly. A value near 0 means they stick or lose more motion."
                      />
                      <Readout title="Collisions" value={String(snapshot.collisionCount)} detail={wallsEnabled ? "walls enabled" : "borderless"} />
                      <Readout title={`${objectA.name} velocity`} value={formatVelocity(snapshot.velocityA, mode)} detail={`p ${formatMomentum(snapshot.momentumA, mode)}`} />
                      <Readout title={`${objectB.name} velocity`} value={formatVelocity(snapshot.velocityB, mode)} detail={`p ${formatMomentum(snapshot.momentumB, mode)}`} />
                      <Readout
                        title="Energy"
                        value={`${(snapshot.energyA + snapshot.energyB).toFixed(1)} J`}
                        detail={`${objectA.id} ${snapshot.energyA.toFixed(1)} J | ${objectB.id} ${snapshot.energyB.toFixed(1)} J`}
                        info="Kinetic energy is motion energy. Faster and heavier objects have more kinetic energy. In soft collisions, some turns into heat, sound, or shape change."
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </section>
            </Collapsible>
          )}
        </section>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

type SnakeDirection = "up" | "right" | "down" | "left";

type SnakeCell = {
  x: number;
  y: number;
};

type LetterTarget = SnakeCell & {
  id: string;
  character: string;
  isRequired: boolean;
};

type SnakeStatus = "ready" | "running" | "paused" | "won" | "lost";

type GestureCameraStatus = "off" | "loading" | "ready" | "blocked" | "error";

type HandGesture = SnakeDirection | "fist" | "none";

type SnakeGameState = {
  snake: SnakeCell[];
  direction: SnakeDirection;
  targets: LetterTarget[];
  progress: number;
  score: number;
  strikes: number;
  status: SnakeStatus;
};

const SNAKE_DIRECTIONS: Record<SnakeDirection, SnakeCell> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

const SNAKE_KEY_DIRECTIONS: Record<string, SnakeDirection> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left"
};

const SNAKE_WORD_FALLBACK = "LEARN FAST!";
const SNAKE_MAX_PHRASE_LENGTH = 36;
const SNAKE_MAX_STRIKES = 3;
const SNAKE_KEYBOARD_TICK_MS = 240;
const SNAKE_HAND_CONTROL_TICK_MS = 340;
const HAND_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const HAND_LANDMARKER_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const GESTURE_DIRECTION_COOLDOWN_MS = 420;

function WordSnakeApp({
  activeApplicationId,
  onSelectApplication
}: {
  activeApplicationId: ApplicationId;
  onSelectApplication: (applicationId: ApplicationId) => void;
}) {
  const [wordInput, setWordInput] = useState("VECTOR");
  const [activeWord, setActiveWord] = useState("VECTOR");
  const boardSize = useMemo(() => getSnakeBoardSize(activeWord), [activeWord]);
  const [gameState, setGameState] = useState<SnakeGameState>(() => createSnakeGameState("VECTOR", getSnakeBoardSize("VECTOR")));
  const [gestureCameraStatus, setGestureCameraStatus] = useState<GestureCameraStatus>("off");
  const [activeGesture, setActiveGesture] = useState<HandGesture>("none");
  const [gestureMessage, setGestureMessage] = useState("Camera off");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const gestureFrameRef = useRef<number | null>(null);
  const lastGestureDirectionAtRef = useRef(0);
  const pendingDirectionRef = useRef<SnakeDirection>("right");

  const nextCharacter = activeWord[gameState.progress] ?? "";
  const isHandControlActive = gestureCameraStatus === "ready";
  const activeSnakeSpeedMs = isHandControlActive ? SNAKE_HAND_CONTROL_TICK_MS : SNAKE_KEYBOARD_TICK_MS;
  const keyboardControlsDisabled = isHandControlActive;

  function resetSnake(nextWord = activeWord) {
    const normalizedWord = normalizeSnakePhrase(nextWord);
    const nextBoardSize = getSnakeBoardSize(normalizedWord);
    pendingDirectionRef.current = "right";
    setActiveWord(normalizedWord);
    setWordInput(normalizedWord);
    setGameState(createSnakeGameState(normalizedWord, nextBoardSize));
  }

  function startSnake() {
    if (gameState.status === "won" || gameState.status === "lost") {
      resetSnake(activeWord);
      setGameState((state) => ({ ...state, status: "running" }));
      return;
    }
    setGameState((state) => ({ ...state, status: "running" }));
  }

  function pauseSnake() {
    setGameState((state) => ({ ...state, status: state.status === "running" ? "paused" : state.status }));
  }

  function applyDirection(nextDirection: SnakeDirection, source: "keyboard" | "gesture" | "button" = "keyboard") {
    if (source !== "gesture" && keyboardControlsDisabled) {
      return;
    }
    pendingDirectionRef.current = nextDirection;
    setGameState((state) => (state.status === "ready" ? { ...state, status: "running" } : state));
  }

  async function startGestureCamera() {
    if (gestureCameraStatus === "loading" || gestureCameraStatus === "ready") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setGestureCameraStatus("blocked");
      setGestureMessage("Camera unavailable");
      return;
    }

    setGestureCameraStatus("loading");
    setGestureMessage("Loading hand tracker");
    try {
      const [{ FilesetResolver, HandLandmarker: HandLandmarkerTask }, stream] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        })
      ]);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!handLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(HAND_LANDMARKER_WASM_URL);
        handLandmarkerRef.current = await HandLandmarkerTask.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_URL,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55
        });
      }
      setGestureCameraStatus("ready");
      setGestureMessage("Show a pointing hand");
      runGestureLoop();
    } catch (error) {
      stopGestureCamera("error");
      setGestureMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "Camera blocked" : "Camera failed");
    }
  }

  function stopGestureCamera(nextStatus: GestureCameraStatus = "off") {
    if (gestureFrameRef.current !== null) {
      cancelAnimationFrame(gestureFrameRef.current);
      gestureFrameRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActiveGesture("none");
    setGestureCameraStatus(nextStatus);
    if (nextStatus === "off") {
      setGestureMessage("Camera off");
    }
  }

  function runGestureLoop() {
    const detectFrame = () => {
      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        gestureFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const result = landmarker.detectForVideo(video, performance.now());
      const gesture = classifyHandGesture(result.landmarks[0]);
      setActiveGesture(gesture);
      setGestureMessage(formatHandGestureMessage(gesture));
      if (gesture !== "none" && gesture !== "fist") {
        const now = performance.now();
        if (now - lastGestureDirectionAtRef.current > GESTURE_DIRECTION_COOLDOWN_MS) {
          lastGestureDirectionAtRef.current = now;
          applyDirection(gesture, "gesture");
        }
      }
      gestureFrameRef.current = requestAnimationFrame(detectFrame);
    };

    if (gestureFrameRef.current !== null) {
      cancelAnimationFrame(gestureFrameRef.current);
    }
    gestureFrameRef.current = requestAnimationFrame(detectFrame);
  }

  function handleWordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetSnake(wordInput);
  }

  function handleSnakeKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const direction = SNAKE_KEY_DIRECTIONS[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    if (keyboardControlsDisabled) {
      return;
    }
    applyDirection(direction);
  }

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }
      const direction = SNAKE_KEY_DIRECTIONS[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      if (keyboardControlsDisabled) {
        return;
      }
      applyDirection(direction);
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [keyboardControlsDisabled]);

  useEffect(() => {
    if (gameState.status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setGameState((state) => advanceSnakeGame(state, pendingDirectionRef.current, activeWord, boardSize));
    }, activeSnakeSpeedMs);

    return () => window.clearInterval(intervalId);
  }, [activeWord, boardSize, gameState.status, activeSnakeSpeedMs]);

  useEffect(() => {
    return () => {
      if (gestureFrameRef.current !== null) {
        cancelAnimationFrame(gestureFrameRef.current);
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      handLandmarkerRef.current?.close();
    };
  }, []);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
        <PrimarySidebar
          applications={APPLICATION_CONFIGS}
          activeApplicationId={activeApplicationId}
          onSelectApplication={onSelectApplication}
        />
        <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background">
          <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 shadow-sm backdrop-blur max-sm:h-auto max-sm:flex-col max-sm:items-stretch max-sm:px-3 max-sm:py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <SidebarTrigger className="size-7" aria-label="Toggle application navigation" />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
                  <Gamepad2 />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-extrabold leading-none tracking-normal">{WORD_SNAKE_CONFIG.name}</h1>
                  <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground">{WORD_SNAKE_CONFIG.subtitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 max-sm:justify-start">
                <Badge variant="secondary">{boardSize} x {boardSize}</Badge>
                <Badge variant={gameState.status === "running" ? "default" : "secondary"}>
                  {formatSnakeStatus(gameState.status)}
                </Badge>
              </div>
            </header>

            <section className="min-h-0 flex-1 overflow-hidden p-4 max-sm:overflow-y-auto max-sm:overflow-x-hidden max-sm:p-3">
              <section className="mx-auto grid h-full min-h-0 max-w-[1440px] grid-rows-[minmax(0,1fr)_auto] gap-4 max-sm:h-auto max-sm:min-h-full max-sm:grid-rows-none">
                <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-4 overflow-hidden max-lg:grid-cols-1 max-lg:grid-rows-none max-lg:overflow-visible">
                  <Card className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden py-0">
                    <CardContent className="grid min-h-12 grid-cols-[auto_auto_auto] items-center justify-between gap-3 border-b p-3 max-sm:flex max-sm:flex-col max-sm:items-stretch">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <span className={cn("size-2.5 rounded-full ring-4", gameState.status === "running" ? "bg-emerald-600 ring-emerald-600/15" : "bg-primary ring-primary/15")} />
                        {formatSnakeStatus(gameState.status)}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button type="button" size="icon" variant="outline" aria-label={gameState.status === "running" ? "Pause" : "Play"} title={gameState.status === "running" ? "Pause" : "Play"} onClick={gameState.status === "running" ? pauseSnake : startSnake}>
                          {gameState.status === "running" ? <Pause /> : <Play />}
                        </Button>
                        <Button type="button" size="icon" variant="outline" aria-label="Reset" title="Reset" onClick={() => resetSnake(activeWord)}>
                          <RotateCcw />
                        </Button>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-sm font-black max-sm:justify-center">
                        <Trophy className="size-4 text-primary" />
                        {gameState.score}
                      </div>
                    </CardContent>

                    <CardContent
                      className="grid min-h-0 place-items-center overflow-hidden bg-[#f8fbf7] p-4"
                      tabIndex={0}
                      onKeyDown={handleSnakeKeyDown}
                    >
                      <div
                        className="grid aspect-square w-full max-w-full overflow-hidden rounded-lg border-2 border-[#07111f] bg-[#eef7ed] shadow-sm"
                        style={{
                          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
                          maxWidth: "min(72vh, 880px, calc(100vw - 80px))"
                        }}
                        aria-label={`${WORD_SNAKE_CONFIG.name} board`}
                        data-control-mode={isHandControlActive ? "camera" : "keyboard"}
                        data-keyboard-disabled={keyboardControlsDisabled ? "true" : "false"}
                        data-snake-speed-ms={activeSnakeSpeedMs}
                      >
                        {Array.from({ length: boardSize * boardSize }, (_, index) => {
                          const cell = { x: index % boardSize, y: Math.floor(index / boardSize) };
                          const snakeIndex = gameState.snake.findIndex((segment) => sameSnakeCell(segment, cell));
                          const target = gameState.targets.find((item) => sameSnakeCell(item, cell));
                          const isSnake = snakeIndex >= 0;

                          return (
                            <div
                              key={`${cell.x}-${cell.y}`}
                              className="relative grid min-h-0 min-w-0 place-items-center overflow-visible border border-[rgba(7,17,31,0.055)]"
                            >
                              {isSnake ? <SnakeSegment snake={gameState.snake} segmentIndex={snakeIndex} /> : null}
                              {target && !isSnake ? (
                                <SnakeTargetMarker target={target} />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="min-h-0 min-w-0 overflow-hidden py-0">
                    <CardHeader className="border-b py-3">
                        <CardTitle className="flex items-center gap-2 text-sm uppercase text-muted-foreground">
                        <Target className="size-4" />
                        Phrase
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="min-h-0 flex-1">
                      <CardContent className="grid gap-4 p-3">
                        <form className="grid gap-2" onSubmit={handleWordSubmit}>
                          <Field>
                            <FieldLabel htmlFor="word-snake-input">Sentence or phrase</FieldLabel>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                              <Input
                                id="word-snake-input"
                                value={wordInput}
                                maxLength={SNAKE_MAX_PHRASE_LENGTH}
                                onChange={(event) => setWordInput(event.target.value)}
                                onFocus={(event) => event.currentTarget.select()}
                                className="text-base font-black"
                              />
                              <Button type="submit">Set</Button>
                            </div>
                          </Field>
                        </form>

                        <div className="grid gap-2 rounded-lg border border-input p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase text-muted-foreground">Next</span>
                            <Badge variant="secondary">{gameState.progress}/{activeWord.length}</Badge>
                          </div>
                          <SnakePhrasePreview phrase={activeWord} progress={gameState.progress} />
                        </div>

                        <div className="grid gap-3 rounded-lg border border-input p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-black">
                                <Hand className="size-4 text-primary" />
                                Hand control
                              </div>
                              <div className="mt-1 text-xs font-semibold text-muted-foreground">{gestureMessage}</div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={gestureCameraStatus === "ready" ? "outline" : "default"}
                              disabled={gestureCameraStatus === "loading"}
                              onClick={gestureCameraStatus === "ready" ? () => stopGestureCamera() : startGestureCamera}
                            >
                              {gestureCameraStatus === "ready" ? <CameraOff data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
                              {gestureCameraStatus === "ready" ? "Off" : gestureCameraStatus === "loading" ? "Loading" : "Camera"}
                            </Button>
                          </div>
                          <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3">
                            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                              <video
                                ref={videoRef}
                                className={cn(
                                  "size-full scale-x-[-1] object-cover",
                                  gestureCameraStatus === "ready" ? "opacity-100" : "opacity-0"
                                )}
                                muted
                                playsInline
                                aria-label="Hand control camera preview"
                              />
                              {gestureCameraStatus !== "ready" ? (
                                <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                                  <Camera className="size-5" />
                                </div>
                              ) : null}
                            </div>
                            <div className="grid gap-2">
                              <div className="flex flex-wrap gap-1.5">
                                {(["up", "left", "right", "down", "fist"] as HandGesture[]).map((gesture) => (
                                  <Badge key={gesture} variant={activeGesture === gesture ? "default" : "secondary"}>
                                    {formatHandGestureLabel(gesture)}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs font-medium text-muted-foreground">Point with one finger to steer. Make a fist to hold direction input.</p>
                            </div>
                          </div>
                        </div>

                      </CardContent>
                    </ScrollArea>
                  </Card>
                </section>

                <Collapsible defaultOpen={false}>
                  <section className="grid gap-2" aria-label="Word Snake readouts">
                    <CollapsibleTrigger className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full justify-start gap-2 bg-card px-4 shadow-sm")}>
                      <Info data-icon="inline-start" />
                      <span className="truncate text-left">{WORD_SNAKE_CONFIG.tip}</span>
                      <ChevronDown data-icon="inline-end" className="ml-auto transition-transform" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:flex max-sm:min-h-20 max-sm:overflow-x-auto">
                        <Readout title="Board" value={`${boardSize} x ${boardSize}`} detail="auto" />
                        <Readout title="Phrase" value={activeWord} detail={`${activeWord.length} characters`} />
                        <Readout title="Target" value={nextCharacter ? formatSnakeCharacterLabel(nextCharacter) : "Done"} detail="required" />
                        <Readout title="Score" value={String(gameState.score)} detail={formatSnakeStatus(gameState.status)} />
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>
              </section>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AvatarSettingsApp({
  activeApplicationId,
  onSelectApplication,
  sharedAvatarAsset
}: {
  activeApplicationId: ApplicationId;
  onSelectApplication: (applicationId: ApplicationId) => void;
  sharedAvatarAsset: ObjectShapeAsset | null;
}) {
  const liveAvatarAsset = useLiveSpriteSheetAsset();
  const visibleAvatarAsset = liveAvatarAsset ?? sharedAvatarAsset ?? SPRITE_TEMPLATE_ASSET;

  return (
    <TooltipProvider>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
        <PrimarySidebar
          applications={APPLICATION_CONFIGS}
          activeApplicationId={activeApplicationId}
          onSelectApplication={onSelectApplication}
        />
        <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background">
          <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 shadow-sm backdrop-blur max-sm:h-auto max-sm:flex-col max-sm:items-stretch max-sm:px-3 max-sm:py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <SidebarTrigger className="size-7" aria-label="Toggle application navigation" />
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:size-4">
                  <Settings />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-extrabold leading-none tracking-normal">{SETTINGS_CONFIG.name}</h1>
                  <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground">{SETTINGS_CONFIG.subtitle}</p>
                </div>
              </div>
              <Badge variant="secondary">Sprite guide</Badge>
            </header>

            <section className="min-h-0 flex-1 overflow-hidden p-4 max-sm:overflow-y-auto max-sm:overflow-x-hidden max-sm:p-3">
              <section className="mx-auto grid h-full min-h-0 max-w-[1440px] grid-cols-[380px_minmax(0,1fr)] gap-4 max-lg:grid-cols-1 max-lg:overflow-visible">
                <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden py-0">
                  <CardHeader className="border-b py-3">
                    <CardTitle className="flex items-center gap-2 text-sm uppercase text-muted-foreground">
                      <Settings className="size-4" />
                      Codex sprite-sheet brief
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid min-h-0 gap-4 overflow-y-auto p-3 text-sm">
                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black">Use the fixed avatar template</h2>
                        <Badge variant="secondary">4 in x 7 in</Badge>
                      </div>
                      <p className="font-medium leading-relaxed text-muted-foreground">
                        The final sheet starts from a pure white header with the square source photo first, Discord QR second, and the FIRA 2026 plus Prompthon.io logos on the right, then fills the 3 x 4 grid with six emotions and two variations each.
                      </p>
                      <code className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                        public/generated-avatar/sprite-template-4x7.png
                      </code>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <h2 className="text-sm font-black">Agent steps</h2>
                      <ol className="grid gap-2 text-muted-foreground">
                        <li className="leading-relaxed"><span className="font-black text-foreground">1.</span> Keep the 1200 x 2100 template canvas unchanged.</li>
                        <li className="leading-relaxed"><span className="font-black text-foreground">2.</span> Preserve the fixed header order: square photo, QR code, then logos.</li>
                        <li className="leading-relaxed"><span className="font-black text-foreground">3.</span> Fill the slots left-to-right, top-to-bottom: two versions of each emotion.</li>
                        <li className="leading-relaxed"><span className="font-black text-foreground">4.</span> Write preview updates to the live preview path; do not refresh the browser page during generation.</li>
                      </ol>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <h2 className="text-sm font-black">Circle grid</h2>
                      <div className="grid grid-cols-2 gap-2 text-xs font-black uppercase text-muted-foreground">
                        <div className="rounded-md bg-muted px-2 py-1">3 columns</div>
                        <div className="rounded-md bg-muted px-2 py-1">4 rows</div>
                        <div className="rounded-md bg-muted px-2 py-1">310 px circles</div>
                        <div className="rounded-md bg-muted px-2 py-1">80 px row gap</div>
                      </div>
                      <code className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                        {`public${SPRITE_TEMPLATE_MANIFEST_PATH}`}
                      </code>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <h2 className="text-sm font-black">Sticker fill order</h2>
                      <div className="grid grid-cols-2 gap-2">
                        {AVATAR_TEMPLATE_STICKERS.map((sticker) => (
                          <div key={sticker} className="rounded-md bg-muted px-2 py-1 text-xs font-black uppercase text-muted-foreground">
                            {formatStickerLabel(sticker)}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <h2 className="text-sm font-black">Visual rules</h2>
                      <ul className="grid gap-1.5 font-medium text-muted-foreground">
                        <li>ImageGen-catalyzed cartoon avatars, not direct photo markup.</li>
                        <li>Fixed 4 in x 7 in sheet ratio for every output.</li>
                        <li>Avatar artwork must stay inside each light gray dashed circle slot.</li>
                        <li>Use cute but exaggerated expressions, with two distinct variants per emotion.</li>
                        <li>Header photo, QR code, logos, and circle positions must not drift.</li>
                      </ul>
                    </section>

                    <section className="grid gap-2 rounded-lg border border-input bg-card p-3">
                      <h2 className="text-sm font-black">Live preview path</h2>
                      <p className="font-medium leading-relaxed text-muted-foreground">
                        The preview panel watches this file and updates in place when Codex writes a new ImageGen result.
                      </p>
                      <code className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                        {LIVE_SPRITE_SHEET_PREVIEW_PATH}
                      </code>
                    </section>
                  </CardContent>
                </Card>

                <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden py-0">
                  <CardHeader className="border-b py-3">
                    <CardTitle className="flex items-center gap-2 text-sm uppercase text-muted-foreground">
                      <ImageIcon className="size-4" />
                      Sprite sheet preview
                    </CardTitle>
                    <CardAction>
                      {visibleAvatarAsset ? (
                        <a
                          href={visibleAvatarAsset.dataUrl}
                          download="avatar-sprite-sheet.png"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "no-underline")}
                        >
                          <Download data-icon="inline-start" />
                          PNG
                        </a>
                      ) : null}
                    </CardAction>
                  </CardHeader>
                  <CardContent className="grid min-h-0 place-items-center bg-[#f8fbf7] p-4">
                    <div
                      className={cn(
                        "grid place-items-center overflow-hidden rounded-lg border-2 border-[#07111f] bg-card shadow-sm",
                        "h-full max-h-[680px] max-w-full"
                      )}
                      style={getSpriteSheetPreviewStyle(visibleAvatarAsset)}
                    >
                      {visibleAvatarAsset ? (
                        <img src={visibleAvatarAsset.previewUrl ?? visibleAvatarAsset.dataUrl} alt="Generated avatar sprite sheet" className="size-full object-contain" />
                      ) : (
                        <div className="grid justify-items-center gap-3 px-4 text-center text-muted-foreground">
                          <ImageIcon className="size-8" />
                          <div>
                            <div className="text-sm font-black text-foreground">Awaiting ImageGen sprite sheet</div>
                            <div className="mt-1 text-xs font-semibold">Preview updates appear here without refreshing the page.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function PrimarySidebar({
  applications,
  activeApplicationId,
  onSelectApplication
}: {
  applications: NavigationApplication[];
  activeApplicationId: ApplicationId;
  onSelectApplication: (applicationId: ApplicationId) => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="sidebar" aria-label="Primary applications">
      <SidebarHeader className="h-14 justify-center border-b p-0">
        <div className="flex h-full w-full items-center overflow-hidden pl-3 pr-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <img
            className="h-full w-auto max-w-none origin-left scale-[1.18] object-contain object-left group-data-[collapsible=icon]:hidden"
            src={prompthonLogo}
            alt="Prompthon Community"
          />
          <img
            className="hidden size-11 object-contain group-data-[collapsible=icon]:block"
            src={prompthonSquareLogo}
            alt="Prompthon"
          />
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>Applications</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {applications.map((application) => (
                <SidebarMenuItem key={application.id}>
                  <SidebarMenuButton
                    isActive={application.id === activeApplicationId}
                    tooltip={application.name}
                    aria-label={`Open ${application.name}`}
                    onClick={() => onSelectApplication(application.id)}
                  >
                    {application.id === "collision-lab" ? <FlaskConical /> : <Gamepad2 />}
                    <span>{application.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto border-t border-sidebar-border pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeApplicationId === SETTINGS_CONFIG.id}
                  tooltip={SETTINGS_CONFIG.name}
                  aria-label={`Open ${SETTINGS_CONFIG.name}`}
                  onClick={() => onSelectApplication(SETTINGS_CONFIG.id)}
                >
                  <Settings />
                  <span>{SETTINGS_CONFIG.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function SnakeTargetMarker({ target }: { target: LetterTarget }) {
  const isSpace = target.character === " ";

  return (
    <span
      className={cn(
        "grid aspect-square w-[78%] place-items-center rounded-full text-[clamp(0.62rem,2.2vw,1rem)] font-black leading-none shadow-sm",
        "bg-[#2563eb] text-white",
        isSpace && "border-2 border-[#2563eb] bg-card text-[#2563eb]"
      )}
      aria-label={`${target.isRequired ? "Required" : "Decoy"} ${formatSnakeCharacterLabel(target.character)}`}
      data-target-character={isSpace ? "space" : target.character}
      data-target-required={target.isRequired ? "true" : "false"}
    >
      {isSpace ? null : target.character}
    </span>
  );
}

function SnakePhrasePreview({ phrase, progress }: { phrase: string; progress: number }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5">
      {Array.from(phrase).map((character, index) => {
        const state = index < progress ? "complete" : index === progress ? "current" : "pending";
        const isSpace = character === " ";
        return (
          <span
            key={`${character}-${index}`}
            className={cn(
              "grid h-9 min-w-8 place-items-center rounded-md px-2 text-lg font-black leading-none",
              state === "complete" && "bg-[#10a37f] text-white",
              state === "current" && "bg-primary text-primary-foreground",
              state === "pending" && "bg-secondary text-muted-foreground",
              isSpace && "px-3"
            )}
            aria-label={`${state} ${formatSnakeCharacterLabel(character)}`}
          >
            {isSpace ? <span className="size-2 rounded-full bg-current opacity-75" /> : character}
          </span>
        );
      })}
    </div>
  );
}

function SnakeSegment({
  snake,
  segmentIndex
}: {
  snake: SnakeCell[];
  segmentIndex: number;
}) {
  const isHead = segmentIndex === 0;
  const isTail = segmentIndex === snake.length - 1;
  const color = isHead ? "#07111f" : "#10a37f";
  const connections = getSnakeSegmentConnections(snake, segmentIndex);
  const isEndpoint = isHead || isTail;
  const isStraight =
    connections.length === 2 &&
    ((connections.includes("left") && connections.includes("right")) ||
      (connections.includes("up") && connections.includes("down")));
  const endpointDirection = connections[0] ?? "right";

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-snake-segment={segmentIndex} aria-hidden="true">
      {isEndpoint ? (
        <>
          <span className="absolute" data-snake-part="endpoint-rect" style={getSnakeEndpointRectStyle(endpointDirection, color)} />
          <span
            className={cn("absolute rounded-full shadow-sm", isHead && "shadow-[0_2px_5px_rgba(7,17,31,0.22)]")}
            data-snake-part="endpoint-cap"
            style={getSnakeEndpointCapStyle(endpointDirection, color)}
          />
        </>
      ) : isStraight ? (
        <span
          className="absolute"
          data-snake-part="straight"
          style={getSnakeStraightStyle(connections.includes("left") ? "horizontal" : "vertical", color)}
        />
      ) : (
        <>
          {connections.map((direction) => (
            <span key={direction} className="absolute" data-snake-part={`connector-${direction}`} style={getSnakeConnectorStyle(direction, color)} />
          ))}
          <span className="absolute rounded-[28%]" data-snake-part="elbow" style={getSnakeElbowStyle(color)} />
        </>
      )}
      {isHead ? (
        <span className="absolute size-[16%] rounded-full bg-white/95 shadow-sm" data-snake-part="eye" style={getSnakeEyeStyle(endpointDirection)} />
      ) : null}
    </div>
  );
}

function getSnakeSegmentConnections(snake: SnakeCell[], segmentIndex: number): SnakeDirection[] {
  const segment = snake[segmentIndex];
  const connections: SnakeDirection[] = [];
  const previous = snake[segmentIndex - 1];
  const next = snake[segmentIndex + 1];
  const previousDirection = previous ? getAdjacentSnakeDirection(segment, previous) : null;
  const nextDirection = next ? getAdjacentSnakeDirection(segment, next) : null;

  if (previousDirection) {
    connections.push(previousDirection);
  }
  if (nextDirection && nextDirection !== previousDirection) {
    connections.push(nextDirection);
  }

  return connections;
}

function getAdjacentSnakeDirection(from: SnakeCell, to: SnakeCell): SnakeDirection | null {
  if (to.x === from.x && to.y === from.y - 1) {
    return "up";
  }
  if (to.x === from.x + 1 && to.y === from.y) {
    return "right";
  }
  if (to.x === from.x && to.y === from.y + 1) {
    return "down";
  }
  if (to.x === from.x - 1 && to.y === from.y) {
    return "left";
  }
  return null;
}

function getSnakeConnectorStyle(direction: SnakeDirection, color: string): CSSProperties {
  const base = {
    backgroundColor: color
  };
  if (direction === "up") {
    return { ...base, left: "21%", top: "-2px", width: "58%", height: "calc(50% + 2px)" };
  }
  if (direction === "right") {
    return { ...base, left: "50%", top: "21%", width: "calc(50% + 2px)", height: "58%" };
  }
  if (direction === "down") {
    return { ...base, left: "21%", top: "50%", width: "58%", height: "calc(50% + 2px)" };
  }
  return { ...base, left: "-2px", top: "21%", width: "calc(50% + 2px)", height: "58%" };
}

function getSnakeElbowStyle(color: string): CSSProperties {
  return {
    backgroundColor: color,
    left: "21%",
    top: "21%",
    width: "58%",
    height: "58%"
  };
}

function getSnakeStraightStyle(axis: "horizontal" | "vertical", color: string): CSSProperties {
  if (axis === "horizontal") {
    return {
      backgroundColor: color,
      left: "-2px",
      top: "21%",
      width: "calc(100% + 4px)",
      height: "58%"
    };
  }
  return {
    backgroundColor: color,
    left: "21%",
    top: "-2px",
    width: "58%",
    height: "calc(100% + 4px)"
  };
}

function getSnakeEndpointRectStyle(directionToBody: SnakeDirection, color: string): CSSProperties {
  if (directionToBody === "left") {
    return { backgroundColor: color, left: "-2px", top: "21%", width: "calc(52% + 2px)", height: "58%" };
  }
  if (directionToBody === "right") {
    return { backgroundColor: color, left: "48%", top: "21%", width: "calc(52% + 2px)", height: "58%" };
  }
  if (directionToBody === "up") {
    return { backgroundColor: color, left: "21%", top: "-2px", width: "58%", height: "calc(52% + 2px)" };
  }
  return { backgroundColor: color, left: "21%", top: "48%", width: "58%", height: "calc(52% + 2px)" };
}

function getSnakeEndpointCapStyle(directionToBody: SnakeDirection, color: string): CSSProperties {
  if (directionToBody === "left") {
    return { backgroundColor: color, left: "21%", top: "21%", width: "58%", height: "58%" };
  }
  if (directionToBody === "right") {
    return { backgroundColor: color, left: "21%", top: "21%", width: "58%", height: "58%" };
  }
  if (directionToBody === "up") {
    return { backgroundColor: color, left: "21%", top: "21%", width: "58%", height: "58%" };
  }
  return { backgroundColor: color, left: "21%", top: "21%", width: "58%", height: "58%" };
}

function getSnakeEyeStyle(directionToBody: SnakeDirection): CSSProperties {
  if (directionToBody === "left") {
    return { left: "62%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  if (directionToBody === "right") {
    return { left: "38%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  if (directionToBody === "up") {
    return { left: "50%", top: "62%", transform: "translate(-50%, -50%)" };
  }
  return { left: "50%", top: "38%", transform: "translate(-50%, -50%)" };
}

function normalizeSnakePhrase(value: string) {
  const normalizedPhrase = value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, SNAKE_MAX_PHRASE_LENGTH);
  return normalizedPhrase.trim() ? normalizedPhrase : SNAKE_WORD_FALLBACK;
}

function getSnakeBoardSize(word: string) {
  return Math.round(clamp(12 + word.length, 14, 28));
}

function createSnakeGameState(word: string, boardSize: number): SnakeGameState {
  const snake = createInitialSnake(boardSize);
  return {
    snake,
    direction: "right",
    targets: createLetterTargets(word, 0, boardSize, snake),
    progress: 0,
    score: 0,
    strikes: 0,
    status: "ready"
  };
}

function createInitialSnake(boardSize: number): SnakeCell[] {
  const center = Math.floor(boardSize / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center }
  ];
}

function advanceSnakeGame(
  state: SnakeGameState,
  pendingDirection: SnakeDirection,
  word: string,
  boardSize: number
): SnakeGameState {
  if (state.status !== "running") {
    return state;
  }

  const direction = isOppositeSnakeDirection(state.direction, pendingDirection) ? state.direction : pendingDirection;
  const vector = SNAKE_DIRECTIONS[direction];
  const nextHead = {
    x: state.snake[0].x + vector.x,
    y: state.snake[0].y + vector.y
  };

  if (isOutsideSnakeBoard(nextHead, boardSize) || state.snake.some((segment) => sameSnakeCell(segment, nextHead))) {
    return { ...state, direction, status: "lost" };
  }

  const target = state.targets.find((item) => sameSnakeCell(item, nextHead));
  if (!target) {
    return {
      ...state,
      direction,
      snake: [nextHead, ...state.snake.slice(0, -1)]
    };
  }

  if (!target.isRequired) {
    const strikes = state.strikes + 1;
    const snake = [nextHead, ...state.snake.slice(0, Math.max(2, state.snake.length - 2))];
    return {
      ...state,
      direction,
      snake,
      strikes,
      score: Math.max(0, state.score - 25),
      targets: createLetterTargets(word, state.progress, boardSize, snake),
      status: strikes >= SNAKE_MAX_STRIKES ? "lost" : "running"
    };
  }

  const progress = state.progress + 1;
  const snake = [nextHead, ...state.snake];
  const score = state.score + 100 + progress * 15;
  if (progress >= word.length) {
    return {
      ...state,
      direction,
      snake,
      progress,
      score,
      targets: [],
      status: "won"
    };
  }

  return {
    ...state,
    direction,
    snake,
    progress,
    score,
    targets: createLetterTargets(word, progress, boardSize, snake)
  };
}

function createLetterTargets(word: string, progress: number, boardSize: number, snake: SnakeCell[]) {
  const requiredCharacter = word[progress] ?? "";
  if (!requiredCharacter) {
    return [];
  }

  const blockedCells = new Set(snake.map(snakeCellKey));
  const targets: LetterTarget[] = [];
  const requiredCount = Math.min(4, Math.max(2, Math.ceil(word.length / 12)));
  for (let index = 0; index < requiredCount; index += 1) {
    const requiredCell = getRandomFreeSnakeCell(boardSize, blockedCells);
    blockedCells.add(snakeCellKey(requiredCell));
    targets.push({
      ...requiredCell,
      id: `required-${progress}-${index}-${requiredCell.x}-${requiredCell.y}`,
      character: requiredCharacter,
      isRequired: true
    });
  }

  const decoyCount = Math.min(8, Math.max(4, Math.ceil(word.length / 4)));
  for (let index = 0; index < decoyCount; index += 1) {
    const cell = getRandomFreeSnakeCell(boardSize, blockedCells);
    blockedCells.add(snakeCellKey(cell));
    targets.push({
      ...cell,
      id: `decoy-${progress}-${index}-${cell.x}-${cell.y}`,
      character: getRandomDecoyCharacter(requiredCharacter, word),
      isRequired: false
    });
  }

  return targets;
}

function getRandomFreeSnakeCell(boardSize: number, blockedCells: Set<string>): SnakeCell {
  const maxAttempts = boardSize * boardSize;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const cell = {
      x: Math.floor(Math.random() * boardSize),
      y: Math.floor(Math.random() * boardSize)
    };
    if (!blockedCells.has(snakeCellKey(cell))) {
      return cell;
    }
  }

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const cell = { x, y };
      if (!blockedCells.has(snakeCellKey(cell))) {
        return cell;
      }
    }
  }

  return { x: 0, y: 0 };
}

function getRandomDecoyCharacter(requiredCharacter: string, phrase: string) {
  const fallbackCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?;:-";
  const phraseCharacters = Array.from(new Set(Array.from(phrase).filter((character) => character !== requiredCharacter)));
  const candidates = phraseCharacters.length > 0
    ? phraseCharacters
    : Array.from(fallbackCharacters.replace(requiredCharacter, ""));
  return candidates[Math.floor(Math.random() * candidates.length)] || "Z";
}

function formatSnakeCharacterLabel(character: string) {
  if (character === " ") {
    return "Space";
  }
  return character;
}

function sameSnakeCell(a: SnakeCell, b: SnakeCell) {
  return a.x === b.x && a.y === b.y;
}

function snakeCellKey(cell: SnakeCell) {
  return `${cell.x}:${cell.y}`;
}

function isOutsideSnakeBoard(cell: SnakeCell, boardSize: number) {
  return cell.x < 0 || cell.y < 0 || cell.x >= boardSize || cell.y >= boardSize;
}

function isOppositeSnakeDirection(currentDirection: SnakeDirection, nextDirection: SnakeDirection) {
  return (
    (currentDirection === "up" && nextDirection === "down") ||
    (currentDirection === "down" && nextDirection === "up") ||
    (currentDirection === "left" && nextDirection === "right") ||
    (currentDirection === "right" && nextDirection === "left")
  );
}

function formatSnakeStatus(status: SnakeStatus) {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "paused") {
    return "Paused";
  }
  if (status === "won") {
    return "Complete";
  }
  return "Game over";
}

function formatChallengeStatus(status: ChallengeStatus) {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "running") {
    return "Fighting";
  }
  if (status === "won") {
    return "Won";
  }
  return "Lost";
}

function classifyHandGesture(landmarks?: NormalizedLandmark[]): HandGesture {
  if (!landmarks || landmarks.length < 21) {
    return "none";
  }

  const wrist = landmarks[0];
  const indexTip = landmarks[8];
  const indexExtended = isFingerExtended(landmarks, 8, 6);
  const extendedFingers = [
    indexExtended,
    isFingerExtended(landmarks, 12, 10),
    isFingerExtended(landmarks, 16, 14),
    isFingerExtended(landmarks, 20, 18)
  ].filter(Boolean).length;

  if (extendedFingers === 0) {
    return "fist";
  }
  if (!indexExtended || extendedFingers > 2) {
    return "none";
  }

  const mirroredDx = wrist.x - indexTip.x;
  const dy = indexTip.y - wrist.y;
  const absX = Math.abs(mirroredDx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 0.12) {
    return "none";
  }
  if (absX > absY * 1.1) {
    return mirroredDx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

function isFingerExtended(landmarks: NormalizedLandmark[], tipIndex: number, pipIndex: number) {
  const wrist = landmarks[0];
  return landmarkDistance(wrist, landmarks[tipIndex]) > landmarkDistance(wrist, landmarks[pipIndex]) + 0.035;
}

function landmarkDistance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatHandGestureMessage(gesture: HandGesture) {
  if (gesture === "none") {
    return "Show a pointing hand";
  }
  if (gesture === "fist") {
    return "Fist detected: holding";
  }
  return `Pointing ${formatHandGestureLabel(gesture)}`;
}

function formatHandGestureLabel(gesture: HandGesture) {
  if (gesture === "up") {
    return "Up";
  }
  if (gesture === "right") {
    return "Right";
  }
  if (gesture === "down") {
    return "Down";
  }
  if (gesture === "left") {
    return "Left";
  }
  if (gesture === "fist") {
    return "Fist";
  }
  return "None";
}

function buildObjectSettings(objects: ApplicationConfigObject[]): ObjectSettings[] {
  return objects.map((object) => {
    const material = isMaterial(object.material) ? object.material : "rubber";
    return {
      ...object,
      material,
      speed: object.isStatic ? 0 : object.speed,
      shapeAsset: object.shapeAsset ? resolveShapeAsset(object.shapeAsset) : undefined
    };
  });
}

function resolveShapeAsset(asset: ObjectShapeAssetConfig): ObjectShapeAsset {
  return {
    dataUrl: resolveAssetUrl(asset.targetFile),
    name: asset.name,
    mimeType: asset.mimeType,
    spriteSheet: asset.spriteSheet
  };
}

function resolveAssetUrl(targetFile: string) {
  const normalizedTarget = targetFile.replace(/^\.?\/*assets\//, "").replace(/^\.\//, "");
  const assetKey = `./assets/${normalizedTarget}`;
  const assetUrl = ASSET_URLS[assetKey];
  if (!assetUrl) {
    throw new Error(`Application config references missing asset: ${targetFile}`);
  }
  return assetUrl;
}

function isMaterial(value: string): value is Material {
  return MATERIALS.includes(value as Material);
}

function createEmptyChallengeState(): ChallengeState {
  return {
    warriorHp: CHALLENGE_START_HP,
    monsterHp: CHALLENGE_MONSTER_HP,
    foods: [],
    status: "ready",
    score: 0,
    lastEvent: "Aim the warrior and press play"
  };
}

function cloneChallengeState(state: ChallengeState): ChallengeState {
  return {
    ...state,
    foods: state.foods.map((food) => ({
      ...food,
      position: { ...food.position }
    }))
  };
}

function createChallengeInitialObjects(settings: ObjectSettings[], bounds: WorldBounds): SimObject[] {
  const [warriorSettings, monsterSettings] = settings;
  const warriorRadius = (radiusFromMass(warriorSettings.mass) / 80) * OBJECT_RADIUS_MULTIPLIER * CHALLENGE_WARRIOR_RADIUS_SCALE;
  const monsterMass = Math.max(monsterSettings.mass + 1.5, 3.5);
  const monsterRadius = (radiusFromMass(monsterMass) / 80) * OBJECT_RADIUS_MULTIPLIER * CHALLENGE_MONSTER_RADIUS_SCALE;
  const warriorPosition = getRandomChallengePosition(bounds, warriorRadius);
  const monsterPosition = getRandomChallengePosition(bounds, monsterRadius, [
    { position: warriorPosition, radius: warriorRadius + 2.2 }
  ]);

  return [
    {
      id: "A",
      name: "Warrior",
      color: "#2563eb",
      mass: warriorSettings.mass,
      material: warriorSettings.material,
      isStatic: false,
      shapeAsset: undefined,
      position: warriorPosition,
      velocity: speedToVector(Math.abs(warriorSettings.speed), warriorSettings.angle),
      radius: warriorRadius
    },
    {
      id: "B",
      name: "Monster",
      color: "#c2410c",
      mass: monsterMass,
      material: monsterSettings.material,
      isStatic: false,
      shapeAsset: undefined,
      position: monsterPosition,
      velocity: { x: 0, y: 0 },
      radius: monsterRadius
    }
  ];
}

function createChallengeState(bounds: WorldBounds, objects: SimObject[]): ChallengeState {
  const blockers = objects.map((object) => ({ position: object.position, radius: object.radius + 0.85 }));
  const foodCount = Math.random() < 0.5 ? 2 : 3;
  const foods: ChallengeFood[] = [];
  for (let index = 0; index < foodCount; index += 1) {
    const position = getRandomChallengePosition(bounds, CHALLENGE_FOOD_RADIUS, [
      ...blockers,
      ...foods.map((food) => ({ position: food.position, radius: food.radius + 0.9 }))
    ]);
    foods.push({
      id: `food-${index + 1}`,
      position,
      radius: CHALLENGE_FOOD_RADIUS,
      hp: CHALLENGE_FOOD_HEAL,
      active: true
    });
  }

  return {
    ...createEmptyChallengeState(),
    foods
  };
}

function getRandomChallengePosition(
  bounds: WorldBounds,
  radius: number,
  blockers: { position: Vector; radius: number }[] = []
): Vector {
  const padding = radius + 0.35;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const position = {
      x: randomBetween(bounds.left + padding, bounds.right - padding),
      y: randomBetween(bounds.top + padding, bounds.bottom - padding)
    };
    if (blockers.every((blocker) => Math.hypot(position.x - blocker.position.x, position.y - blocker.position.y) > radius + blocker.radius)) {
      return position;
    }
  }
  return {
    x: randomBetween(bounds.left + padding, bounds.right - padding),
    y: randomBetween(bounds.top + padding, bounds.bottom - padding)
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getFallbackObjects(mode: Mode, settings: ObjectSettings[]): SimObject[] {
  return createInitialObjects(mode === "challenge" ? "2d" : mode, settings);
}

function createInitialObjects(mode: Mode, settings: ObjectSettings[]): SimObject[] {
  const activeSettings = mode === "1d" ? settings.slice(0, 2) : settings;

  return activeSettings.map((object, index) => {
    const velocity = object.isStatic
      ? { x: 0, y: 0 }
      : mode === "1d"
        ? { x: object.speed, y: 0 }
        : speedToVector(Math.abs(object.speed), object.angle);

    return {
      id: object.id,
      name: object.name,
      color: object.color,
      mass: object.mass,
      material: object.material,
      isStatic: object.isStatic,
      shapeAsset: object.shapeAsset,
      position: object.position ?? getInitialPosition(mode, index, activeSettings.length),
      velocity,
      radius: (radiusFromMass(object.mass) / 80) * OBJECT_RADIUS_MULTIPLIER
    };
  });
}

function cloneSimObjects(objects: SimObject[]): SimObject[] {
  return objects.map((object) => ({
    ...object,
    position: { ...object.position },
    velocity: { ...object.velocity }
  }));
}

function getInitialPosition(mode: Mode, index: number, count: number): Vector {
  if (mode === "1d") {
    return index === 0 ? { x: -3.4, y: 0 } : { x: 3.2, y: 0 };
  }

  if (count === 2) {
    return index === 0 ? { x: -3.2, y: -1.2 } : { x: 3.1, y: 1.1 };
  }

  const angle = -Math.PI + (index / count) * Math.PI * 2;
  const spreadX = Math.min(4.5, 2.4 + count * 0.28);
  const spreadY = Math.min(2.8, 1.35 + count * 0.18);
  return {
    x: Math.cos(angle) * spreadX,
    y: Math.sin(angle) * spreadY
  };
}

function createSnapshot(objects: SimObject[], collisionCount: number): Snapshot {
  const [a, b] = objects;
  if (!a || !b) {
    return EMPTY_SNAPSHOT;
  }

  return {
    velocityA: a.velocity,
    velocityB: b.velocity,
    momentumA: { x: momentum1D(a.mass, a.velocity.x), y: momentum1D(a.mass, a.velocity.y) },
    momentumB: { x: momentum1D(b.mass, b.velocity.x), y: momentum1D(b.mass, b.velocity.y) },
    energyA: kineticEnergy2D(a.mass, a.velocity),
    energyB: kineticEnergy2D(b.mass, b.velocity),
    collisionCount
  };
}

function separateObjects(a: SimObject, b: SimObject, combinedRadius: number, distance: number) {
  const safeDistance = distance || 1;
  const overlap = combinedRadius - safeDistance + 0.02;
  const normal = {
    x: (b.position.x - a.position.x) / safeDistance,
    y: (b.position.y - a.position.y) / safeDistance
  };
  if (a.isStatic && b.isStatic) {
    return;
  }
  if (a.isStatic) {
    b.position.x += normal.x * overlap;
    b.position.y += normal.y * overlap;
    return;
  }
  if (b.isStatic) {
    a.position.x -= normal.x * overlap;
    a.position.y -= normal.y * overlap;
    return;
  }
  a.position.x -= normal.x * overlap * 0.5;
  a.position.y -= normal.y * overlap * 0.5;
  b.position.x += normal.x * overlap * 0.5;
  b.position.y += normal.y * overlap * 0.5;
}

function separate1DObjects(a: SimObject, b: SimObject, combinedRadius: number, gap: number) {
  const overlap = combinedRadius - gap + 0.01;
  const normal = b.position.x >= a.position.x ? 1 : -1;
  if (a.isStatic && b.isStatic) {
    return;
  }
  if (a.isStatic) {
    b.position.x += normal * overlap;
    return;
  }
  if (b.isStatic) {
    a.position.x -= normal * overlap;
    return;
  }
  a.position.x -= normal * overlap * 0.5;
  b.position.x += normal * overlap * 0.5;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ObjectControl({
  object,
  color,
  mode,
  sharedAvatarAsset,
  isCollapsed,
  canRemove,
  onToggle,
  onChange,
  onRemove
}: {
  object: ObjectSettings;
  color: string;
  mode: Mode;
  sharedAvatarAsset: ObjectShapeAsset | null;
  isCollapsed: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onChange: (object: ObjectSettings) => void;
  onRemove: () => void;
}) {
  const isStatic = object.isStatic;
  const displayedSpeed = isStatic ? 0 : mode === "1d" ? object.speed : Math.abs(object.speed);
  const summarySpeed = isStatic ? 0 : mode === "1d" ? object.speed : Math.abs(object.speed);
  const fallbackName = `Object ${object.id}`;
  function handleShapeFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    const mimeType = getShapeAssetMimeType(file);
    if (!mimeType) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({
          ...object,
          shapeAsset: {
            dataUrl: reader.result,
            name: file.name,
            mimeType
          }
        });
      }
    };
    reader.readAsDataURL(file);
  }

  const editorControls = (
    <>
      <RangeField
        label="Mass"
        value={object.mass}
        min={0.5}
        max={10}
        step={0.5}
        unit="kg"
        onChange={(mass) => onChange({ ...object, mass })}
      />
      <RangeField
        label={mode === "1d" ? "Signed speed" : "Speed"}
        value={displayedSpeed}
        min={mode === "1d" ? -6 : 0}
        max={6}
        step={0.1}
        unit="m/s"
        disabled={isStatic}
        action={
          <Field orientation="horizontal" className="w-auto gap-1.5">
            <Checkbox
              id={`${object.id}-static`}
              checked={isStatic}
              onCheckedChange={(checked) =>
                onChange({ ...object, isStatic: checked, speed: checked ? 0 : object.speed })
              }
            />
            <FieldLabel htmlFor={`${object.id}-static`} className="text-xs font-black">Static</FieldLabel>
          </Field>
        }
        onChange={(speed) => onChange({ ...object, speed: mode === "1d" ? speed : Math.abs(speed) })}
      />
      {mode !== "1d" ? (
        <RangeField
          label="Angle"
          value={object.angle}
          min={0}
          max={360}
          step={5}
          unit="deg"
          disabled={isStatic}
          onChange={(angle) => onChange({ ...object, angle })}
        />
      ) : null}
      <SelectField
        label="Material"
        value={object.material}
        onChange={(material) => onChange({ ...object, material: material as Material })}
      />
      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Shape</FieldLabel>
          <div className="flex items-center gap-1.5">
            {sharedAvatarAsset ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...object, shapeAsset: cloneShapeAsset(sharedAvatarAsset) })}
              >
                <Sparkles data-icon="inline-start" />
                Use avatar
              </Button>
            ) : null}
            <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
              <Upload data-icon="inline-start" />
              Upload
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/gif"
                onChange={handleShapeFileChange}
              />
            </label>
          </div>
        </div>
        {object.shapeAsset ? (
          <div className="flex items-center gap-2 rounded-lg border border-input p-2">
            <img
              src={object.shapeAsset.dataUrl}
              alt=""
              className="size-10 shrink-0 rounded-md bg-muted object-contain"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{object.shapeAsset.name}</div>
              <Badge variant="secondary">{object.shapeAsset.mimeType === "image/gif" ? "GIF" : "PNG"}</Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${object.name || fallbackName} shape`}
              title="Remove shape"
              onClick={() => onChange({ ...object, shapeAsset: undefined })}
            >
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-input p-2 text-sm text-muted-foreground">
            <ImageIcon />
            <span>PNG / GIF</span>
          </div>
        )}
      </Field>
      <p className="text-xs font-semibold text-muted-foreground">{MATERIAL_NOTES[object.material]}</p>
    </>
  );

  return (
    <Card size="sm" className="gap-0 border-2 py-0" style={{ borderColor: color }}>
      <Collapsible open={!isCollapsed} onOpenChange={(open) => {
        if (open === isCollapsed) {
          onToggle();
        }
      }}>
        <CardHeader className="grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 p-3">
          <CollapsibleTrigger
            type="button"
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${object.name || fallbackName}`}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronDown className={cn("transition-transform", isCollapsed && "-rotate-90")} />
          </CollapsibleTrigger>
          <ObjectDot color={color} isStatic={isStatic} />
          <div className="min-w-0">
            <Input
              aria-label={`${fallbackName} name`}
              value={object.name}
              onChange={(event) => onChange({ ...object, name: event.target.value })}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (!object.name.trim()) {
                  onChange({ ...object, name: fallbackName });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="border-transparent px-1 text-base font-black shadow-none focus-visible:bg-accent"
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{object.mass.toFixed(1)} kg</Badge>
              <Badge variant="secondary">{summarySpeed.toFixed(1)} m/s</Badge>
              {isStatic ? <Badge variant="outline">Static</Badge> : null}
              {object.shapeAsset ? <Badge variant="outline">{object.shapeAsset.mimeType === "image/gif" ? "GIF" : "PNG"}</Badge> : null}
              {mode !== "1d" ? <Badge variant="secondary">{object.angle.toFixed(0)} deg</Badge> : null}
              <Badge variant="secondary">{MATERIAL_LABELS[object.material]}</Badge>
            </div>
          </div>
          {canRemove ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${object.name || fallbackName}`} title={`Remove ${object.name || fallbackName}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          ) : null}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 p-3 pt-0">
            {editorControls}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function cloneShapeAsset(asset: ObjectShapeAsset): ObjectShapeAsset {
  return {
    ...asset,
    spriteSheet: asset.spriteSheet ? { ...asset.spriteSheet } : undefined
  };
}

function useLiveSpriteSheetAsset() {
  const [asset, setAsset] = useState<(ObjectShapeAsset & { version: string }) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkForPreviewUpdate() {
      try {
        const response = await fetch(LIVE_SPRITE_SHEET_PREVIEW_PATH, { method: "HEAD", cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("image/")) {
          if (!cancelled) {
            setAsset(null);
          }
          return;
        }

        const version = [
          response.headers.get("etag"),
          response.headers.get("last-modified"),
          response.headers.get("content-length")
        ].filter(Boolean).join(":") || "current";
        const cacheKey = encodeURIComponent(version);
        if (!cancelled) {
          setAsset((current) => current?.version === version
            ? current
            : {
                dataUrl: `${LIVE_SPRITE_SHEET_PATH}?v=${cacheKey}`,
                previewUrl: `${LIVE_SPRITE_SHEET_PREVIEW_PATH}?v=${cacheKey}`,
                name: "Live ImageGen avatar sprite sheet",
                mimeType: "image/png",
                version
              });
        }
      } catch {
        if (!cancelled) {
          setAsset(null);
        }
      }
    }

    void checkForPreviewUpdate();
    const intervalId = window.setInterval(checkForPreviewUpdate, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return asset;
}

function getSpriteSheetPreviewStyle(asset: ObjectShapeAsset | null): CSSProperties | undefined {
  if (!asset?.spriteSheet) {
    return {
      aspectRatio: FIXED_AVATAR_SHEET_ASPECT_RATIO
    };
  }
  const frameWidth = asset.spriteSheet.frameWidth ?? asset.spriteSheet.frameSize ?? 1;
  const frameHeight = asset.spriteSheet.frameHeight ?? asset.spriteSheet.frameSize ?? 1;
  return {
    aspectRatio: `${asset.spriteSheet.columns * frameWidth} / ${asset.spriteSheet.rows * frameHeight}`
  };
}

function formatSpriteEmotionLabel(emotion: SpriteEmotion) {
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

function formatStickerLabel(sticker: string) {
  return sticker.charAt(0).toUpperCase() + sticker.slice(1);
}

function getShapeAssetMimeType(file: File): ObjectShapeAsset["mimeType"] | null {
  if (file.type === "image/png" || file.type === "image/gif") {
    return file.type;
  }

  const normalizedName = file.name.toLowerCase();
  if (normalizedName.endsWith(".png")) {
    return "image/png";
  }
  if (normalizedName.endsWith(".gif")) {
    return "image/gif";
  }
  return null;
}

function SegmentToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="justify-between rounded-lg border border-input p-2">
      <FieldTitle>{label}</FieldTitle>
      <ToggleGroup
        aria-label={label}
        value={[checked ? "on" : "off"]}
        onValueChange={(value) => {
          const nextValue = Array.isArray(value) ? value[value.length - 1] : value;
          if (nextValue) {
            onChange(nextValue === "on");
          }
        }}
        spacing={0}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="on">On</ToggleGroupItem>
        <ToggleGroupItem value="off">Off</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled = false,
  action,
  ticks,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  action?: ReactNode;
  ticks?: string[];
  onChange: (value: number) => void;
}) {
  const formattedValue = `${value.toFixed(step < 1 ? 1 : 0)} ${unit}`;

  return (
    <Field data-disabled={disabled}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FieldLabel>{label}</FieldLabel>
          {action}
        </div>
        <span className="text-sm font-black">{formattedValue}</span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => onChange(Array.isArray(nextValue) ? nextValue[0] : nextValue)}
      />
      {ticks ? (
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      ) : null}
    </Field>
  );
}

function SelectField({
  label,
  value,
  onChange
}: {
  label: string;
  value: Material;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(String(nextValue));
        }
      }}>
        <SelectTrigger className="w-full">
          <SelectValue>{MATERIAL_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
          {MATERIALS.map((material) => (
            <SelectItem key={material} value={material}>
              {MATERIAL_LABELS[material]}
            </SelectItem>
          ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function Readout({
  title,
  value,
  detail,
  info
}: {
  title: string;
  value: string;
  detail: string;
  info?: string;
}) {
  return (
    <Card size="sm" className="min-w-42 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{title}</span>
          {info ? (
            <Tooltip>
              <TooltipTrigger className={buttonVariants({ variant: "ghost", size: "icon-xs" })} aria-label={`${title} explanation`}>
                <Info />
              </TooltipTrigger>
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <strong className="block text-xl leading-none">{value}</strong>
        <small className="mt-1 block text-xs font-medium text-muted-foreground">{detail}</small>
      </CardContent>
    </Card>
  );
}

function ObjectDot({ color, isStatic }: { color: string; isStatic: boolean }) {
  return (
    <span className="relative inline-flex size-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }}>
      {isStatic ? (
        <span className="absolute -left-1 -right-1 top-1/2 h-0.5 -translate-y-1/2 rotate-45 rounded-full bg-background shadow-sm" />
      ) : null}
    </span>
  );
}

function formatVelocity(velocity: Vector, mode: Mode) {
  if (mode === "1d") {
    return `${velocity.x.toFixed(2)} m/s`;
  }
  return `${vectorSpeed(velocity).toFixed(2)} m/s`;
}

function formatMomentum(momentum: Vector, mode: Mode) {
  if (mode === "1d") {
    return `${momentum.x.toFixed(1)}`;
  }
  return `${Math.hypot(momentum.x, momentum.y).toFixed(1)}`;
}
