import { describe, expect, it } from "vitest";
import { FALL_PRESETS, FALL_SHAPES, fallDuration, fallFrame, shapeDragCoefficient, solveFall, withFallShape } from "./fall-physics";

const ball = FALL_PRESETS[0].b;

describe("falling from rest with quadratic air resistance", () => {
  it("matches the vacuum equations and conserves energy before impact", () => {
    const run = solveFall({ ...ball, airResistance: false });
    const frame = fallFrame(run, 2);
    expect(run.landingTime).toBeCloseTo(Math.sqrt(80 / 9.81), 10);
    expect(frame.height).toBeCloseTo(40 - .5 * 9.81 * 4, 10);
    expect(frame.speed).toBeCloseTo(19.62, 10);
    expect(frame.acceleration).toBe(9.81);
    expect(.5 * ball.mass * frame.speed ** 2 + ball.mass * ball.gravity * frame.height).toBeCloseTo(ball.mass * ball.gravity * ball.height, 9);
  });

  it("makes mass irrelevant in vacuum and weaker gravity take longer", () => {
    const light = solveFall(FALL_PRESETS[2].a), heavy = solveFall(FALL_PRESETS[2].b);
    expect(light.landingTime).toBe(heavy.landingTime);
    expect(fallFrame(light, 1).height).toBe(fallFrame(heavy, 1).height);
    expect(solveFall(FALL_PRESETS[1].b).landingTime!).toBeGreaterThan(light.landingTime!);
  });

  it("starts with no drag and delays landing relative to vacuum", () => {
    const air = solveFall(ball), vacuum = solveFall({ ...ball, airResistance: false });
    expect(fallFrame(air, 0).drag).toBe(0);
    expect(fallFrame(air, 0).acceleration).toBe(ball.gravity);
    expect(air.landingTime!).toBeGreaterThan(vacuum.landingTime!);
    expect(air.impactSpeed).toBeLessThan(vacuum.impactSpeed);
    expect(fallFrame(air, vacuum.landingTime!).height).toBeGreaterThan(0);
  });

  it("satisfies Newton's law and the position/velocity derivatives independently", () => {
    const run = solveFall(ball), dt = .00001, t = 1;
    const before = fallFrame(run, t - dt), frame = fallFrame(run, t), after = fallFrame(run, t + dt);
    expect((before.height - after.height) / (2 * dt)).toBeCloseTo(frame.speed, 6);
    expect((after.speed - before.speed) / (2 * dt)).toBeCloseTo(frame.acceleration, 6);
    expect(frame.drag).toBeCloseTo(.5 * ball.airDensity * ball.dragCoefficient * ball.area * frame.speed ** 2, 10);
    expect(frame.weight - frame.drag).toBeCloseTo(ball.mass * frame.acceleration, 10);
  });

  it("approaches terminal speed with balanced forces, without stopping in midair", () => {
    const run = solveFall({ ...ball, height: 100, mass: .1, area: .8, dragCoefficient: 2 });
    const frame = fallFrame(run, 10);
    expect(frame.landed).toBe(false);
    expect(frame.speed).toBeCloseTo(run.terminalSpeed!, 8);
    expect(frame.speed).toBeGreaterThan(0);
    expect(frame.drag).toBeCloseTo(frame.weight, 8);
    expect(frame.acceleration).toBeCloseTo(0, 8);
  });

  it("has slower terminal speed with greater Cd, area, or air density", () => {
    const base = solveFall(ball);
    for (const patch of [{ dragCoefficient: 1.5 }, { area: .6 }, { airDensity: 2 }]) {
      const run = solveFall({ ...ball, ...patch });
      expect(run.terminalSpeed!).toBeLessThan(base.terminalSpeed!);
      expect(run.landingTime!).toBeGreaterThan(base.landingTime!);
    }
    expect(solveFall({ ...ball, mass: 2 }).terminalSpeed!).toBeGreaterThan(base.terminalSpeed!);
  });

  it("lands at the exact height and retains a separate pre-impact speed", () => {
    const run = solveFall(ball), before = fallFrame(run, run.landingTime! - 1e-7);
    expect(before.height).toBeCloseTo(0, 5);
    expect(before.speed).toBeCloseTo(run.impactSpeed, 5);
    const after = fallFrame(run, run.landingTime! + 10);
    expect(after.landed).toBe(true);
    expect(after.height).toBe(0);
    expect(after.speed).toBe(0);
    expect(after.drag).toBe(0);
    expect(after.support).toBe(after.weight);
    expect(after.acceleration).toBe(0);
  });

  it("handles zero gravity, zero drag, tiny drag, and the extreme slider settings", () => {
    const zero = solveFall({ ...ball, gravity: 0 });
    expect(zero.landingTime).toBeNull();
    expect(fallFrame(zero, 100).height).toBe(ball.height);
    expect(fallFrame(zero, 100).speed).toBe(0);
    expect(fallDuration([zero])).toBe(8);
    const vacuum = solveFall({ ...ball, airResistance: false });
    for (const patch of [{ dragCoefficient: 0 }, { airDensity: 0 }, { area: 0 }]) {
      expect(solveFall({ ...ball, ...patch }).landingTime).toBe(vacuum.landingTime);
    }
    const tiny = solveFall({ ...ball, dragCoefficient: 1e-10 });
    expect(tiny.landingTime).toBeCloseTo(vacuum.landingTime!, 7);
    expect(fallFrame(tiny, 1).height).toBeCloseTo(fallFrame(vacuum, 1).height, 7);
    for (const config of [
      { ...ball, height: 100, gravity: .01, mass: .05, area: 1, airDensity: 2.5, dragCoefficient: 2 },
      { ...ball, height: 1, gravity: 25, mass: 10, area: .005, dragCoefficient: .01 },
    ]) {
      const run = solveFall(config);
      expect(Number.isFinite(run.landingTime)).toBe(true);
      const frame = fallFrame(run, run.landingTime! / 2);
      expect(Object.values(frame).every((v) => typeof v === "boolean" || Number.isFinite(v))).toBe(true);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.speed).toBeLessThanOrEqual(run.terminalSpeed!);
    }
  });

  it("changes shape Cd without changing mass/area or counting drag twice", () => {
    for (const shape of FALL_SHAPES) {
      const config = withFallShape(ball, shape.id);
      expect(config.mass).toBe(ball.mass);
      expect(config.area).toBe(ball.area);
      expect(config.height).toBe(ball.height);
      expect(config.dragCoefficient).toBe(shapeDragCoefficient(shape.id));
      expect(solveFall(config).dragFactor).toBeCloseTo(.5 * ball.airDensity * ball.area * shape.cd, 12);
    }
  });

  it("makes the flat-base-first cone slower using its higher teaching Cd", () => {
    const tip = solveFall(withFallShape(ball, "cone", "tip-first"));
    const base = solveFall(withFallShape(ball, "cone", "base-first"));
    expect(base.config.mass).toBe(tip.config.mass);
    expect(base.config.area).toBe(tip.config.area);
    expect(base.terminalSpeed!).toBeLessThan(tip.terminalSpeed!);
    expect(base.landingTime!).toBeGreaterThan(tip.landingTime!);
    expect(fallFrame(base, 2).height).toBeGreaterThan(fallFrame(tip, 2).height);
  });

  it("makes all shapes equivalent in vacuum and honors custom Cd", () => {
    const vacuum = { ...ball, airResistance: false };
    for (const shape of FALL_SHAPES) {
      expect(solveFall(withFallShape(vacuum, shape.id)).landingTime).toBe(solveFall(vacuum).landingTime);
    }
    const cone = { ...withFallShape(ball, "cone"), dragCoefficient: .2 };
    expect(solveFall(cone).dragFactor).toBeCloseTo(.5 * ball.airDensity * ball.area * .2, 12);
    expect(solveFall(cone).landingTime!).toBeLessThan(solveFall(withFallShape(ball, "cone")).landingTime!);
  });
});
