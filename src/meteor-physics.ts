/** SI units. 2D central gravity, single-body drag/ablation, and an optional
 * explicitly artificial periapsis brake. Planet constants: NASA NSSDCA.
 */
export type PlanetId = "earth" | "mars" | "venus" | "moon" | "pluto";
export type Planet = { id: PlanetId; name: string; radius: number; mu: number; density: number; scaleHeight: number; composition: string; color: string };
export const PLANETS: Planet[] = [
  { id: "earth", name: "Earth", radius: 6_371_000, mu: 3.986004418e14, density: 1.225, scaleHeight: 8500, composition: "78% N₂ · 21% O₂ · 1% other", color: "#429adc" },
  { id: "mars", name: "Mars", radius: 3_389_500, mu: 4.2828e13, density: .016, scaleHeight: 11_000, composition: "95.1% CO₂ · 2.6% N₂ · 1.9% Ar", color: "#dc835d" },
  { id: "venus", name: "Venus", radius: 6_051_800, mu: 3.24859e14, density: 65, scaleHeight: 15_900, composition: "96.5% CO₂ · 3.5% N₂", color: "#e4bb78" },
  { id: "moon", name: "Moon", radius: 1_737_400, mu: 4.9048695e12, density: 0, scaleHeight: 0, composition: "Negligible atmosphere", color: "#b4b7c3" },
  { id: "pluto", name: "Pluto", radius: 1_188_000, mu: 8.70e11, density: .00012, scaleHeight: 18_000, composition: "Thin N₂ atmosphere · illustrative density profile", color: "#c5a48a" },
];
export const METEOR_MATERIALS = {
  stone: { name: "Stony", density: 3300, heat: 6e6 },
  iron: { name: "Iron", density: 7800, heat: 8e6 },
  ice: { name: "Icy", density: 900, heat: 2.8e6 },
};
export type MeteorConfig = {
  planet: PlanetId;
  /** Coordinates in planet radii; direction counterclockwise from +x. */
  startX: number; startY: number; angle: number; speed: number;
  diameter: number; material: keyof typeof METEOR_MATERIALS;
  atmosphere: number; thickness: number; drag: number;
  /** Fraction of speed removed once at the first inbound-to-outbound apsis. */
  captureBrake: number;
};
export const DEFAULT_METEOR: MeteorConfig = {
  planet: "pluto", startX: -3, startY: 0, speed: .49, angle: 90,
  diameter: 100, material: "stone", atmosphere: 1, thickness: 1, drag: 1, captureBrake: 0,
};
export const HEAT_TRANSFER = .1;
export type MeteorFrame = {
  t: number; x: number; y: number; vx: number; vy: number; mass: number;
  altitude: number; speed: number; density: number; dynamicPressure: number; heat: number;
};
export type MeteorOutcome = "impact" | "ablated" | "escaped" | "satellite" | "decaying" | "bound" | "timeout";
export type OrbitalElements = {
  energy: number; angularMomentum: number; eccentricity: number;
  periapsis: number; apoapsis: number | null; period: number | null;
};
export type CaptureEvent = { t: number; x: number; y: number; source: "brake" | "atmosphere" };
export type MeteorRun = {
  frames: MeteorFrame[]; outcome: MeteorOutcome; initialMass: number;
  closestAltitude: number; peakPressure: number; revolutions: number;
  initiallyBound: boolean; capture: CaptureEvent | null; brakeEvent: CaptureEvent | null;
  initialOrbit: OrbitalElements; finalOrbit: OrbitalElements;
};
export function escapeSpeed(p: Planet, altitude = 0) { return Math.sqrt(2 * p.mu / Math.max(p.radius * .01, p.radius + altitude)); }
export function circularSpeed(p: Planet, radius: number) { return Math.sqrt(p.mu / radius); }
export function atmosphericDensity(p: Planet, altitude: number, fraction: number, thickness: number) {
  if (p.density === 0 || fraction <= 0 || thickness <= 0) return 0;
  return p.density * fraction * Math.exp(-Math.max(0, altitude) / (p.scaleHeight * thickness));
}
export function orbitalElements(p: Planet, x: number, y: number, vx: number, vy: number): OrbitalElements {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy, energy = v2 / 2 - p.mu / r;
  const angularMomentum = x * vy - y * vx, dot = x * vx + y * vy;
  const ex = ((v2 - p.mu / r) * x - dot * vx) / p.mu;
  const ey = ((v2 - p.mu / r) * y - dot * vy) / p.mu;
  const eccentricity = Math.hypot(ex, ey);
  const periapsis = angularMomentum ** 2 / p.mu / (1 + eccentricity);
  const a = energy < 0 ? -p.mu / (2 * energy) : null;
  return { energy, angularMomentum, eccentricity, periapsis, apoapsis: a === null ? null : a * (1 + eccentricity), period: a === null ? null : 2 * Math.PI * Math.sqrt(a ** 3 / p.mu) };
}
export function outsidePlanet(config: MeteorConfig): MeteorConfig {
  const p = PLANETS.find((item) => item.id === config.planet)!;
  const minimum = 1 + config.diameter / (2 * p.radius) + .015;
  const r = Math.hypot(config.startX, config.startY);
  return r >= minimum ? config : { ...config, startX: r > 1e-9 ? config.startX / r * minimum : -minimum, startY: r > 1e-9 ? config.startY / r * minimum : 0 };
}
export const METEOR_PRESETS: { id: string; name: string; description: string; config: MeteorConfig }[] = [
  { id: "escape", name: "Escape", description: "Unbound Pluto flyby; no energy-removal assist.", config: { ...DEFAULT_METEOR, startX: -4, startY: 2.5, speed: .75, angle: 0 } },
  { id: "impact", name: "Impact", description: "A collision course with Pluto.", config: { ...DEFAULT_METEOR, startX: -4, startY: .45, speed: .75, angle: 0 } },
  { id: "satellite", name: "Satellite orbit", description: "Starts in an already-bound orbit; this is not a new capture.", config: DEFAULT_METEOR },
  { id: "capture", name: "Capture assist", description: "The escape setup with a labeled artificial 30% periapsis brake.", config: { ...DEFAULT_METEOR, startX: -4, startY: 2.5, speed: .75, angle: 0, captureBrake: .3 } },
  { id: "burn", name: "Atmospheric burn", description: "A small fast body entering Earth's atmosphere.", config: { ...DEFAULT_METEOR, planet: "earth", startX: -1.3, startY: 0, speed: 32, angle: 25, diameter: .1 } },
];
export function simulateMeteor(input: MeteorConfig): MeteorRun {
  const config = outsidePlanet(input), p = PLANETS.find((item) => item.id === config.planet)!;
  const material = METEOR_MATERIALS[config.material];
  const initialMass = material.density * Math.PI / 6 * config.diameter ** 3, contactRadius = p.radius + config.diameter / 2;
  const direction = config.angle * Math.PI / 180;
  let x = config.startX * p.radius, y = config.startY * p.radius;
  let vx = config.speed * 1000 * Math.cos(direction), vy = config.speed * 1000 * Math.sin(direction), mass = initialMass, t = 0;
  const initialOrbit = orbitalElements(p, x, y, vx, vy), initiallyBound = initialOrbit.energy < 0;
  const dynamicalTime = Math.sqrt(p.radius ** 3 / p.mu), escapeRadius = Math.max(7.5 * p.radius, Math.hypot(x, y) * 1.5);
  let endTime = Math.min(30 * 86400, Math.max(240 * dynamicalTime, Math.min(initialOrbit.period || 0, 10 * 86400) * 2.1));
  let outcome: MeteorOutcome = "timeout", closestAltitude = Math.hypot(x, y) - p.radius, peakPressure = 0;
  let capture: CaptureEvent | null = null, brakeEvent: CaptureEvent | null = null, boundAngle = 0, revolutions = 0;
  const frames: MeteorFrame[] = [];
  const sample = (): MeteorFrame => {
    const altitude = Math.max(0, Math.hypot(x, y) - p.radius), speed = Math.hypot(vx, vy);
    const density = atmosphericDensity(p, altitude, config.atmosphere, config.thickness), radius = Math.cbrt(3 * mass / (4 * Math.PI * material.density));
    return { t, x, y, vx, vy, mass, altitude, speed, density, dynamicPressure: .5 * density * speed ** 2, heat: .5 * HEAT_TRANSFER * density * Math.PI * radius ** 2 * speed ** 3 };
  };
  const record = () => {
    const f = sample();
    if (frames.length && Math.abs(frames[frames.length - 1].t - t) < 1e-10) frames[frames.length - 1] = f;
    else frames.push(f);
  };
  record();
  for (let step = 0; step < 120_000 && t < endTime; step++) {
    const r = Math.hypot(x, y), speed = Math.hypot(vx, vy), radialVelocity = (x * vx + y * vy) / r;
    const rho = atmosphericDensity(p, r - p.radius, config.atmosphere, config.thickness);
    const radius = Math.cbrt(3 * mass / (4 * Math.PI * material.density)), area = Math.PI * radius ** 2;
    const dragRate = .5 * config.drag * rho * area * speed / mass, lossRate = .5 * HEAT_TRANSFER * rho * area * speed ** 3 / material.heat;
    const atmosphereStep = rho > 1e-10 ? .06 * p.scaleHeight * config.thickness / Math.max(1, Math.abs(radialVelocity)) : Infinity;
    const dt = Math.max(.00001, Math.min(120, .004 * Math.sqrt(r ** 3 / p.mu), .008 * r / Math.max(speed, 1), atmosphereStep, .035 / Math.max(dragRate, 1e-12), .02 * mass / Math.max(lossRate, 1e-12), endTime - t));
    const oldX = x, oldY = y, oldT = t, oldVx = vx, oldVy = vy;
    vx += -p.mu * x / r ** 3 * dt / 2; vy += -p.mu * y / r ** 3 * dt / 2;
    const beforeDrag = vx * vx + vy * vy;
    const decay = 1 / (1 + .5 * config.drag * rho * area * Math.sqrt(beforeDrag) / mass * dt);
    vx *= decay; vy *= decay;
    const dragEnergy = Math.max(0, .5 * mass * (beforeDrag - vx * vx - vy * vy));
    const heatEnergy = rho === 0 ? 0 : config.drag > 0 ? dragEnergy * HEAT_TRANSFER / config.drag : lossRate * material.heat * dt;
    mass = Math.max(initialMass * .0001, mass - heatEnergy / material.heat);
    x += vx * dt; y += vy * dt; t += dt;
    const nextR = Math.hypot(x, y);
    vx += -p.mu * x / nextR ** 3 * dt / 2; vy += -p.mu * y / nextR ** 3 * dt / 2;
    let contact = false;
    if (nextR <= contactRadius) {
      const dx = x - oldX, dy = y - oldY, a = dx * dx + dy * dy, b = 2 * (oldX * dx + oldY * dy), c = oldX ** 2 + oldY ** 2 - contactRadius ** 2;
      const f = a ? Math.max(0, Math.min(1, (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a))) : 1;
      x = oldX + dx * f; y = oldY + dy * f; t = oldT + dt * f;
      vx = oldVx + (vx - oldVx) * f; vy = oldVy + (vy - oldVy) * f; contact = true;
    }
    const radialAfter = x * vx + y * vy;
    let event = false;
    if (!contact && !brakeEvent && config.captureBrake > 0 && radialVelocity < 0 && radialAfter >= 0) {
      vx *= 1 - config.captureBrake; vy *= 1 - config.captureBrake;
      brakeEvent = { t, x, y, source: "brake" }; event = true;
      const elements = orbitalElements(p, x, y, vx, vy);
      if (elements.period) endTime = Math.min(30 * 86400, Math.max(endTime, t + Math.min(elements.period * 2.1, 20 * 86400)));
    }
    const orbit = orbitalElements(p, x, y, vx, vy);
    if (!initiallyBound && !capture && (event || dragRate > 1e-10) && orbit.energy < -p.mu / p.radius * 1e-7) {
      capture = { t, x, y, source: event ? "brake" : "atmosphere" }; event = true;
    }
    const deltaAngle = Math.atan2(oldX * y - oldY * x, oldX * x + oldY * y);
    if (orbit.energy < 0) boundAngle += Math.abs(deltaAngle);
    revolutions = boundAngle / (2 * Math.PI);
    const f = sample(); closestAltitude = Math.min(closestAltitude, f.altitude); peakPressure = Math.max(peakPressure, f.dynamicPressure);
    if (contact) outcome = "impact";
    else if (mass / initialMass <= .005) outcome = "ablated";
    else if (orbit.energy >= 0 && Math.hypot(x, y) >= escapeRadius && radialAfter > 0) outcome = "escaped";
    else if (revolutions >= 2 && orbit.energy < 0 && orbit.periapsis > contactRadius) {
      outcome = atmosphericDensity(p, orbit.periapsis - p.radius, config.atmosphere, config.thickness) > 1e-8 ? "decaying" : "satellite";
    }
    if (step % 3 === 0 || event || outcome !== "timeout") record();
    if (outcome !== "timeout") break;
  }
  record();
  const finalOrbit = orbitalElements(p, x, y, vx, vy);
  if (outcome === "timeout" && finalOrbit.energy < 0) outcome = "bound";
  return { frames, outcome, initialMass, closestAltitude, peakPressure, revolutions, initiallyBound, capture, brakeEvent, initialOrbit, finalOrbit };
}
export const OUTCOME_LABELS: Record<MeteorOutcome, string> = {
  impact: "Surface impact", ablated: "Ablated", escaped: "Escaped", satellite: "Satellite orbit",
  decaying: "Decaying orbit", bound: "Bound · unresolved", timeout: "Still in flight",
};
