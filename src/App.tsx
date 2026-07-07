import {
  ChevronDown,
  CircleDot,
  FlaskConical,
  Info,
  ImageIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
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
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import prompthonLogo from "./assets/prompthon-community-light.png";
import prompthonSquareLogo from "./assets/prompthon-square-light.png";
import collisionLabConfigJson from "./data/applications/collision-lab.json";
import { type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

type Mode = "1d" | "2d";

type SpriteEmotion = "happy" | "excited" | "sad" | "dizzy" | "playful" | "sleepy";

type SpriteSheetConfig = {
  columns: 2;
  rows: 6;
  frameSize: number;
};

type ObjectShapeAsset = {
  dataUrl: string;
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

const ASSET_URLS = import.meta.glob("./assets/**/*", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

const APPLICATION_CONFIG = collisionLabConfigJson as ApplicationConfig;
const APPLICATION_CONFIGS = [APPLICATION_CONFIG];
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
const INITIAL_SNAPSHOT = createSnapshot(createInitialObjects("1d", INITIAL_OBJECTS), 0);

const MAX_HISTORY_STATES = 240;
const SPRITE_EMOTION_ROWS: Record<SpriteEmotion, number> = {
  happy: 0,
  excited: 1,
  sad: 2,
  dizzy: 3,
  playful: 4,
  sleepy: 5
};
const SLEEPY_SPEED_THRESHOLD = 0.35;
const IMMINENT_COLLISION_SECONDS = 1.25;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const shapeImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const simRef = useRef<SimObject[]>([]);
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
  const [mode, setMode] = useState<Mode>("1d");
  const [isPlaying, setIsPlaying] = useState(false);
  const [wallsEnabled, setWallsEnabled] = useState(false);
  const [wallMaterial, setWallMaterial] = useState<Material>("steel");
  const [worldLength, setWorldLength] = useState(14);
  const [worldWidth, setWorldWidth] = useState(14);
  const [worldHeight, setWorldHeight] = useState(8);
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
  const [timelineState, setTimelineState] = useState({ frameNumber: 0, canStepBack: false, canStepForward: true });

  const activeSettings = mode === "1d" ? objectSettings.slice(0, 2) : objectSettings;
  const objectA = objectSettings[0];
  const objectB = objectSettings[1];
  const restitution = materialRestitution(objectA.material, objectB.material);

  function resetSimulation(nextMode = mode) {
    const objects = createInitialObjects(nextMode, objectSettings);
    simRef.current = objects;
    collidedRef.current = false;
    collisionCountRef.current = 0;
    historyRef.current = [];
    futureRef.current = [];
    frameNumberRef.current = 0;
    collisionReactionRef.current = {};
    lastTimeRef.current = null;
    syncTimelineState();
    setSnapshot(createSnapshot(objects, 0));
    drawScene(objects);
  }

  function stepSimulation(deltaSeconds = 1 / 30) {
    if (futureRef.current.length > 0) {
      restoreFutureSimulationState();
      return;
    }
    pushSimulationHistory({ clearFuture: true });
    updateSimulation(playbackDeltaSeconds(deltaSeconds, playbackRate));
    frameNumberRef.current += 1;
    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
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
    lastTimeRef.current = null;
    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
    syncTimelineState();
  }

  useEffect(() => {
    resetSimulation(mode);
    setIsPlaying(false);
  }, [mode, objectSettings, worldLength, worldWidth, worldHeight]);

  useEffect(() => {
    drawScene(simRef.current.length ? simRef.current : createInitialObjects(mode, objectSettings));
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
        drawScene(simRef.current.length ? simRef.current : createInitialObjects(mode, objectSettings));
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
      drawScene(simRef.current.length ? simRef.current : createInitialObjects(mode, objectSettings));
      assetFrameRef.current = requestAnimationFrame(tick);
    }

    assetFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (assetFrameRef.current !== null) {
        cancelAnimationFrame(assetFrameRef.current);
        assetFrameRef.current = null;
      }
    };
  }, [activeSettings, isPlaying, mode, objectSettings]);

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
    if ((mode === "1d" && objects.length !== 2) || (mode === "2d" && objects.length < 2)) {
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

    if (wallsEnabled) {
      resolveWallCollisions(objects);
    }

    if (mode === "1d") {
      resolve1DCollision(objects);
    } else {
      resolve2DCollision(objects);
    }
  }

  function captureSimulationState(): SimulationHistoryState {
    return {
      objects: cloneSimObjects(simRef.current),
      collisionCount: collisionCountRef.current,
      collided: collidedRef.current,
      frameNumber: frameNumberRef.current
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
    } else if (mode === "2d") {
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
      const center = worldToCanvas(object.position, state.origin, state.scale);
      const radius = Math.max(12, object.radius * state.scale);
      const arrowEnd = {
        x: center.x + object.velocity.x * 0.6 * state.scale,
        y: center.y + object.velocity.y * 0.6 * state.scale
      };

      if (mode === "2d" && distance(point, arrowEnd) <= 18) {
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
        object.position.x = bounds.left + object.radius;
        object.velocity = wallBounce(object.velocity, "x", restitutionForObject);
      }
      if (object.position.x + object.radius > bounds.right) {
        object.position.x = bounds.right - object.radius;
        object.velocity = wallBounce(object.velocity, "x", restitutionForObject);
      }
      if (mode === "2d" && object.position.y - object.radius < bounds.top) {
        object.position.y = bounds.top + object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
      }
      if (mode === "2d" && object.position.y + object.radius > bounds.bottom) {
        object.position.y = bounds.bottom - object.radius;
        object.velocity = wallBounce(object.velocity, "y", restitutionForObject);
      }
    }
  }

  function getWorldBounds(): WorldBounds {
    const width = mode === "1d" ? worldLength : worldWidth;
    const height = mode === "1d" ? 4 : worldHeight;
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

    const drawableObjects = objects.length ? objects : createInitialObjects(mode, objectSettings);
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
    ctx.strokeStyle = wallsEnabled ? COLORS.border : "rgba(7, 17, 31, 0.22)";
    ctx.lineWidth = wallsEnabled ? 4 : 2;
    ctx.setLineDash(wallsEnabled ? [] : [10, 9]);
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

    if (shapeImage?.complete && shapeImage.naturalWidth > 0) {
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
    const aspectRatio = sourceWidth / sourceHeight || 1;
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
    const row = SPRITE_EMOTION_ROWS[emotion];
    const column = getSpriteFrameColumn(emotion, object.id);
    return {
      x: column * sheet.frameSize,
      y: row * sheet.frameSize,
      width: sheet.frameSize,
      height: sheet.frameSize
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
    const speedLabel = mode === "1d" ? `${speed.toFixed(2)} m/s` : `${Math.abs(speed).toFixed(2)} m/s`;
    const massLabel = `${object.mass.toFixed(1)} kg`;
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
            activeApplicationId={APPLICATION_CONFIG.id}
          />
        )}
        <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background">
          <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
            {isCanvasFullDisplay ? null : (
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 shadow-sm backdrop-blur max-sm:px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <SidebarTrigger aria-label="Toggle application navigation" />
                  <div className="min-w-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="truncate">{APPLICATION_CONFIG.showcaseLabel}</span>
                  </div>
                </div>
                <Badge variant="secondary">{APPLICATION_CONFIG.name}</Badge>
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
            isCanvasFullDisplay ? "max-w-none grid-rows-[minmax(0,1fr)] gap-0" : "grid-rows-[auto_minmax(0,1fr)_auto]"
          )}
        >
          {isCanvasFullDisplay ? null : (
            <header className="flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-stretch">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FlaskConical />
                </span>
                <div className="min-w-0">
                  <h1 className="text-3xl font-extrabold leading-none tracking-normal max-sm:text-2xl">{APPLICATION_CONFIG.name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{APPLICATION_CONFIG.subtitle}</p>
                </div>
              </div>
              <ToggleGroup
                aria-label="Simulation dimension"
                value={[mode]}
                onValueChange={(values) => {
                  const nextMode = values[0] as Mode | undefined;
                  if (nextMode) {
                    setMode(nextMode);
                  }
                }}
                spacing={0}
                variant="outline"
                className="w-fit bg-card p-1 shadow-sm max-sm:w-full"
              >
                <ToggleGroupItem value="1d" className="max-sm:flex-1">
                  <CircleDot data-icon="inline-start" />
                  1D
                </ToggleGroupItem>
                <ToggleGroupItem value="2d" className="max-sm:flex-1">
                  <Maximize2 data-icon="inline-start" />
                  2D
                </ToggleGroupItem>
              </ToggleGroup>
            </header>
          )}

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
                      onClick={() => setIsPlaying((value) => !value)}
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
                        <SegmentToggle label="Walls" checked={wallsEnabled} onChange={setWallsEnabled} />
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
                      <CardTitle className="text-sm uppercase text-muted-foreground">Objects</CardTitle>
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
                            object={object}
                            color={object.color}
                            mode={mode}
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

function PrimarySidebar({
  applications,
  activeApplicationId
}: {
  applications: ApplicationConfig[];
  activeApplicationId: string;
}) {
  return (
    <Sidebar collapsible="icon" variant="sidebar" aria-label="Primary applications">
      <SidebarHeader className="h-14 justify-center border-b p-0">
        <div className="flex h-full w-full items-center overflow-hidden pl-2 pr-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <img
            className="h-full w-full object-contain object-left group-data-[collapsible=icon]:hidden"
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
        <SidebarGroup>
          <SidebarGroupLabel>Applications</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {applications.map((application) => (
                <SidebarMenuItem key={application.id}>
                  <SidebarMenuButton
                    isActive={application.id === activeApplicationId}
                    tooltip={application.name}
                    aria-label={`Open ${application.name}`}
                  >
                    <FlaskConical />
                    <span>{application.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
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
  isCollapsed,
  canRemove,
  onToggle,
  onChange,
  onRemove
}: {
  object: ObjectSettings;
  color: string;
  mode: Mode;
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
      {mode === "2d" ? (
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
              {mode === "2d" ? <Badge variant="secondary">{object.angle.toFixed(0)} deg</Badge> : null}
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
        onValueChange={(values) => {
          const nextValue = values[0];
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
