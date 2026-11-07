import { ChemLanguageProvider, ChemLanguageSwitch } from "./chem-language";
import { useChemLanguage } from "./chem-language";
import { useRef, useState } from "react";
import {
  Atom as AtomIcon,
  FlaskConical,
  RotateCcw,
  Move3D,
  Scissors,
  Link,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  MOLECULES,
  ELEMENTS,
  rotatePoint,
  neutralizationPH,
} from "./chemistry";
import "./chemistry.css";
import { ReactionAnimation } from "./ReactionAnimation";
import { PeriodicTable } from "./PeriodicTable";
import { ProteinExplorer } from "./ProteinLibrary";

function ChemistryLabContent() {
  const { localize } = useChemLanguage();
  const [moleculeId, setMoleculeId] = useState("methane");
  const [category, setCategory] = useState("全部");
  const [mode, setMode] = useState<
    | "molecules"
    | "reaction"
    | "animation"
    | "periodic"
    | "protein"
    | "dna"
    | "rna"
  >("molecules");
  const [rotation, setRotation] = useState({ yaw: 0.4, pitch: -0.25 });
  const [zoom, setZoom] = useState(1);
  const [spread, setSpread] = useState(1);
  const [selected, setSelected] = useState<{
    kind: "atom" | "bond";
    index: number;
  } | null>(null);
  const [broken, setBroken] = useState<number[]>([]);
  const [answer, setAnswer] = useState(false);
  const [base, setBase] = useState(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const molecule = MOLECULES.find((m) => m.id === moleculeId)!;
  const reset = () => {
    setRotation({ yaw: 0.4, pitch: -0.25 });
    setZoom(1);
    setSpread(1);
    setBroken([]);
    setSelected(null);
    setAnswer(false);
  };
  const points = molecule.atoms.map((a) => {
    const [x, y, z] = rotatePoint(a.position, rotation.yaw, rotation.pitch);
    const perspective = 7 / (7 - z);
    return {
      x: 320 + x * 95 * zoom * spread * perspective,
      y: 225 + y * 95 * zoom * spread * perspective,
      z,
      r: (a.element === "H" ? 16 : 24) * perspective * zoom,
    };
  });
  const activeBond =
    selected?.kind === "bond" ? molecule.bonds[selected.index] : null;
  const activeAtom =
    selected?.kind === "atom" ? molecule.atoms[selected.index] : null;
  const ph = neutralizationPH(base);
  const liquid = ph < 6.9 ? "#fa887b" : ph > 7.1 ? "#8584dc" : "#55bc96";
  const select = (kind: "atom" | "bond", index: number) => {
    if (!drag.current?.moved) setSelected({ kind, index });
  };
  return localize(
    <div className="chem-app">
      <header className="chem-header">
        <SidebarTrigger />
        <span className="chem-brand">
          <FlaskConical size={21} /> Chemistry Lab
        </span>
        <ChemLanguageSwitch />
        <span className="chem-pill">探索 · 拆解 · 发现</span>
      </header>
      <main className="chem-main">
        <div className="chem-intro">
          <div>
            <p className="chem-eyebrow">LITTLE SCIENTISTS, BIG DISCOVERIES</p>
            <h1>把看不见的化学，转到眼前。</h1>
            <p>从一颗原子开始，亲手探索分子的立体世界。</p>
          </div>
          <div className="chem-mode" aria-label="实验模式">
            <button
              className={mode === "protein" ? "active" : ""}
              onClick={() => setMode("protein")}
            >
              <AtomIcon size={17} />
              蛋白质拆解
            </button>
            <button
              className={mode === "periodic" ? "active" : ""}
              onClick={() => setMode("periodic")}
            >
              <AtomIcon size={17} />
              Periodic Table
            </button>
            <button
              className={mode === "animation" ? "active" : ""}
              onClick={() => setMode("animation")}
            >
              <FlaskConical size={17} />
              反应动画
            </button>
            <button
              className={mode === "molecules" ? "active" : ""}
              onClick={() => setMode("molecules")}
            >
              <AtomIcon size={17} />
              3D 分子工坊
            </button>
            <button
              className={mode === "reaction" ? "active" : ""}
              onClick={() => setMode("reaction")}
            >
              <FlaskConical size={17} />
              酸碱实验台
            </button>
            <button
              className={mode === "dna" ? "active" : ""}
              onClick={() => setMode("dna")}
            >
              <Link size={17} />
              DNA
            </button>
            <button
              className={mode === "rna" ? "active" : ""}
              onClick={() => setMode("rna")}
            >
              <Scissors size={17} />
              RNA
            </button>
          </div>
        </div>
        {mode === "protein" ? (
          <ProteinExplorer />
        ) : mode === "periodic" ? (
          <PeriodicTable />
        ) : mode === "animation" ? (
          <ReactionAnimation />
        ) : mode === "molecules" ? (
          <>
            <div className="chem-filters" aria-label="分子分类">
              {["全部", "无机", "有机"].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    if (c !== "全部" && molecule.category !== c) {
                      setMoleculeId(
                        MOLECULES.find((m) => m.category === c)!.id,
                      );
                      reset();
                    }
                  }}
                >
                  {c === "全部" ? "全部分子" : `${c}化学`}
                </button>
              ))}
              <span>6 个分子 · 真实空间坐标</span>
            </div>
            <div className="chem-catalog">
              {MOLECULES.filter(
                (m) => category === "全部" || m.category === category,
              ).map((m) => (
                <button
                  key={m.id}
                  className={m.id === moleculeId ? "active" : ""}
                  onClick={() => {
                    setMoleculeId(m.id);
                    reset();
                  }}
                >
                  <strong>{m.formula}</strong>
                  <span>
                    {m.name}
                    <small>{m.category}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="chem-workspace">
              <section className="chem-viewer">
                <div className="chem-viewer-top">
                  <div>
                    <span className="chem-eyebrow">MOLECULE EXPLORER</span>
                    <h2>
                      {molecule.name} <span>{molecule.formula}</span>
                    </h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={reset}>
                    <RotateCcw size={14} />
                    重置模型
                  </Button>
                </div>
                <svg
                  className="chem-scene"
                  viewBox="0 0 640 450"
                  role="group"
                  aria-label={`${molecule.name}三维分子，可拖动旋转，点击原子或化学键`}
                  onPointerDown={(e) => {
                    drag.current = { x: e.clientX, y: e.clientY, moved: false };
                  }}
                  onPointerMove={(e) => {
                    if (!drag.current) return;
                    const dx = e.clientX - drag.current.x,
                      dy = e.clientY - drag.current.y;
                    if (Math.abs(dx) + Math.abs(dy) > 2)
                      drag.current.moved = true;
                    setRotation((r) => ({
                      yaw: r.yaw + dx * 0.009,
                      pitch: r.pitch + dy * 0.009,
                    }));
                    drag.current.x = e.clientX;
                    drag.current.y = e.clientY;
                  }}
                  onPointerLeave={() => {
                    drag.current = null;
                  }}
                  onPointerUp={() => {
                    if (drag.current?.moved) {
                      setTimeout(() => {
                        drag.current = null;
                      }, 0);
                    } else drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                >
                  <defs>
                    {Object.entries(ELEMENTS).map(([key, el]) => (
                      <radialGradient
                        id={`chem-${key}`}
                        key={key}
                        cx="30%"
                        cy="25%"
                      >
                        <stop offset="0%" stopColor="white" />
                        <stop offset="40%" stopColor={el.color} />
                        <stop
                          offset="100%"
                          stopColor={key === "H" ? "#93a7b8" : el.color}
                        />
                      </radialGradient>
                    ))}
                  </defs>
                  <ellipse
                    cx="320"
                    cy="377"
                    rx="140"
                    ry="18"
                    fill="#234e4610"
                  />
                  {[
                    ...molecule.bonds.map((b, i) => ({
                      depth: (points[b.a].z + points[b.b].z) / 2,
                      key: `b${i}`,
                      render: () => {
                        const a = points[b.a],
                          c = points[b.b],
                          isBroken = broken.includes(i),
                          isSelected =
                            selected?.kind === "bond" && selected.index === i;
                        const dx = c.x - a.x,
                          dy = c.y - a.y,
                          len = Math.hypot(dx, dy) || 1,
                          ox = (-dy / len) * 5,
                          oy = (dx / len) * 5;
                        const start = {
                          x: a.x + (dx / len) * Math.min(a.r, len * 0.48),
                          y: a.y + (dy / len) * Math.min(a.r, len * 0.48),
                        };
                        const end = {
                          x: c.x - (dx / len) * Math.min(c.r, len * 0.48),
                          y: c.y - (dy / len) * Math.min(c.r, len * 0.48),
                        };
                        return (
                          <g
                            role="button"
                            tabIndex={0}
                            aria-label={`化学键 ${i + 1}：${molecule.atoms[b.a].element}—${molecule.atoms[b.b].element}${b.order === 2 ? " 双键" : ""}${isBroken ? " 已拆开" : ""}`}
                            onClick={() => select("bond", i)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelected({ kind: "bond", index: i });
                              }
                            }}
                          >
                            <line
                              x1={start.x}
                              y1={start.y}
                              x2={end.x}
                              y2={end.y}
                              stroke="transparent"
                              strokeWidth="28"
                            />
                            {(b.order === 2 ? [-1, 1] : [0]).map((offset) => (
                              <line
                                key={offset}
                                x1={start.x + ox * offset}
                                y1={start.y + oy * offset}
                                x2={end.x + ox * offset}
                                y2={end.y + oy * offset}
                                stroke={
                                  isSelected
                                    ? "#f59e0b"
                                    : isBroken
                                      ? "#b9c5ca"
                                      : "#91a8aa"
                                }
                                strokeWidth={isBroken ? 3 : 9}
                                strokeDasharray={isBroken ? "5 10" : undefined}
                                strokeLinecap="round"
                                pointerEvents="none"
                              />
                            ))}
                          </g>
                        );
                      },
                    })),
                    ...molecule.atoms.map((a, i) => ({
                      depth: points[i].z,
                      key: `a${i}`,
                      render: () => {
                        const p = points[i];
                        return (
                          <g
                            role="button"
                            tabIndex={0}
                            aria-label={`原子 ${i + 1}：${ELEMENTS[a.element].name}`}
                            onClick={() => select("atom", i)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelected({ kind: "atom", index: i });
                              }
                            }}
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={p.r}
                              fill={`url(#chem-${a.element})`}
                              stroke={
                                selected?.kind === "atom" &&
                                selected.index === i
                                  ? "#f59e0b"
                                  : "#ffffff"
                              }
                              strokeWidth={3}
                            />
                            <text
                              x={p.x}
                              y={p.y + 5}
                              textAnchor="middle"
                              fill={a.element === "H" ? "#334155" : "white"}
                              fontWeight="700"
                              fontSize={15 * zoom}
                              pointerEvents="none"
                            >
                              {a.element}
                            </text>
                          </g>
                        );
                      },
                    })),
                  ]
                    .sort((a, b) => a.depth - b.depth)
                    .map((item) => (
                      <g key={item.key}>{item.render()}</g>
                    ))}
                </svg>
                <div className="chem-hint">
                  <Move3D size={16} />
                  拖动旋转 · 点原子或化学键看细节
                </div>
                <div className="chem-controls">
                  <label>
                    放大
                    <input
                      aria-label="模型缩放"
                      type="range"
                      min=".65"
                      max="1.3"
                      step=".05"
                      value={zoom}
                      onChange={(e) => setZoom(+e.target.value)}
                    />
                  </label>
                  <label>
                    展开结构
                    <input
                      aria-label="展开结构"
                      type="range"
                      min="1"
                      max="1.55"
                      step=".05"
                      value={spread}
                      onChange={(e) => setSpread(+e.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRotation((r) => ({ ...r, yaw: r.yaw + Math.PI / 4 }))
                    }
                  >
                    旋转 45°
                  </Button>
                </div>
                <div className="chem-legend">
                  {Object.entries(ELEMENTS).map(([symbol, el]) => (
                    <span key={symbol}>
                      <i style={{ background: el.color }} />
                      {el.name} {symbol}
                    </span>
                  ))}
                </div>
              </section>
              <aside className="chem-details">
                <section className="chem-detail-card">
                  <span className="chem-eyebrow">01 / 看懂空间</span>
                  <h3>{molecule.geometry}</h3>
                  <div className="chem-angle">{molecule.angle}</div>
                  <p>{molecule.description}</p>
                  <small>
                    键角为典型近似值；球棍模型以教学为目的，原子大小不按实际比例。乙醇展示一种近似构象，未显示孤电子对。
                  </small>
                </section>
                <section className="chem-detail-card">
                  <span className="chem-eyebrow">02 / 动手拆解</span>
                  {activeBond && selected ? (
                    <>
                      <h3>
                        {molecule.atoms[activeBond.a].element}—
                        {molecule.atoms[activeBond.b].element}{" "}
                        {activeBond.order === 2 ? "双键" : "单键"}
                      </h3>
                      <p>
                        共用 {activeBond.order} 对电子 · 典型键长{" "}
                        {activeBond.length}
                      </p>
                      <Button
                        className="chem-action"
                        onClick={() =>
                          setBroken((v) =>
                            v.includes(selected.index)
                              ? v.filter((i) => i !== selected.index)
                              : [...v, selected.index],
                          )
                        }
                      >
                        {broken.includes(selected.index) ? (
                          <Link size={16} />
                        ) : (
                          <Scissors size={16} />
                        )}{" "}
                        {broken.includes(selected.index)
                          ? "重新连接这条键"
                          : "拆开这条键"}
                      </Button>
                    </>
                  ) : activeAtom ? (
                    <>
                      <h3>
                        {ELEMENTS[activeAtom.element].name}原子 ·{" "}
                        {activeAtom.element}
                      </h3>
                      <p>
                        当前模型中连接了{" "}
                        {
                          molecule.bonds.filter(
                            (b, i) =>
                              !broken.includes(i) &&
                              (b.a === selected!.index ||
                                b.b === selected!.index),
                          ).length
                        }{" "}
                        个原子。点旁边的化学键，就能观察和拆解它。
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>每一条键，都有故事。</h3>
                      <p>
                        点选模型中的连接杆，查看键的类型、键长和共用电子对，再试着拆开它。
                      </p>
                    </>
                  )}
                  <p className="chem-note">
                    {broken.length > 0
                      ? `已拆开 ${broken.length} 条键。虚线表示原来的连接位置。`
                      : "拆开后以虚线标记，随时可以重新连接。"}{" "}
                    这是结构演示；真实断键需要能量，产物和形状也可能变化。
                  </p>
                </section>
              </aside>
            </div>
            <section className="chem-question">
              <Lightbulb />
              <div>
                <strong>小小科学家挑战</strong>
                <p>{molecule.challenge}</p>
                {answer && <p className="chem-answer">{molecule.answer}</p>}
              </div>
              <Button variant="outline" onClick={() => setAnswer(!answer)}>
                {answer ? "收起解释" : "看看解释"}
              </Button>
            </section>
          </>
        ) : mode === "dna" || mode === "rna" ? (
          <section className={`chem-genetics chem-${mode}`}>
            <div className="chem-genetics-hero">
              <span className="chem-eyebrow">GENETIC INFORMATION</span>
              <h2>{mode === "dna" ? "DNA：稳定保存生命蓝图" : "RNA：把信息带到细胞工厂"}</h2>
              <p>
                {mode === "dna"
                  ? "两条互补链像拉链一样配对，用 A、T、C、G 的顺序保存遗传信息。"
                  : "单链 RNA 可以折叠成不同形状，负责传递、读取和调节遗传信息。"}
              </p>
            </div>
            <div className="chem-genetics-grid">
              <div className="chem-helix" aria-label={`${mode.toUpperCase()} 示意图`}>
                {Array.from({ length: mode === "dna" ? 8 : 7 }, (_, i) => (
                  <div className="chem-base-pair" key={i}>
                    <span className="chem-base chem-base-left">{mode === "dna" ? ["A", "T", "C", "G"][i % 4] : ["A", "U", "C", "G"][i % 4]}</span>
                    <i />
                    {mode === "dna" && <span className="chem-base chem-base-right">{["T", "A", "G", "C"][i % 4]}</span>}
                  </div>
                ))}
              </div>
              <div className="chem-genetics-facts">
                <article><strong>{mode === "dna" ? "双链" : "单链"}</strong><span>结构特点</span></article>
                <article><strong>{mode === "dna" ? "A · T · C · G" : "A · U · C · G"}</strong><span>四种碱基</span></article>
                <article><strong>{mode === "dna" ? "复制" : "翻译"}</strong><span>核心任务</span></article>
              </div>
            </div>
            <div className="chem-genetics-note">
              <Lightbulb size={18} />
              <p>{mode === "dna" ? "DNA 的 T（胸腺嘧啶）在 RNA 中会换成 U（尿嘧啶）。" : "RNA 的 U（尿嘧啶）替代了 DNA 中的 T，这是两者最容易观察的区别之一。"}</p>
            </div>
          </section>
        ) : (
          <section className="chem-reaction">
            <div>
              <span className="chem-eyebrow">无机化学</span>
              <h2>酸与碱，什么时候刚刚好？</h2>
              <p>
                烧杯中有 20 mL、0.1 mol/L
                的盐酸。拖动滑块，加入同浓度的氢氧化钠溶液。
              </p>
              <div className="chem-equation">HCl + NaOH → NaCl + H₂O</div>
              <label>
                加入 NaOH：<strong>{base} mL</strong>
                <input
                  aria-label="加入氢氧化钠体积"
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={base}
                  onChange={(e) => setBase(+e.target.value)}
                />
              </label>
              <p>净离子反应：H⁺ + OH⁻ → H₂O</p>
              <Button variant="outline" onClick={() => setBase(0)}>
                <RotateCcw size={16} />
                重新实验
              </Button>
              <p className="chem-note">
                25 °C
                理想强酸强碱模型，忽略活度和体积收缩。颜色仅用于区分酸碱性，并非溶液实际颜色。
              </p>
            </div>
            <div className="chem-beaker-panel">
              <div className="chem-beaker">
                <div
                  style={{ height: `${30 + base * 0.9}%`, background: liquid }}
                >
                  <span>{base + 20} mL</span>
                </div>
              </div>
              <strong aria-live="polite">pH {ph.toFixed(2)}</strong>
              <span>
                {base === 20
                  ? "恰好中和 · 中性"
                  : base < 20
                    ? "酸过量 · 酸性"
                    : "碱过量 · 碱性"}
              </span>
              <p>
                {base === 20
                  ? "两边的物质的量相等，H⁺ 与 OH⁻ 恰好反应。"
                  : "试着找到 pH = 7 的位置。"}
              </p>
            </div>
          </section>
        )}
      </main>
    </div>,
  );
}

export function ChemistryLab() {
  return (
    <ChemLanguageProvider>
      <ChemistryLabContent />
    </ChemLanguageProvider>
  );
}
