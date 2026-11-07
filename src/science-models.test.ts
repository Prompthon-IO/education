import { describe, expect, it } from "vitest";
import { atmosphericDensity, circularSpeed, DEFAULT_METEOR, escapeSpeed, METEOR_PRESETS, orbitalElements, outsidePlanet, PLANETS, simulateMeteor } from "./meteor-physics";

describe("2D orbital sandbox", () => {
  const pluto = PLANETS.find((p) => p.id === "pluto")!;
  const preset = (id: string) => METEOR_PRESETS.find((p) => p.id === id)!.config;
  it("matches Earth, Moon and Pluto escape speeds and exponential density", () => {
    expect(escapeSpeed(PLANETS[0]) / 1000).toBeCloseTo(11.186, 1);
    expect(escapeSpeed(PLANETS[3]) / 1000).toBeCloseTo(2.376, 2);
    expect(escapeSpeed(pluto) / 1000).toBeCloseTo(1.21, 2);
    expect(atmosphericDensity(PLANETS[0], 8500, 1, 1)).toBeCloseTo(1.225 / Math.E);
    expect(atmosphericDensity(PLANETS[0], 0, 0, 1)).toBe(0);
    expect(atmosphericDensity(PLANETS[3], 0, 3, 2)).toBe(0);
  });
  it("separates an escaping flyby from an airless surface impact", () => {
    const flyby = simulateMeteor(preset("escape"));
    expect(flyby.outcome).toBe("escaped");
    expect(flyby.closestAltitude).toBeGreaterThan(0);
    const impact = simulateMeteor(preset("impact"));
    expect(impact.outcome).toBe("impact");
    expect(impact.frames.slice(-1)[0].altitude).toBeCloseTo(preset("impact").diameter / 2, 3);
    expect(flyby.initiallyBound).toBe(false);
    expect(flyby.capture).toBeNull();
  });
  it("loses mass in atmosphere, while vacuum conserves orbital energy", () => {
    const burn = simulateMeteor(preset("burn"));
    expect(burn.outcome).toBe("ablated");
    expect(burn.frames.slice(-1)[0].mass / burn.initialMass).toBeLessThanOrEqual(0.005);
    const vacuum = simulateMeteor({ ...preset("escape"), atmosphere: 0 });
    const energy = (frame: typeof vacuum.frames[number]) => frame.speed ** 2 / 2 - pluto.mu / Math.hypot(frame.x, frame.y);
    expect(energy(vacuum.frames.slice(-1)[0]) / energy(vacuum.frames[0])).toBeCloseTo(1, 4);
  });
  it("observes two circular revolutions without calling an initial orbit a capture", () => {
    const config = { ...DEFAULT_METEOR, speed: circularSpeed(pluto, 3 * pluto.radius) / 1000, atmosphere: 0 };
    const run = simulateMeteor(config);
    expect(run.outcome).toBe("satellite");
    expect(run.revolutions).toBeGreaterThanOrEqual(2);
    expect(run.initiallyBound).toBe(true);
    expect(run.capture).toBeNull();
    expect(run.finalOrbit.energy / run.initialOrbit.energy).toBeCloseTo(1, 5);
    expect(run.finalOrbit.periapsis / pluto.radius).toBeCloseTo(3, 3);
    expect(run.frames.slice(-1)[0].t / run.initialOrbit.period!).toBeCloseTo(2, 2);
  });
  it("captures the same unbound flyby only when the labeled brake removes energy", () => {
    const run = simulateMeteor(preset("capture"));
    expect(run.initiallyBound).toBe(false);
    expect(run.initialOrbit.energy).toBeGreaterThan(0);
    expect(run.capture?.source).toBe("brake");
    expect(run.brakeEvent).not.toBeNull();
    expect(run.finalOrbit.energy).toBeLessThan(0);
    expect(run.outcome).toBe("satellite");
    expect(run.finalOrbit.periapsis).toBeGreaterThan(pluto.radius);
  });
  it("separates a bound collision course and excessive braking from satellite orbits", () => {
    const fall = simulateMeteor({ ...DEFAULT_METEOR, speed: .1, angle: 0 });
    expect(fall.initiallyBound).toBe(true);
    expect(fall.outcome).toBe("impact");
    const overBrake = simulateMeteor({ ...preset("capture"), captureBrake: .8 });
    expect(overBrake.capture?.source).toBe("brake");
    expect(overBrake.outcome).toBe("impact");
  });
  it("uses player position and direction, and keeps size from faking vacuum capture", () => {
    const config = { ...preset("escape"), atmosphere: 0 };
    const small = simulateMeteor({ ...config, diameter: 1 });
    const large = simulateMeteor({ ...config, diameter: 1000 });
    expect(small.frames[0].x).toBe(config.startX * pluto.radius);
    expect(small.frames[0].vx).toBe(config.speed * 1000);
    expect(small.frames[0].vy).toBe(0);
    expect(large.outcome).toBe(small.outcome);
    expect(large.frames.slice(-1)[0].x).toBe(small.frames.slice(-1)[0].x);
    expect(large.frames.slice(-1)[0].mass).toBe(large.initialMass);
    const orbit = orbitalElements(pluto, -3 * pluto.radius, 0, 0, circularSpeed(pluto, 3 * pluto.radius));
    expect(orbit.eccentricity).toBeCloseTo(0);
  });
  it("does not call an atmospheric orbit stable or an unobserved wide ellipse verified", () => {
    const earth = PLANETS[0], radius = earth.radius + 150_000;
    const atmospheric = simulateMeteor({ ...DEFAULT_METEOR, planet: "earth", startX: -radius / earth.radius, startY: 0, speed: circularSpeed(earth, radius) / 1000, diameter: 10_000, drag: .2 });
    expect(atmospheric.outcome).toBe("decaying");
    const wide = simulateMeteor({ ...DEFAULT_METEOR, speed: escapeSpeed(pluto, 2 * pluto.radius) / 1000 * .999, atmosphere: 0 });
    expect(wide.outcome).toBe("bound");
    expect(wide.revolutions).toBeLessThan(2);
    expect(wide.capture).toBeNull();
  });
  it("keeps starts outside the planet and extreme states finite and ordered", () => {
    const safe = outsidePlanet({ ...DEFAULT_METEOR, startX: 0, startY: 0 });
    expect(Math.hypot(safe.startX, safe.startY)).toBeGreaterThan(1);
    for (const config of [
      { ...DEFAULT_METEOR, planet: "venus" as const, startX: -1.3, atmosphere: 3, speed: 32, angle: 0, diameter: .1 },
      { ...DEFAULT_METEOR, speed: 0 }, safe,
    ]) {
      const run = simulateMeteor(config);
      expect(run.frames.length).toBeGreaterThan(1);
      run.frames.forEach((f, i) => {
        expect(Object.values(f).every(Number.isFinite)).toBe(true);
        expect(f.mass).toBeGreaterThan(0);
        if (i) expect(f.t).toBeGreaterThan(run.frames[i - 1].t);
      });
    }
  });
});
