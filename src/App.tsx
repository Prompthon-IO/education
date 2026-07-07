import {
  ChevronDown,
  CircleDot,
  Info,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  type Material,
  type Vector,
  MATERIALS,
  clamp,
  collide1D,
  collide2D,
  kineticEnergy,
  kineticEnergy2D,
  materialRestitution,
  momentum1D,
  playbackDeltaSeconds,
  radiusFromMass,
  speedToVector,
  vectorAngleDegrees,
  vectorSpeed,
  wallBounce
} from "./physics";
import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

type Mode = "1d" | "2d";

type ObjectSettings = {
  id: string;
  name: string;
  color: string;
  mass: number;
  speed: number;
  angle: number;
  material: Material;
  position?: Vector;
};

type SimObject = {
  id: string;
  name: string;
  color: string;
  mass: number;
  material: Material;
  position: Vector;
  velocity: Vector;
  radius: number;
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

const COLORS = {
  objectA: "#16a0a0",
  objectB: "#f06543",
  ink: "#172026",
  grid: "rgba(23, 32, 38, 0.09)",
  border: "#172026",
  wall: "#f6c85f"
};

const OBJECT_COLORS = ["#16a0a0", "#f06543", "#3d7cc9", "#6ca36a", "#f6c85f", "#d95f5f"];

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

const INITIAL_OBJECTS: ObjectSettings[] = [
  { id: "A", name: "Object A", color: COLORS.objectA, mass: 2, speed: 2.4, angle: 0, material: "rubber" },
  { id: "B", name: "Object B", color: COLORS.objectB, mass: 2, speed: -1.6, angle: 180, material: "steel" }
];

const INITIAL_SNAPSHOT: Snapshot = {
  velocityA: { x: 2.4, y: 0 },
  velocityB: { x: -1.6, y: 0 },
  momentumA: { x: 4.8, y: 0 },
  momentumB: { x: -3.2, y: 0 },
  energyA: 5.76,
  energyB: 2.56,
  collisionCount: 0
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimObject[]>([]);
  const collidedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const drawStateRef = useRef<DrawState | null>(null);
  const interactionRef = useRef<CanvasInteraction | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const collisionCountRef = useRef(0);
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
  const [collapsedObjectIds, setCollapsedObjectIds] = useState<string[]>([]);
  const [objectSettings, setObjectSettings] = useState<ObjectSettings[]>(INITIAL_OBJECTS);
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL_SNAPSHOT);

  const activeSettings = mode === "1d" ? objectSettings.slice(0, 2) : objectSettings;
  const objectA = objectSettings[0];
  const objectB = objectSettings[1];
  const restitution = materialRestitution(objectA.material, objectB.material);

  function resetSimulation(nextMode = mode) {
    const objects = createInitialObjects(nextMode, objectSettings);
    simRef.current = objects;
    collidedRef.current = false;
    collisionCountRef.current = 0;
    lastTimeRef.current = null;
    setSnapshot(createSnapshot(objects, 0));
    drawScene(objects);
  }

  function stepSimulation(deltaSeconds = 1 / 30) {
    updateSimulation(playbackDeltaSeconds(deltaSeconds, playbackRate));
    drawScene(simRef.current);
    setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
  }

  useEffect(() => {
    resetSimulation(mode);
    setIsPlaying(false);
  }, [mode, objectSettings, worldLength, worldWidth, worldHeight]);

  useEffect(() => {
    drawScene(simRef.current.length ? simRef.current : createInitialObjects(mode, objectSettings));
  }, [zoom, wallsEnabled, wallMaterial, labelsEnabled, mode, worldLength, worldWidth, worldHeight]);

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
      updateSimulation(playbackDeltaSeconds(deltaSeconds, playbackRate));
      drawScene(simRef.current);
      setSnapshot(createSnapshot(simRef.current, collisionCountRef.current));
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

  function updateObjectSetting(id: string, nextObject: ObjectSettings) {
    setObjectSettings((objects) =>
      objects.map((object) => (object.id === id ? nextObject : object))
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
        material: MATERIALS[nextIndex % MATERIALS.length]
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
        object.id === id ? { ...object, angle, speed: mode === "1d" ? object.speed : speed } : object
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
      const resolved = collide1D({
        massA: a.mass,
        massB: b.mass,
        velocityA: a.velocity.x,
        velocityB: b.velocity.x,
        restitution
      });
      a.velocity.x = resolved.velocityA;
      b.velocity.x = resolved.velocityB;
      a.position.x -= combinedRadius - gap + 0.01;
      b.position.x += combinedRadius - gap + 0.01;
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
      const resolved = collide2D({
        objectA: a,
        objectB: b,
        restitution: materialRestitution(a.material, b.material)
      });
      a.velocity = resolved.velocityA;
      b.velocity = resolved.velocityB;
      separateObjects(a, b, combinedRadius, distance);
      collisionCountRef.current += 1;
    }
  }

  function resolveWallCollisions(objects: SimObject[]) {
    const bounds = getWorldBounds();
    for (const object of objects) {
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
      drawObject(ctx, object, origin, scale);
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
    gradient.addColorStop(0, "#f8fbf7");
    gradient.addColorStop(0.48, "#eef7f6");
    gradient.addColorStop(1, "#fff7e8");
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
    ctx.strokeStyle = wallsEnabled ? COLORS.border : "rgba(23, 32, 38, 0.22)";
    ctx.lineWidth = wallsEnabled ? 4 : 2;
    ctx.setLineDash(wallsEnabled ? [] : [10, 9]);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.restore();

    if (mode === "1d") {
      ctx.strokeStyle = "rgba(23, 32, 38, 0.55)";
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
    origin: Vector,
    scale: number
  ) {
    const center = worldToCanvas(object.position, origin, scale);
    const radius = Math.max(12, object.radius * scale);

    ctx.save();
    ctx.shadowColor = "rgba(23, 32, 38, 0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = object.color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 16px Fraunces, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.id, center.x, center.y);

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
    ctx.shadowColor = "rgba(23, 32, 38, 0.12)";
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
    ctx.fillStyle = "rgba(23, 32, 38, 0.62)";
    ctx.font = "700 11px Space Grotesk, sans-serif";
    ctx.fillText(massLabel, labelCenter.x, labelCenter.y + 16);
    ctx.restore();
  }

  return (
    <main className="app-shell">
      <section className="lab-frame">
        <header className="topbar">
          <div>
            <h1>Collision Lab</h1>
            <p>Momentum, energy, and bounce behavior in one live model.</p>
          </div>
          <div className="tabs" aria-label="Simulation dimension">
            <button
              className={mode === "1d" ? "active" : ""}
              onClick={() => setMode("1d")}
              type="button"
            >
              <CircleDot size={17} />
              1D
            </button>
            <button
              className={mode === "2d" ? "active" : ""}
              onClick={() => setMode("2d")}
              type="button"
            >
              <Maximize2 size={17} />
              2D
            </button>
          </div>
        </header>

        <section className="workspace">
          <div className="canvas-panel">
            <div className="canvas-toolbar">
              <div>
                <span className="status-dot" data-playing={isPlaying} />
                {isPlaying ? "Running" : "Paused"}
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  title={isPlaying ? "Pause" : "Play"}
                  onClick={() => setIsPlaying((value) => !value)}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button type="button" aria-label="Step" title="Step" onClick={() => stepSimulation()}>
                  <SkipForward size={18} />
                </button>
                <button type="button" aria-label="Reset" title="Reset" onClick={() => resetSimulation()}>
                  <RotateCcw size={18} />
                </button>
              </div>
              <label className="playback-field">
                <span>
                  Playback speed
                  <strong>{playbackRate.toFixed(1)}x</strong>
                </span>
                <input
                  aria-label="Playback speed"
                  type="range"
                  min={0.3}
                  max={2}
                  step={0.1}
                  value={playbackRate}
                  onChange={(event) => setPlaybackRate(Number(event.target.value))}
                />
                <div className="playback-ticks" aria-hidden="true">
                  <span>0.3x</span>
                  <span>1x</span>
                  <span>2x</span>
                </div>
              </label>
            </div>
            <section className="world-config-strip" aria-label="World configuration">
              <SegmentToggle label="Labels" checked={labelsEnabled} onChange={setLabelsEnabled} />
              <SegmentToggle label="Walls" checked={wallsEnabled} onChange={setWallsEnabled} />
              <details className="world-details">
                <summary>World</summary>
                <div className="world-details-panel">
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
                      <RangeField
                        label="World width"
                        value={worldWidth}
                        min={8}
                        max={28}
                        step={1}
                        unit="m"
                        onChange={setWorldWidth}
                      />
                      <RangeField
                        label="World height"
                        value={worldHeight}
                        min={5}
                        max={18}
                        step={1}
                        unit="m"
                        onChange={setWorldHeight}
                      />
                    </>
                  )}
                  <div className="zoom-row">
                    <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => clamp(value - 0.15, 0.45, 2.2))}>
                      <ZoomOut size={18} />
                    </button>
                    <span>{zoom.toFixed(2)}x</span>
                    <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => clamp(value + 0.15, 0.45, 2.2))}>
                      <ZoomIn size={18} />
                    </button>
                  </div>
                </div>
              </details>
            </section>
            <canvas
              ref={canvasRef}
              className="collision-canvas"
              aria-label="Collision simulation canvas"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerEnd}
              onPointerCancel={handleCanvasPointerEnd}
            />
          </div>

          <aside className="control-panel" aria-label="Collision settings">
            <PanelSection title="Objects">
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
                <div className="object-array-actions">
                  <button type="button" onClick={addObject} disabled={objectSettings.length >= OBJECT_COLORS.length}>
                    <Plus size={17} />
                    Add object
                  </button>
                  <span>{objectSettings.length}/{OBJECT_COLORS.length}</span>
                </div>
              ) : null}
            </PanelSection>

          </aside>
        </section>

        <section className="readout-grid" aria-label="Simulation readouts">
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
        </section>
      </section>
    </main>
  );
}

function createInitialObjects(mode: Mode, settings: ObjectSettings[]): SimObject[] {
  const activeSettings = mode === "1d" ? settings.slice(0, 2) : settings;

  return activeSettings.map((object, index) => ({
    id: object.id,
    name: object.name,
    color: object.color,
    mass: object.mass,
    material: object.material,
    position: object.position ?? getInitialPosition(mode, index, activeSettings.length),
    velocity: mode === "1d"
      ? { x: object.speed, y: 0 }
      : speedToVector(Math.abs(object.speed), object.angle),
    radius: radiusFromMass(object.mass) / 80
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
    return INITIAL_SNAPSHOT;
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
  a.position.x -= normal.x * overlap * 0.5;
  a.position.y -= normal.y * overlap * 0.5;
  b.position.x += normal.x * overlap * 0.5;
  b.position.y += normal.y * overlap * 0.5;
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
  const [isQuickTuneOpen, setIsQuickTuneOpen] = useState(false);
  const displayedSpeed = mode === "1d" ? object.speed : Math.abs(object.speed);
  const summarySpeed = mode === "1d" ? object.speed : Math.abs(object.speed);
  const fallbackName = `Object ${object.id}`;
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
          onChange={(angle) => onChange({ ...object, angle })}
        />
      ) : null}
      <SelectField
        label="Material"
        value={object.material}
        onChange={(material) => onChange({ ...object, material: material as Material })}
      />
      <p className="material-note">{MATERIAL_NOTES[object.material]}</p>
    </>
  );

  return (
    <div
      className="object-control"
      data-collapsed={isCollapsed}
      onMouseEnter={() => setIsQuickTuneOpen(true)}
      onMouseLeave={() => setIsQuickTuneOpen(false)}
      onFocus={() => setIsQuickTuneOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsQuickTuneOpen(false);
        }
      }}
      style={{ borderColor: color }}
    >
      <div className="object-heading">
        <button
          className="object-collapse-button"
          type="button"
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${object.name || fallbackName}`}
          aria-expanded={!isCollapsed}
          onClick={onToggle}
        >
          <ChevronDown className="object-chevron" size={16} />
        </button>
        <span className="object-swatch" style={{ backgroundColor: color }} />
        <input
          className="object-name-input"
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
        />
        <span className="object-summary">
          <span>{object.mass.toFixed(1)} kg</span>
          <span>{summarySpeed.toFixed(1)} m/s</span>
          {mode === "2d" ? <span>{object.angle.toFixed(0)} deg</span> : null}
          <span>{MATERIAL_LABELS[object.material]}</span>
        </span>
        {canRemove ? (
          <button type="button" aria-label={`Remove ${object.name || fallbackName}`} title={`Remove ${object.name || fallbackName}`} onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {isCollapsed ? (
        <div className="quick-tune" data-open={isQuickTuneOpen} aria-label={`${object.name || fallbackName} quick tune`}>
          {editorControls}
        </div>
      ) : (
        <div className="object-editor">{editorControls}</div>
      )}
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
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
    <div className="segment-toggle" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        <button
          type="button"
          aria-pressed={checked}
          data-active={checked}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          aria-pressed={!checked}
          data-active={!checked}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <strong>
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
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
    <label className="select-field">
      <span>{label}</span>
      <div>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {MATERIALS.map((material) => (
            <option key={material} value={material}>
              {MATERIAL_LABELS[material]}
            </option>
          ))}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <article className="readout">
      <span className="readout-title">
        {title}
        {info ? (
          <button
            type="button"
            aria-label={`${title} explanation`}
            onClick={() => setIsInfoOpen((value) => !value)}
            onMouseEnter={() => setIsInfoOpen(true)}
            onMouseLeave={() => setIsInfoOpen(false)}
            onFocus={() => setIsInfoOpen(true)}
            onBlur={() => setIsInfoOpen(false)}
          >
            <Info size={14} />
            <span role="tooltip" data-open={isInfoOpen}>{info}</span>
          </button>
        ) : null}
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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
