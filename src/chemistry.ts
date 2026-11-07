export type Point3 = [number, number, number];
export type Element = "H" | "C" | "O" | "N";
export type Atom = { element: Element; position: Point3 };
export type Bond = { a: number; b: number; order: 1 | 2; length: string };
export type Molecule = {
  id: string;
  name: string;
  formula: string;
  category: "有机" | "无机";
  geometry: string;
  angle: string;
  description: string;
  challenge: string;
  answer: string;
  atoms: Atom[];
  bonds: Bond[];
};
const atom = (element: Element, x: number, y: number, z: number): Atom => ({
  element,
  position: [x, y, z],
});
const bond = (
  a: number,
  b: number,
  order: 1 | 2 = 1,
  length = "约 109 pm",
): Bond => ({ a, b, order, length });
export const ELEMENTS = {
  H: { name: "氢", color: "#dce8f1" },
  C: { name: "碳", color: "#475569" },
  O: { name: "氧", color: "#f26464" },
  N: { name: "氮", color: "#608cff" },
};
export const MOLECULES: Molecule[] = [
  {
    id: "water",
    name: "水",
    formula: "H₂O",
    category: "无机",
    geometry: "折线形",
    angle: "104.5°",
    description:
      "氧原子上的两对孤电子对会影响键的方向，所以水分子像一个弯弯的 V，而不是一条直线。",
    challenge: "水分子的三个原子在一条直线上吗？",
    answer: "不在。H—O—H 键角约为 104.5°，水是折线形分子。",
    atoms: [
      atom("O", 0, 0, 0),
      atom("H", -0.79, 0.61, 0),
      atom("H", 0.79, 0.61, 0),
    ],
    bonds: [bond(0, 1, 1, "约 96 pm"), bond(0, 2, 1, "约 96 pm")],
  },
  {
    id: "co2",
    name: "二氧化碳",
    formula: "CO₂",
    category: "无机",
    geometry: "直线形",
    angle: "180°",
    description:
      "碳原子与两个氧原子分别形成双键。虽然含碳，二氧化碳通常归入无机化合物。",
    challenge: "图中的两组双键，一共表示几对共用电子？",
    answer: "四对。每个双键表示两对共用电子。",
    atoms: [atom("C", 0, 0, 0), atom("O", -1.2, 0, 0), atom("O", 1.2, 0, 0)],
    bonds: [bond(0, 1, 2, "约 116 pm"), bond(0, 2, 2, "约 116 pm")],
  },
  {
    id: "ammonia",
    name: "氨",
    formula: "NH₃",
    category: "无机",
    geometry: "三角锥形",
    angle: "约 107°",
    description:
      "三个氢原子形成三角形的底面，氮在上方。氮上的一对孤电子对让它与平面的三角形不同。",
    challenge: "从侧面看，氮和三个氢都在同一平面吗？",
    answer: "不在。氨是三角锥形；旋转模型可以看出高度差。",
    atoms: [
      atom("N", 0, -0.3, 0),
      atom("H", 0, 0.08, 0.94),
      atom("H", 0.814, 0.08, -0.47),
      atom("H", -0.814, 0.08, -0.47),
    ],
    bonds: [
      bond(0, 1, 1, "约 101 pm"),
      bond(0, 2, 1, "约 101 pm"),
      bond(0, 3, 1, "约 101 pm"),
    ],
  },
  {
    id: "methane",
    name: "甲烷",
    formula: "CH₄",
    category: "有机",
    geometry: "正四面体",
    angle: "109.5°",
    description:
      "四个氢朝向正四面体的四个顶点。转动它，看看为什么纸上的十字形画法不能完整表达真实结构。",
    challenge: "四个氢原子是在一个平面上吗？",
    answer: "不是。四条 C—H 键朝向空间中的四个不同方向，键角约为 109.5°。",
    atoms: [
      atom("C", 0, 0, 0),
      atom("H", 0.7, 0.7, 0.7),
      atom("H", -0.7, -0.7, 0.7),
      atom("H", -0.7, 0.7, -0.7),
      atom("H", 0.7, -0.7, -0.7),
    ],
    bonds: [bond(0, 1), bond(0, 2), bond(0, 3), bond(0, 4)],
  },
  {
    id: "ethene",
    name: "乙烯",
    formula: "C₂H₄",
    category: "有机",
    geometry: "平面结构",
    angle: "约 120°",
    description:
      "两个碳以双键相连，六个原子基本共面。双键包含一个 σ 键和一个 π 键，不能像普通单键那样自由旋转。",
    challenge: "双键是不是两根可以随意转动的绳子？",
    answer: "不是。双键表示两对共用电子，π 键的成键方式限制了绕双键的旋转。",
    atoms: [
      atom("C", -0.67, 0, 0),
      atom("C", 0.67, 0, 0),
      atom("H", -1.22, -0.95, 0),
      atom("H", -1.22, 0.95, 0),
      atom("H", 1.22, -0.95, 0),
      atom("H", 1.22, 0.95, 0),
    ],
    bonds: [
      bond(0, 1, 2, "约 134 pm"),
      bond(0, 2),
      bond(0, 3),
      bond(1, 4),
      bond(1, 5),
    ],
  },
  {
    id: "ethanol",
    name: "乙醇",
    formula: "C₂H₅OH",
    category: "有机",
    geometry: "碳周围近似四面体",
    angle: "碳周围约 109.5°",
    description:
      "找到红色的氧与白色的氢：—OH 是羟基。分子中这个小小的官能团会影响它的性质。",
    challenge: "乙醇中，哪两个原子组成了羟基 —OH？",
    answer: "氧原子和与它相连的氢原子。羟基是醇类的特征官能团。",
    atoms: [
      atom("C", -0.8, 0, 0),
      atom("C", 0.7, 0, 0),
      atom("O", 1.18, 1.3, 0),
      atom("H", 2.1, 1.3, 0.25),
      atom("H", -1.18, -1.02, 0),
      atom("H", -1.18, 0.51, 0.88),
      atom("H", -1.18, 0.51, -0.88),
      atom("H", 1.08, -0.51, 0.88),
      atom("H", 1.08, -0.51, -0.88),
    ],
    bonds: [
      bond(0, 1, 1, "约 154 pm"),
      bond(1, 2, 1, "约 143 pm"),
      bond(2, 3, 1, "约 96 pm"),
      bond(0, 4),
      bond(0, 5),
      bond(0, 6),
      bond(1, 7),
      bond(1, 8),
    ],
  },
];
export function rotatePoint(
  [x, y, z]: Point3,
  yaw: number,
  pitch: number,
): Point3 {
  const rx = x * Math.cos(yaw) + z * Math.sin(yaw),
    rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [
    rx,
    y * Math.cos(pitch) - rz * Math.sin(pitch),
    y * Math.sin(pitch) + rz * Math.cos(pitch),
  ];
}
// Equal 0.1 mol/L strong acid/base solutions, ideal activities, 25 °C.
export function neutralizationPH(baseMl: number): number {
  const excess = (0.1 * 20 - 0.1 * baseMl) / (20 + baseMl);
  const hydrogen = (excess + Math.sqrt(excess * excess + 4e-14)) / 2;
  // Stable form avoids cancellation when hydroxide is in excess.
  return -Math.log10(
    excess >= 0
      ? hydrogen
      : 1e-14 / ((-excess + Math.sqrt(excess * excess + 4e-14)) / 2),
  );
}
