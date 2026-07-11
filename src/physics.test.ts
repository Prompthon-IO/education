import { describe, expect, test } from "vitest";
import {
  collide1D,
  collideWithStatic1D,
  collide2D,
  kineticEnergy,
  materialRestitution,
  momentum1D,
  playbackDeltaSeconds,
  reflectVelocity,
  vectorAngleDegrees,
  wallBounce
} from "./physics";

describe("materialRestitution", () => {
  test("returns the same factor regardless of material order", () => {
    expect(materialRestitution("steel", "rubber")).toBe(
      materialRestitution("rubber", "steel")
    );
  });
});

describe("collide1D", () => {
  test("equal masses with elastic collision swap velocities", () => {
    const result = collide1D({
      massA: 2,
      massB: 2,
      velocityA: 4,
      velocityB: -1,
      restitution: 1
    });

    expect(result.velocityA).toBeCloseTo(-1);
    expect(result.velocityB).toBeCloseTo(4);
  });

  test("low restitution reduces total kinetic energy", () => {
    const beforeEnergy = kineticEnergy(3, 5) + kineticEnergy(2, -2);
    const result = collide1D({
      massA: 3,
      massB: 2,
      velocityA: 5,
      velocityB: -2,
      restitution: 0.25
    });
    const afterEnergy =
      kineticEnergy(3, result.velocityA) + kineticEnergy(2, result.velocityB);

    expect(afterEnergy).toBeLessThan(beforeEnergy);
    expect(momentum1D(3, 5) + momentum1D(2, -2)).toBeCloseTo(
      momentum1D(3, result.velocityA) + momentum1D(2, result.velocityB)
    );
  });

  test("static collision reverses moving velocity by restitution", () => {
    expect(collideWithStatic1D(5, 0.8)).toBeCloseTo(-4);
    expect(collideWithStatic1D(-3, 0.5)).toBeCloseTo(1.5);
  });
});

describe("collide2D", () => {
  test("equal masses exchange only normal velocity and preserve tangent velocity", () => {
    const result = collide2D({
      objectA: {
        mass: 1,
        position: { x: 0, y: 0 },
        velocity: { x: 3, y: 1 }
      },
      objectB: {
        mass: 1,
        position: { x: 10, y: 0 },
        velocity: { x: -2, y: 4 }
      },
      restitution: 1
    });

    expect(result.velocityA.x).toBeCloseTo(-2);
    expect(result.velocityB.x).toBeCloseTo(3);
    expect(result.velocityA.y).toBeCloseTo(1);
    expect(result.velocityB.y).toBeCloseTo(4);
  });

  test("reflects velocity across a static object normal", () => {
    const result = reflectVelocity(
      { x: 4, y: 2 },
      { x: 1, y: 0 },
      0.5
    );

    expect(result.x).toBeCloseTo(-2);
    expect(result.y).toBeCloseTo(2);
  });
});

describe("wallBounce", () => {
  test("inverts the axis velocity and scales it by restitution", () => {
    expect(wallBounce({ x: 6, y: -3 }, "x", 0.5).x).toBeCloseTo(-3);
    expect(wallBounce({ x: 6, y: -3 }, "x", 0.5).y).toBeCloseTo(-3);
    expect(wallBounce({ x: 6, y: -3 }, "y", 0.8).x).toBeCloseTo(6);
    expect(wallBounce({ x: 6, y: -3 }, "y", 0.8).y).toBeCloseTo(2.4);
  });
});

describe("playbackDeltaSeconds", () => {
  test("scales frame delta by playback rate and clamps extreme rates", () => {
    expect(playbackDeltaSeconds(0.1, 0.5)).toBeCloseTo(0.05);
    expect(playbackDeltaSeconds(0.1, 2)).toBeCloseTo(0.2);
    expect(playbackDeltaSeconds(0.1, 8)).toBeCloseTo(0.2);
    expect(playbackDeltaSeconds(0.1, 0.05)).toBeCloseTo(0.03);
  });
});

describe("vectorAngleDegrees", () => {
  test("converts a vector into a 0 to 360 degree heading", () => {
    expect(vectorAngleDegrees({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(vectorAngleDegrees({ x: 0, y: 1 })).toBeCloseTo(90);
    expect(vectorAngleDegrees({ x: -1, y: 0 })).toBeCloseTo(180);
    expect(vectorAngleDegrees({ x: 0, y: -1 })).toBeCloseTo(270);
  });
});
