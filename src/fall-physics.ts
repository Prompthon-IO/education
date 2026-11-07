/** Constant gravity, still air, quadratic drag; released from rest. SI units. */
export type FallShape = "sphere" | "cone" | "cube" | "plate" | "streamlined" | "parachute";
export type ConeOrientation = "tip-first" | "base-first";
export const FALL_SHAPES: { id: FallShape; label: string; cd: number; description: string }[] = [
  { id: "sphere", label: "Sphere", cd: .47, description: "A round body. Real sphere drag changes with flow conditions." },
  { id: "cone", label: "Cone", cd: .5, description: "Flip the same cone to compare a pointed leading end with a flat one." },
  { id: "cube", label: "Cube", cd: 1.05, description: "A flat face meets the air; sharp edges produce a broad wake." },
  { id: "plate", label: "Flat plate", cd: 1.28, description: "A broad face across the airflow gives high drag in this model." },
  { id: "streamlined", label: "Rounded nose", cd: .295, description: "A rounded leading end and longer body use a lower teaching Cd." },
  { id: "parachute", label: "Parachute", cd: 1.5, description: "An already open canopy. Frontal area is set separately." },
];

export type FallConfig = {
  height: number;
  gravity: number;
  mass: number;
  area: number;
  dragCoefficient: number;
  airDensity: number;
  airResistance: boolean;
  shape: FallShape;
  coneOrientation: ConeOrientation;
};

/** Teaching estimates, not a CFD or Reynolds-dependent coefficient model. */
export function shapeDragCoefficient(shape: FallShape, orientation: ConeOrientation = "tip-first"): number {
  return shape === "cone" && orientation === "base-first" ? 1.1 : FALL_SHAPES.find((s) => s.id === shape)!.cd;
}

export function withFallShape(config: FallConfig, shape: FallShape, orientation = config.coneOrientation): FallConfig {
  return { ...config, shape, coneOrientation: orientation, dragCoefficient: shapeDragCoefficient(shape, orientation) };
}

export function fallShapeLabel(config: FallConfig): string {
  const label = FALL_SHAPES.find((s) => s.id === config.shape)!.label;
  return config.shape === "cone" ? `${label} · ${config.coneOrientation === "tip-first" ? "tip down" : "base down"}` : label;
}

export type FallSolution = {
  config: FallConfig;
  dragFactor: number;
  terminalSpeed: number | null;
  landingTime: number | null;
  impactSpeed: number;
};

export type FallFrame = {
  time: number;
  height: number;
  distance: number;
  speed: number;
  acceleration: number;
  weight: number;
  drag: number;
  support: number;
  landed: boolean;
};

const BALL: FallConfig = { height: 40, gravity: 9.81, mass: .2, area: .08, dragCoefficient: .47, airDensity: 1.225, airResistance: true, shape: "sphere", coneOrientation: "tip-first" };
export const FALL_PRESETS: { id: string; label: string; question: string; a: FallConfig; b: FallConfig; advanced?: boolean }[] = [
  { id: "air", label: "Air vs vacuum", question: "Same ball, same height. Can air change which one lands first?", a: { ...BALL, airResistance: false }, b: { ...BALL } },
  { id: "gravity", label: "Earth vs Moon", question: "Both sides are in vacuum. What changes when gravity is weaker?", a: { ...BALL, airResistance: false }, b: { ...BALL, gravity: 1.62, airResistance: false } },
  { id: "mass", label: "Light vs heavy", question: "Ten times the mass, but no air. Will the heavy ball land first?", a: { ...BALL, airResistance: false }, b: { ...BALL, mass: 2, airResistance: false } },
  { id: "parachute", label: "Ball vs parachute", question: "Same mass, different area and drag coefficient. How does a parachute help?", a: { ...BALL }, b: { ...BALL, shape: "parachute", area: .6, dragCoefficient: 1.5 } },
  { id: "shapes", label: "Sphere vs cone", question: "Same mass and frontal area. A point is not a promise of less drag: compare their Cd values.", a: { ...BALL }, b: withFallShape(BALL, "cone"), advanced: true },
  { id: "flip-cone", label: "Flip the cone", question: "Same cone, same mass, same area. What changes when its flat base faces downward?", a: withFallShape(BALL, "cone", "tip-first"), b: withFallShape(BALL, "cone", "base-first"), advanced: true },
];

export function solveFall(config: FallConfig): FallSolution {
  const dragFactor = config.airResistance ? .5 * config.airDensity * config.dragCoefficient * config.area : 0;
  if (config.gravity === 0) return { config, dragFactor, terminalSpeed: dragFactor > 0 ? 0 : null, landingTime: null, impactSpeed: 0 };
  if (dragFactor === 0) return { config, dragFactor, terminalSpeed: null, landingTime: Math.sqrt(2 * config.height / config.gravity), impactSpeed: Math.sqrt(2 * config.gravity * config.height) };
  const terminalSpeed = Math.sqrt(config.mass * config.gravity / dragFactor);
  const x = dragFactor * config.height / config.mass;
  // acosh(exp(x)), without overflow or cancellation for large/small x.
  const landingTime = (x + Math.log1p(Math.sqrt(-Math.expm1(-2 * x)))) * terminalSpeed / config.gravity;
  const impactSpeed = terminalSpeed * Math.sqrt(-Math.expm1(-2 * x));
  return { config, dragFactor, terminalSpeed, landingTime, impactSpeed };
}

export function fallFrame(solution: FallSolution, time: number): FallFrame {
  const { config, dragFactor, terminalSpeed, landingTime } = solution;
  const t = Math.max(0, time), weight = config.mass * config.gravity;
  const landed = landingTime !== null && t >= landingTime;
  if (landed) return { time: t, height: 0, distance: config.height, speed: 0, acceleration: 0, weight, drag: 0, support: weight, landed: true };
  if (config.gravity === 0) return { time: t, height: config.height, distance: 0, speed: 0, acceleration: 0, weight: 0, drag: 0, support: 0, landed: false };
  let distance: number, speed: number;
  if (dragFactor === 0 || terminalSpeed === null) {
    distance = .5 * config.gravity * t * t;
    speed = config.gravity * t;
  } else {
    const u = config.gravity * t / terminalSpeed;
    const logCosh = u < 20 ? Math.log1p(2 * Math.sinh(u / 2) ** 2) : u + Math.log1p(Math.exp(-2 * u)) - Math.LN2;
    distance = config.mass / dragFactor * logCosh;
    speed = terminalSpeed * Math.tanh(u);
  }
  const drag = dragFactor * speed * speed;
  return { time: t, height: Math.max(0, config.height - distance), distance, speed, acceleration: Math.max(0, (weight - drag) / config.mass), weight, drag, support: 0, landed: false };
}

export function fallDuration(solutions: FallSolution[]): number {
  return Math.max(1, ...solutions.map((s) => s.landingTime === null ? 8 : s.landingTime + .5));
}

export function fallMedium(solution: FallSolution): string {
  if (!solution.config.airResistance || solution.config.airDensity === 0) return "Vacuum";
  return solution.dragFactor === 0 ? "Air · zero drag" : "With air";
}
