export type Material = "rubber" | "steel" | "wood" | "clay" | "glass";

export type Vector = {
  x: number;
  y: number;
};

const MATERIAL_RESTITUTION: Record<string, number> = {
  "clay:clay": 0.15,
  "clay:glass": 0.22,
  "clay:rubber": 0.35,
  "clay:steel": 0.2,
  "clay:wood": 0.25,
  "glass:glass": 0.72,
  "glass:rubber": 0.76,
  "glass:steel": 0.82,
  "glass:wood": 0.58,
  "rubber:rubber": 0.92,
  "rubber:steel": 0.88,
  "rubber:wood": 0.7,
  "steel:steel": 0.95,
  "steel:wood": 0.64,
  "wood:wood": 0.5
};

export const MATERIALS: Material[] = ["rubber", "steel", "wood", "clay", "glass"];

export function materialRestitution(a: Material, b: Material): number {
  const [first, second] = [a, b].sort() as [Material, Material];
  return MATERIAL_RESTITUTION[`${first}:${second}`];
}

export function kineticEnergy(mass: number, velocity: number): number {
  return 0.5 * mass * velocity * velocity;
}

export function kineticEnergy2D(mass: number, velocity: Vector): number {
  return 0.5 * mass * (velocity.x * velocity.x + velocity.y * velocity.y);
}

export function momentum1D(mass: number, velocity: number): number {
  return mass * velocity;
}

export function collide1D({
  massA,
  massB,
  velocityA,
  velocityB,
  restitution
}: {
  massA: number;
  massB: number;
  velocityA: number;
  velocityB: number;
  restitution: number;
}): { velocityA: number; velocityB: number } {
  const totalMass = massA + massB;
  const velocityAAfter =
    ((massA - restitution * massB) * velocityA +
      (1 + restitution) * massB * velocityB) /
    totalMass;
  const velocityBAfter =
    ((massB - restitution * massA) * velocityB +
      (1 + restitution) * massA * velocityA) /
    totalMass;

  return { velocityA: velocityAAfter, velocityB: velocityBAfter };
}

export function collideWithStatic1D(velocity: number, restitution: number): number {
  return -velocity * restitution;
}

export function collide2D({
  objectA,
  objectB,
  restitution
}: {
  objectA: { mass: number; position: Vector; velocity: Vector };
  objectB: { mass: number; position: Vector; velocity: Vector };
  restitution: number;
}): { velocityA: Vector; velocityB: Vector } {
  const normal = normalize({
    x: objectB.position.x - objectA.position.x,
    y: objectB.position.y - objectA.position.y
  });
  const tangent = { x: -normal.y, y: normal.x };

  const normalA = dot(objectA.velocity, normal);
  const normalB = dot(objectB.velocity, normal);
  const tangentA = dot(objectA.velocity, tangent);
  const tangentB = dot(objectB.velocity, tangent);
  const resolved = collide1D({
    massA: objectA.mass,
    massB: objectB.mass,
    velocityA: normalA,
    velocityB: normalB,
    restitution
  });

  return {
    velocityA: add(scale(normal, resolved.velocityA), scale(tangent, tangentA)),
    velocityB: add(scale(normal, resolved.velocityB), scale(tangent, tangentB))
  };
}

export function reflectVelocity(
  velocity: Vector,
  normal: Vector,
  restitution: number
): Vector {
  const unitNormal = normalize(normal);
  const normalSpeed = dot(velocity, unitNormal);
  return {
    x: velocity.x - (1 + restitution) * normalSpeed * unitNormal.x,
    y: velocity.y - (1 + restitution) * normalSpeed * unitNormal.y
  };
}

export function wallBounce(
  velocity: Vector,
  axis: "x" | "y",
  restitution: number
): Vector {
  return axis === "x"
    ? { x: -velocity.x * restitution, y: velocity.y }
    : { x: velocity.x, y: -velocity.y * restitution };
}

export function speedToVector(speed: number, angleDegrees: number): Vector {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: speed * Math.cos(radians), y: speed * Math.sin(radians) };
}

export function vectorSpeed(velocity: Vector): number {
  return Math.hypot(velocity.x, velocity.y);
}

export function vectorAngleDegrees(vector: Vector): number {
  return (Math.atan2(vector.y, vector.x) * 180) / Math.PI + (vector.y < 0 ? 360 : 0);
}

export function radiusFromMass(mass: number): number {
  return clamp(16 + Math.sqrt(mass) * 6, 20, 58);
}

export function playbackDeltaSeconds(deltaSeconds: number, playbackRate: number): number {
  return deltaSeconds * clamp(playbackRate, 0.3, 2);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

function scale(vector: Vector, amount: number): Vector {
  return { x: vector.x * amount, y: vector.y * amount };
}

function add(a: Vector, b: Vector): Vector {
  return { x: a.x + b.x, y: a.y + b.y };
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 1, y: 0 };
  }

  return { x: vector.x / length, y: vector.y / length };
}
