import rawProtein from "./data/proteins/crambin.json";
import type { Point3 } from "./chemistry";
export type ProteinAtom = {
  name: string;
  element: string;
  position: Point3;
  added?: boolean;
};
export type Residue = {
  number: number | string;
  code: string;
  position: Point3;
  atoms: ProteinAtom[];
  bonds: number[][];
};
export type Protein = {
  pdb: string;
  name: string;
  source: string;
  disulfides: number[][];
  residues: Residue[];
  peptideBonds?: number[][];
};
export const PROTEIN = rawProtein as Protein;
export const AMINO_ACIDS: Record<
  string,
  {
    name: string;
    zh: string;
    letter: string;
    formula: string;
    family: string;
    sideChain: string;
  }
> = {
  ALA: {
    name: "Alanine",
    zh: "丙氨酸",
    letter: "A",
    formula: "C₃H₇NO₂",
    family: "nonpolar",
    sideChain: "侧链是一个小小的甲基（—CH₃），属于非极性侧链。",
  },
  ARG: {
    name: "Arginine",
    zh: "精氨酸",
    letter: "R",
    formula: "C₆H₁₄N₄O₂",
    family: "basic",
    sideChain: "侧链含胍基，在接近中性的水溶液中通常带正电。",
  },
  ASN: {
    name: "Asparagine",
    zh: "天冬酰胺",
    letter: "N",
    formula: "C₄H₈N₂O₃",
    family: "polar",
    sideChain: "侧链含酰胺基，可以参与氢键。不要和天冬氨酸混淆。",
  },
  ASP: {
    name: "Aspartic acid",
    zh: "天冬氨酸",
    letter: "D",
    formula: "C₄H₇NO₄",
    family: "acidic",
    sideChain: "侧链多一个羧基，在接近中性的水溶液中通常带负电。",
  },
  CYS: {
    name: "Cysteine",
    zh: "半胱氨酸",
    letter: "C",
    formula: "C₃H₇NO₂S",
    family: "polar",
    sideChain:
      "侧链含硫醇基（—SH）。两个半胱氨酸残基可以形成一条二硫键（S—S），帮助固定蛋白质形状。",
  },
  GLN: {
    name: "Glutamine",
    zh: "谷氨酰胺",
    letter: "Q",
    formula: "C₅H₁₀N₂O₃",
    family: "polar",
    sideChain: "侧链含酰胺基，比天冬酰胺多一个 —CH₂—。",
  },
  GLU: {
    name: "Glutamic acid",
    zh: "谷氨酸",
    letter: "E",
    formula: "C₅H₉NO₄",
    family: "acidic",
    sideChain: "侧链含羧基，在接近中性的水溶液中通常带负电。",
  },
  GLY: {
    name: "Glycine",
    zh: "甘氨酸",
    letter: "G",
    formula: "C₂H₅NO₂",
    family: "nonpolar",
    sideChain:
      "侧链只是一个氢，是最小的常见氨基酸，也是这组常见氨基酸中唯一没有手性 α 碳的。",
  },
  HIS: {
    name: "Histidine",
    zh: "组氨酸",
    letter: "H",
    formula: "C₆H₉N₃O₂",
    family: "basic",
    sideChain: "侧链含咪唑环，可以参与质子转移。",
  },
  ILE: {
    name: "Isoleucine",
    zh: "异亮氨酸",
    letter: "I",
    formula: "C₆H₁₃NO₂",
    family: "nonpolar",
    sideChain: "侧链是支链烃，疏水；与亮氨酸分子式相同，但连接方式不同。",
  },
  LEU: {
    name: "Leucine",
    zh: "亮氨酸",
    letter: "L",
    formula: "C₆H₁₃NO₂",
    family: "nonpolar",
    sideChain: "侧链是支链烃，常出现在蛋白质疏水区域。",
  },
  LYS: {
    name: "Lysine",
    zh: "赖氨酸",
    letter: "K",
    formula: "C₆H₁₄N₂O₂",
    family: "basic",
    sideChain: "侧链末端有氨基，在接近中性的水溶液中通常带正电。",
  },
  MET: {
    name: "Methionine",
    zh: "甲硫氨酸",
    letter: "M",
    formula: "C₅H₁₁NO₂S",
    family: "nonpolar",
    sideChain: "侧链含硫醚；与半胱氨酸的硫醇基不同。",
  },
  PHE: {
    name: "Phenylalanine",
    zh: "苯丙氨酸",
    letter: "F",
    formula: "C₉H₁₁NO₂",
    family: "aromatic",
    sideChain: "侧链有一个苯环，具有芳香性，整体偏疏水。",
  },
  PRO: {
    name: "Proline",
    zh: "脯氨酸",
    letter: "P",
    formula: "C₅H₉NO₂",
    family: "nonpolar",
    sideChain: "侧链回接到氮原子，形成环状结构，使主链的转动受到限制。",
  },
  SER: {
    name: "Serine",
    zh: "丝氨酸",
    letter: "S",
    formula: "C₃H₇NO₃",
    family: "polar",
    sideChain: "侧链有羟基（—OH），可以与水或其他基团形成氢键。",
  },
  THR: {
    name: "Threonine",
    zh: "苏氨酸",
    letter: "T",
    formula: "C₄H₉NO₃",
    family: "polar",
    sideChain: "侧链同时有羟基（—OH）和甲基（—CH₃）。",
  },
  TRP: {
    name: "Tryptophan",
    zh: "色氨酸",
    letter: "W",
    formula: "C₁₁H₁₂N₂O₂",
    family: "aromatic",
    sideChain: "侧链有一个较大的吲哚双环结构。",
  },
  TYR: {
    name: "Tyrosine",
    zh: "酪氨酸",
    letter: "Y",
    formula: "C₉H₁₁NO₃",
    family: "aromatic",
    sideChain: "侧链的芳香环上还有一个羟基（—OH）。",
  },
  VAL: {
    name: "Valine",
    zh: "缬氨酸",
    letter: "V",
    formula: "C₅H₁₁NO₂",
    family: "nonpolar",
    sideChain: "侧链像一个小小的 Y 形支链，属于疏水侧链。",
  },
};
export const AMINO_FAMILIES: Record<string, { name: string; color: string }> = {
  nonpolar: { name: "非极性", color: "#82b6a0" },
  polar: { name: "极性", color: "#7ab4d1" },
  acidic: { name: "酸性", color: "#de9183" },
  basic: { name: "碱性", color: "#a798d3" },
  aromatic: { name: "芳香族", color: "#d4b775" },
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
export function peptideBonds(protein: Protein) {
  return (
    protein.peptideBonds ?? protein.residues.slice(1).map((_, i) => [i, i + 1])
  );
}
export function proteinBreakdown(progress: number, protein: Protein = PROTEIN) {
  const p = clamp(progress),
    total = peptideBonds(protein).length;
  const peptideCuts = Math.floor(clamp((p - 0.5) / 0.5) * total + 1e-8);
  const disulfideCuts = Math.floor(
    clamp(p / 0.3) * protein.disulfides.length + 1e-8,
  );
  return {
    peptideCuts,
    disulfideCuts,
    fragments: protein.residues.length - total + peptideCuts,
    waterMolecules: peptideCuts,
    complete: p === 1,
  };
}
const geometryCache = new WeakMap<
  Protein,
  { positions: Point3[]; center: number[]; scale: number }
>();
function geometry(protein: Protein) {
  const cached = geometryCache.get(protein);
  if (cached) return cached;
  const positions = protein.residues.map((r) => r.position);
  const center = [0, 1, 2].map(
    (j) => positions.reduce((sum, p) => sum + p[j], 0) / positions.length,
  );
  const scale =
    Math.max(
      ...positions.map((p) => Math.hypot(...p.map((v, j) => v - center[j]))),
    ) / 6 || 1;
  const result = { positions, center, scale };
  geometryCache.set(protein, result);
  return result;
}
export function residuePosition(
  index: number,
  progress: number,
  protein: Protein = PROTEIN,
): Point3 {
  const { positions, center, scale } = geometry(protein);
  const columns = Math.ceil(Math.sqrt(positions.length * 1.6)),
    rows = Math.ceil(positions.length / columns);
  const row = Math.floor(index / columns),
    col = row % 2 === 0 ? index % columns : columns - 1 - (index % columns);
  const gap = 13 / columns;
  const open = [
    (col - (columns - 1) / 2) * gap,
    (row - (rows - 1) / 2) * gap,
    Math.sin(index * 0.9) * 0.2,
  ];
  const unfold = clamp(progress / 0.5),
    spread = clamp((progress - 0.5) / 0.5);
  return positions[index].map((v, j) => {
    const folded = (v - center[j]) / scale;
    return (folded + (open[j] - folded) * unfold) * (1 + spread * 0.15);
  }) as Point3;
}
export function isolatedResidue(residue: Residue, free: boolean) {
  const atoms: ProteinAtom[] = residue.atoms.map((a) => ({
    ...a,
    position: [...a.position] as Point3,
  }));
  const bonds = residue.bonds.map((b) => [...b]);
  if (free && !atoms.some((a) => a.name === "OXT")) {
    const carbon = atoms.find((a) => a.name === "C")!,
      alpha = atoms.find((a) => a.name === "CA")!,
      oxygen = atoms.find((a) => a.name === "O")!;
    const unit = (v: number[]) => {
      const n = Math.hypot(...v);
      return v.map((x) => x / n);
    };
    const u = unit(alpha.position.map((v, i) => v - carbon.position[i])),
      v = unit(oxygen.position.map((x, i) => x - carbon.position[i]));
    const direction = unit(u.map((x, i) => -x - v[i]));
    const position = carbon.position.map(
      (x, i) => x + direction[i] * 1.25,
    ) as Point3;
    bonds.push([atoms.findIndex((a) => a.name === "C"), atoms.length]);
    atoms.push({ name: "OXT", element: "O", position, added: true });
  }
  const center = atoms.reduce(
    (v, a) => v.map((x, i) => x + a.position[i] / atoms.length) as Point3,
    [0, 0, 0] as Point3,
  );
  return {
    atoms: atoms.map((a) => ({
      ...a,
      position: a.position.map((x, i) => x - center[i]) as Point3,
    })),
    bonds,
  };
}
