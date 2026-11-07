import { describe, it, expect } from "vitest";
import { PERIODIC_ELEMENTS, matchesElement } from "./periodic-table";
describe("periodic table", () => {
  it("contains all 118 unique elements in atomic order", () => {
    expect(PERIODIC_ELEMENTS).toHaveLength(118);
    expect(new Set(PERIODIC_ELEMENTS.map((e) => e.symbol)).size).toBe(118);
    expect(PERIODIC_ELEMENTS.map((e) => e.number)).toEqual(
      Array.from({ length: 118 }, (_, i) => i + 1),
    );
    expect(PERIODIC_ELEMENTS[117].name).toBe("Oganesson");
  });
  it("places every element in a unique valid table cell", () => {
    expect(
      new Set(PERIODIC_ELEMENTS.map((e) => `${e.row}:${e.column}`)).size,
    ).toBe(118);
    for (const e of PERIODIC_ELEMENTS) {
      expect(e.column).toBeGreaterThanOrEqual(1);
      expect(e.column).toBeLessThanOrEqual(18);
    }
    expect(PERIODIC_ELEMENTS[71].group).toBe(4);
    expect(PERIODIC_ELEMENTS[103].group).toBe(4);
    expect(PERIODIC_ELEMENTS[1].group).toBe(18);
    expect(PERIODIC_ELEMENTS.filter((e) => e.row === 9)).toHaveLength(15);
    expect(PERIODIC_ELEMENTS.filter((e) => e.row === 10)).toHaveLength(15);
  });
  it("searches names, symbols, atomic numbers and spelling aliases with filters", () => {
    const oxygen = PERIODIC_ELEMENTS[7];
    for (const q of ["oxygen", "O", "8", " Oxygen "])
      expect(matchesElement(oxygen, q, "all")).toBe(true);
    expect(matchesElement(oxygen, "O", "noble")).toBe(false);
    expect(matchesElement(PERIODIC_ELEMENTS[12], "aluminum", "all")).toBe(true);
    expect(matchesElement(PERIODIC_ELEMENTS[54], "cesium", "all")).toBe(true);
    expect(
      PERIODIC_ELEMENTS.filter((e) => matchesElement(e, "nonesuch", "all")),
    ).toHaveLength(0);
  });
});
