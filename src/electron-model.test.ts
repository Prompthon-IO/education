import { describe, it, expect } from "vitest";
import {
  waterElectronModel,
  isCountedElectron,
  countedElectrons,
} from "./electron-model";
describe("water electron bookkeeping", () => {
  it("conserves 10 distinct electrons including 8 valence electrons throughout", () => {
    for (const p of [0, 0.2, 0.4, 0.6, 0.75, 1]) {
      const { electrons } = waterElectronModel(p);
      expect(electrons).toHaveLength(10);
      expect(new Set(electrons.map((e) => e.id)).size).toBe(10);
      expect(electrons.filter((e) => e.kind !== "core")).toHaveLength(8);
      expect(electrons.filter((e) => e.origin === "hydrogen")).toHaveLength(2);
    }
  });
  it("counts initial atom electrons without including the oxygen core", () => {
    const { electrons, complete } = waterElectronModel(0);
    for (const focus of ["left", "oxygen", "right"] as const) {
      expect(
        electrons.filter((e) => isCountedElectron(e, focus, complete)),
      ).toHaveLength(countedElectrons(focus, complete));
    }
    expect(countedElectrons("oxygen", false)).toBe(6);
  });
  it("counts shared pairs for both partners without duplicating electrons", () => {
    const { electrons, complete } = waterElectronModel(1);
    expect(complete).toBe(true);
    for (const focus of ["left", "oxygen", "right"] as const) {
      expect(
        electrons.filter((e) => isCountedElectron(e, focus, complete)),
      ).toHaveLength(focus === "oxygen" ? 8 : 2);
    }
    expect(
      electrons.filter(
        (e) =>
          isCountedElectron(e, "left", true) &&
          isCountedElectron(e, "oxygen", true),
      ),
    ).toHaveLength(2);
  });
});
