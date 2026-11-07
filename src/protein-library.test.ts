import { describe, it, expect } from "vitest";
import catalog from "./data/proteins/catalog.json";
import {
  type Protein,
  AMINO_ACIDS,
  isolatedResidue,
  peptideBonds,
  proteinBreakdown,
  residuePosition,
} from "./protein-model";
const files = import.meta.glob<{ default: Protein }>("./data/proteins/*.json", {
  eager: true,
});
describe("real protein library", () => {
  it("contains 20 distinct sourced proteins with descriptions and matching structures", () => {
    expect(catalog).toHaveLength(22);
    expect(new Set(catalog.map((p) => p.name)).size).toBe(22);
    for (const entry of catalog) {
      const p =
        files[`./data/proteins/${entry.pdb.toLowerCase()}.json`].default;
      expect(p.pdb).toBe(entry.pdb);
      expect(p.residues.length).toBe(entry.count);
      expect(entry.location.length).toBeGreaterThan(3);
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.source).toBe(`https://www.rcsb.org/structure/${entry.pdb}`);
      for (const r of p.residues) {
        expect(AMINO_ACIDS[r.code]).toBeDefined();
        expect(
          isolatedResidue(r, true).atoms.every((a) =>
            a.position.every(Number.isFinite),
          ),
        ).toBe(true);
      }
      for (const [a, b] of peptideBonds(p)) {
        const c = p.residues[a].atoms.find((x) => x.name === "C")!;
        const n = p.residues[b].atoms.find((x) => x.name === "N")!;
        expect(
          Math.hypot(...c.position.map((v, i) => v - n.position[i])),
        ).toBeLessThan(1.9);
      }
      for (const [a, b] of p.disulfides) {
        expect(p.residues[a - 1].code).toBe("CYS");
        expect(p.residues[b - 1].code).toBe("CYS");
      }
    }
  });
  it("adapts unfolding and decomposition to every structure size", () => {
    for (const entry of catalog) {
      const p =
        files[`./data/proteins/${entry.pdb.toLowerCase()}.json`].default;
      expect(proteinBreakdown(1, p)).toMatchObject({
        peptideCuts: peptideBonds(p).length,
        fragments: p.residues.length,
        disulfideCuts: p.disulfides.length,
        complete: true,
      });
      for (const t of [0, 0.5, 1]) {
        const coords = p.residues.map((_, i) => residuePosition(i, t, p));
        expect(coords.every((v) => v.every(Number.isFinite))).toBe(true);
        expect(new Set(coords.map((v) => v.join(","))).size).toBe(
          p.residues.length,
        );
      }
    }
  });
  it("does not invent peptide bonds across missing coordinates", () => {
    const p = files["./data/proteins/1crn.json"].default;
    const gap = { ...p, peptideBonds: p.peptideBonds!.slice(1) };
    expect(proteinBreakdown(0, gap).fragments).toBe(2);
    expect(proteinBreakdown(1, gap).waterMolecules).toBe(44);
  });
});
