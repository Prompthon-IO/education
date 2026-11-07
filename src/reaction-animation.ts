import type { Point3 } from "./chemistry";
export type ReactionCase = "electrons" | "water" | "protein" | "hydrolysis";
export const REACTION_CASES = {
  electrons: {
    name: "电子为什么要成对？",
    tag: "外层电子 · 2 与 8",
    equation: "氢各贡献 1 个 + 氧贡献 6 个 → 水中的 8 个外层电子",
    condition: "共价键 · 电子计数示意",
    stages: ["认识外层电子", "靠近与共用", "形成电子对", "数一数：2 和 8"],
    descriptions: [
      "先用分开的氢、氧原子解释电子计数：每个氢有 1 个电子，氧内层有 2 个、外层有 6 个。这不是氢气与氧气反应的实际起点。",
      "氢与氧之间逐渐形成共用电子对。小点的移动是教学示意，不是电子的真实运动路径。",
      "每条 O—H 共价键对应一对共用电子。氧还保留两对不参与这两条键的孤电子对。",
      "每个氢周围数到 2 个电子；氧外层数到 8 个，其中 4 个在两对共用电子里。整幅图实际只有 10 个电子，包括氧内层的 2 个。",
    ],
    note: "二电子和八电子规则是入门模型。氢气、氧气的 Lewis 结构本来就满足相应计数，生成水不能只用‘凑满’解释。真实反应取决于能量与反应条件；八电子规则也有例外。",
  },
  water: {
    name: "水是怎样形成的？",
    tag: "化学方程式",
    equation: "2H₂ + O₂ → 2H₂O",
    condition: "点燃 · 概念演示",
    stages: ["反应物", "旧键改变", "原子重组", "形成产物"],
    descriptions: [
      "左侧是两个氢分子和一个氧分子。数一数：共有四个氢原子、两个氧原子。",
      "输入能量启动反应。动画淡出旧键，帮助观察连接关系的变化。",
      "跟着同一颗原子向右走：原子重新组合，没有凭空出现或消失。",
      "右侧形成两个水分子。前后仍然是四个氢、两个氧，符合原子守恒。",
    ],
    note: "这是总反应的原子映射示意，不是实际逐步反应机理；没有表示自由原子中间体、反应速率或放热大小。",
  },
  protein: {
    name: "肉里的蛋白质受热",
    tag: "厨房里的化学",
    equation: "折叠的蛋白质 → 展开的蛋白质 → 聚集的蛋白质",
    condition: "加热 · 结构变化示意",
    stages: ["原先折叠", "受热展开", "彼此靠近", "聚集成团"],
    descriptions: [
      "把每条彩色长链想成一条折叠的珠子项链。每颗珠子代表一个氨基酸残基，不是单个原子。",
      "加热使维持折叠的部分相互作用改变，长链展开，这叫变性。连接珠子的肽链仍然完整。",
      "展开的蛋白质链相互接近，暴露的区域之间形成新的相互作用。",
      "多条蛋白质链聚集。肉的质地改变，肌肉纤维可收缩并排出部分水分。",
    ],
    note: "普通烹煮主要表现为变性和聚集，不等于把蛋白质直接分解成氨基酸。此处不模拟特定肉类的温度、时间、熟度或全部烹饪反应。",
  },
  hydrolysis: {
    name: "真正的断链是什么？",
    tag: "对比：肽键水解",
    equation: "R–CO–NH–R′ + H₂O → R–COOH + H₂N–R′",
    condition: "合适的水解条件 · 示意",
    stages: ["完整肽链", "水参与反应", "肽键断开", "得到较短的链"],
    descriptions: [
      "这是一条简化的肽链。选择的连接处代表一个肽键，R 和 R′ 代表两侧其余部分。",
      "在合适的酶催化或酸、碱等水解条件下，水参与肽键的断裂；不是仅靠普通烹煮。",
      "一个肽键发生水解：水的 H 与 OH 分别成为新端基的一部分。",
      "一条长链变成两条较短的链。继续水解多个肽键，才可能最终得到氨基酸。",
    ],
    note: "方程式采用简化的中性结构写法；实际端基的电荷随 pH 改变。图中珠子代表氨基酸残基，水用符号表示，不是原子级机理动画。",
  },
} as const;
export const clampProgress = (value: number) => Math.max(0, Math.min(1, value));
export const stageForProgress = (progress: number) =>
  Math.min(3, Math.floor(clampProgress(progress) * 4));
export const mix = (a: number, b: number, t: number) =>
  a + (b - a) * clampProgress(t);
export const WATER_ATOMS: { element: "H" | "O"; start: Point3; end: Point3 }[] =
  [
    { element: "O", start: [-2.5, 1.1, 0], end: [1.8, -0.9, 0] },
    { element: "O", start: [-1.5, 1.1, 0], end: [3.4, 1, 0] },
    { element: "H", start: [-3.2, -1.2, 0], end: [1.01, -0.29, 0] },
    { element: "H", start: [-2.4, -1.2, 0], end: [2.59, -0.29, 0] },
    { element: "H", start: [-1.5, -1.2, 0], end: [2.61, 1.61, 0] },
    { element: "H", start: [-0.7, -1.2, 0], end: [4.19, 1.61, 0] },
  ];
export const WATER_INITIAL_BONDS = [
  [0, 1],
  [2, 3],
  [4, 5],
];
export const WATER_FINAL_BONDS = [
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
];
export function proteinPoint(
  index: number,
  chain: number,
  progress: number,
): Point3 {
  const unfold = clampProgress((progress - 0.15) / 0.35),
    aggregate = clampProgress((progress - 0.5) / 0.4);
  const angle = index * 0.82 + chain * 1.7;
  const folded: Point3 = [
    Math.cos(angle) * 0.7 + (chain - 1) * 1.8,
    Math.sin(angle) * 0.75,
    (index - 9) * 0.075,
  ];
  const open: Point3 = [
    (index - 9) * 0.22,
    (chain - 1) * 1.4 + Math.sin(index * 0.5 + chain) * 0.25,
    Math.cos(index * 0.6) * 0.25,
  ];
  const joined: Point3 = [
    (index - 9) * 0.22,
    (chain - 1) * 0.45 + Math.sin(index * 0.5) * 0.32,
    Math.cos(index * 0.5) * 0.45 + (chain - 1) * 0.22,
  ];
  return folded.map((v, i) =>
    mix(mix(v, open[i], unfold), joined[i], aggregate),
  ) as Point3;
}
