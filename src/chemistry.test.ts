import { describe, expect, it } from "vitest";
import { MOLECULES, neutralizationPH, rotatePoint } from "./chemistry";
describe("chemistry models", () => {
  it("preserves 3D distances during rotation", () => {
    const p = rotatePoint([1, 2, 3], 1.4, 0.7);
    expect(Math.hypot(...p)).toBeCloseTo(Math.sqrt(14));
  });
  it("gives methane tetrahedral angles", () => {
    const atoms = MOLECULES.find((m) => m.id === "methane")!.atoms;
    const a = atoms[1].position,
      b = atoms[2].position;
    expect(
      (Math.acos(
        a.reduce((v, x, i) => v + x * b[i], 0) /
          (Math.hypot(...a) * Math.hypot(...b)),
      ) *
        180) /
        Math.PI,
    ).toBeCloseTo(109.47, 2);
  });
  it("keeps all model bond endpoints and valences valid", () => {
    for (const m of MOLECULES) {
      m.atoms.forEach((a, i) => {
        const valence = m.bonds
          .filter((b) => b.a === i || b.b === i)
          .reduce((v, b) => v + b.order, 0);
        expect(valence).toBe({ H: 1, C: 4, O: 2, N: 3 }[a.element]);
      });
      for (const b of m.bonds) {
        expect(m.atoms[b.a]).toBeDefined();
        expect(m.atoms[b.b]).toBeDefined();
      }
    }
  });
  it("models acid, equivalence point, and excess base", () => {
    expect(neutralizationPH(0)).toBeCloseTo(1);
    expect(neutralizationPH(20)).toBeCloseTo(7);
    expect(neutralizationPH(40)).toBeCloseTo(12.52, 2);
    for (let i = 1; i <= 40; i++)
      expect(neutralizationPH(i)).toBeGreaterThan(neutralizationPH(i - 1));
  });
});
