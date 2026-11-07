import { useChemLanguage } from "./chem-language";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Rotate3D,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotatePoint, type Point3 } from "./chemistry";
import {
  AMINO_ACIDS,
  AMINO_FAMILIES,
  type Protein,
  peptideBonds,
  isolatedResidue,
  proteinBreakdown,
  residuePosition,
} from "./protein-model";
import "./protein-explorer.css";

type ModelNode = {
  position: Point3;
  label: string;
  title: string;
  color: string;
  radius?: number;
  added?: boolean;
};
type ModelEdge = { a: number; b: number; color?: string; dashed?: boolean };
function MoleculeView({
  nodes,
  edges,
  selected,
  onSelect,
  label,
  extent = 8,
}: {
  nodes: ModelNode[];
  edges: ModelEdge[];
  selected?: number;
  onSelect?: (index: number) => void;
  label: string;
  extent?: number;
}) {
  const { localize } = useChemLanguage();
  const id = useId().replace(/:/g, "");
  const [rotation, setRotation] = useState({ yaw: 0.3, pitch: -0.25 });
  const [zoom, setZoom] = useState(1);
  const [auto, setAuto] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null),
    moved = useRef(false);
  useEffect(() => {
    if (!auto) return;
    let frame: number, last: number | undefined;
    const tick = (now: number) => {
      const delta = last === undefined ? 0 : Math.min(now - last, 100);
      last = now;
      setRotation((r) => ({ ...r, yaw: r.yaw + delta * 0.0003 }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [auto]);
  const points = nodes.map((n) => {
    const [x, y, z] = rotatePoint(n.position, rotation.yaw, rotation.pitch);
    const perspective = 1 / (1 - z / (extent * 5));
    return {
      x: 330 + ((x * 245) / extent) * zoom * perspective,
      y: 230 + ((y * 245) / extent) * zoom * perspective,
      z,
      r: (n.radius ?? 12) * perspective * Math.sqrt(zoom),
    };
  });
  const select = (i: number) => {
    if (!moved.current) onSelect?.(i);
  };
  return localize(
    <div className="protein-model-view">
      <svg
        className="protein-svg"
        viewBox="0 0 660 460"
        role="group"
        aria-label={label}
        onPointerDown={(e) => {
          setAuto(false);
          moved.current = false;
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x,
            dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
          setRotation((r) => ({
            yaw: r.yaw + dx * 0.009,
            pitch: r.pitch + dy * 0.009,
          }));
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          {nodes.map((n, i) => (
            <radialGradient id={`${id}-${i}`} key={i} cx="28%" cy="22%">
              <stop offset="0" stopColor="white" />
              <stop offset=".45" stopColor={n.color} />
              <stop offset="1" stopColor={n.color} />
            </radialGradient>
          ))}
        </defs>
        <ellipse cx="330" cy="421" rx="165" ry="13" fill="#385d4710" />
        {[
          ...edges.map((edge, i) => {
            const a = points[edge.a],
              b = points[edge.b],
              dx = b.x - a.x,
              dy = b.y - a.y,
              len = Math.hypot(dx, dy) || 1;
            return {
              depth: (a.z + b.z) / 2,
              key: `edge-${i}`,
              node: (
                <line
                  x1={a.x + (dx / len) * Math.min(a.r, len * 0.45)}
                  y1={a.y + (dy / len) * Math.min(a.r, len * 0.45)}
                  x2={b.x - (dx / len) * Math.min(b.r, len * 0.45)}
                  y2={b.y - (dy / len) * Math.min(b.r, len * 0.45)}
                  stroke={edge.color ?? "#a3b6b2"}
                  strokeWidth={edge.dashed ? 3 : 5}
                  strokeDasharray={edge.dashed ? "5 5" : undefined}
                  strokeLinecap="round"
                />
              ),
            };
          }),
          ...nodes.map((n, i) => {
            const p = points[i];
            return {
              depth: p.z,
              key: `node-${i}`,
              node: (
                <g
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={n.title}
                  onClick={() => select(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(i);
                    }
                  }}
                >
                  <title>{n.title}</title>
                  {selected === i && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.r + 5}
                      fill="none"
                      stroke="#d9a338"
                      strokeWidth="3"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={`url(#${id}-${i})`}
                    stroke={n.added ? "#3b9a63" : "white"}
                    strokeDasharray={n.added ? "3 2" : undefined}
                    strokeWidth={n.added ? 3 : 1.5}
                  />
                  <text
                    x={p.x}
                    y={p.y + 4}
                    fontSize={n.radius && n.radius > 15 ? 12 : 10}
                    textAnchor="middle"
                    fill={n.color === "#526173" ? "white" : "#183c39"}
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {n.label}
                  </text>
                </g>
              ),
            };
          }),
        ]
          .sort((a, b) => a.depth - b.depth)
          .map((p) => (
            <g key={p.key}>{p.node}</g>
          ))}
      </svg>
      <div className="protein-view-controls">
        <Button
          variant="outline"
          size="sm"
          aria-pressed={auto}
          onClick={() => setAuto((v) => !v)}
        >
          <Rotate3D size={15} />
          {auto ? "停止旋转" : "自动旋转"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setRotation((r) => ({ ...r, yaw: r.yaw + Math.PI / 4 }))
          }
        >
          转 45°
        </Button>
        <label>
          缩放
          <input
            aria-label={`${label}缩放`}
            type="range"
            min=".7"
            max="1.8"
            step=".05"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${label}重置视角`}
          onClick={() => {
            setAuto(false);
            setRotation({ yaw: 0.3, pitch: -0.25 });
            setZoom(1);
          }}
        >
          <RotateCcw size={14} />
        </Button>
      </div>
    </div>,
  );
}

export function ProteinStructure({ protein: PROTEIN }: { protein: Protein }) {
  const { localize } = useChemLanguage();
  const [selected, setSelected] = useState(0),
    [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [labels, setLabels] = useState(true),
    [atomIndex, setAtomIndex] = useState<number | null>(null);
  const status = proteinBreakdown(progress, PROTEIN);
  const residue = PROTEIN.residues[selected],
    amino = AMINO_ACIDS[residue.code],
    family = AMINO_FAMILIES[amino.family];
  const detail = useMemo(
    () => isolatedResidue(residue, status.complete),
    [residue, status.complete],
  );
  const choose = (index: number) => {
    setSelected(index);
    setAtomIndex(null);
  };
  const seek = (p: number) => {
    setPlaying(false);
    setProgress(p);
    setAtomIndex(null);
  };
  useEffect(() => {
    if (!playing) return;
    let frame: number, last: number | undefined;
    const tick = (now: number) => {
      const delta = last === undefined ? 0 : Math.min(now - last, 100);
      last = now;
      setProgress((p) => Math.min(1, p + delta / 18000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (progress >= 1) setPlaying(false);
  }, [progress]);
  const nodes = PROTEIN.residues.map((r, i) => {
    const a = AMINO_ACIDS[r.code];
    return {
      position: residuePosition(i, progress, PROTEIN),
      radius: Math.max(
        5,
        Math.min(12, 90 / Math.sqrt(PROTEIN.residues.length)),
      ),
      label: labels ? a.letter : "",
      title: `第 ${r.number} 位 ${a.zh}`,
      color: AMINO_FAMILIES[a.family].color,
    };
  });
  const peptides = peptideBonds(PROTEIN);
  const edges: ModelEdge[] = peptides
    .slice(status.peptideCuts)
    .map(([a, b]) => ({ a, b }));
  PROTEIN.disulfides
    .slice(status.disulfideCuts)
    .forEach(([a, b]) =>
      edges.push({ a: a - 1, b: b - 1, color: "#d5a638", dashed: true }),
    );
  const atomColors: Record<string, string> = {
    C: "#526173",
    N: "#719fe1",
    O: "#e88079",
    S: "#e1c65d",
  };
  const atom = atomIndex === null ? null : detail.atoms[atomIndex];
  const stage =
    progress === 0
      ? "真实折叠结构"
      : progress < 0.5
        ? "展开链（存在二硫键时先还原）"
        : progress < 1
          ? "逐条水解肽键"
          : `${PROTEIN.residues.length} 个独立氨基酸`;
  return localize(
    <section className="protein-explorer">
      <div className="protein-heading">
        <div>
          <span className="chem-eyebrow">PROTEIN → AMINO ACIDS</span>
          <h2>
            {PROTEIN.name} · {PROTEIN.residues.length} 个残基
          </h2>
          <p>真实结构来自 RCSB PDB {PROTEIN.pdb} · 当前展示范围见上方说明</p>
        </div>
        <span className="protein-badge">拖动旋转 · 点击拆解后的氨基酸</span>
      </div>
      <div className="protein-stage-tabs">
        {[
          [0, "01 原始折叠结构"],
          [0.5, "02 展开链"],
          [1, "03 拆成氨基酸"],
        ].map(([p, title]) => (
          <button
            key={p}
            aria-pressed={progress === p}
            onClick={() => seek(Number(p))}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="protein-playback">
        <Button
          onClick={() => {
            if (progress >= 1) setProgress(0);
            setPlaying((v) => !v);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          {playing ? "暂停" : "播放拆解"}
        </Button>
        <Button variant="outline" onClick={() => seek(1)}>
          <Scissors size={16} />
          全部拆开
        </Button>
        <Button variant="outline" onClick={() => seek(0)}>
          <RotateCcw size={16} />
          重新观察
        </Button>
        <label>
          拆解进度
          <input
            aria-label="蛋白质拆解进度"
            type="range"
            min="0"
            max="100"
            value={Math.round(progress * 100)}
            onChange={(e) => seek(+e.target.value / 100)}
          />
        </label>
        <output>{Math.round(progress * 100)}%</output>
      </div>
      <div className="protein-workspace">
        <section className="protein-chain-panel">
          <div className="protein-panel-heading">
            <div>
              <span className="chem-eyebrow">WHOLE PROTEIN</span>
              <h3>{stage}</h3>
            </div>
            <label>
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />
              字母标记
            </label>
          </div>
          <MoleculeView
            label="蛋白质三维模型"
            nodes={nodes}
            edges={edges}
            selected={selected}
            onSelect={choose}
            extent={9}
          />
          <div className="protein-chain-key">
            每颗球 = 一个氨基酸残基（位于 α 碳处）· 实线 = 相邻残基的主链连接 ·
            金色虚线 = 二硫键位置示意
          </div>
          <div className="protein-counts" aria-live="polite">
            <span>
              <strong>{peptides.length - status.peptideCuts}</strong>剩余肽键
            </span>
            <span>
              <strong>
                {PROTEIN.disulfides.length - status.disulfideCuts}
              </strong>
              剩余二硫键
            </span>
            <span>
              <strong>{status.fragments}</strong>主链片段
            </span>
            <span>
              <strong>{status.waterMolecules}</strong>已水解肽键 / H₂O
            </span>
          </div>
        </section>
        <section className="protein-amino-panel">
          <div className="protein-panel-heading">
            <div>
              <span className="chem-eyebrow">
                AMINO ACID #{residue.number.toString().padStart(2, "0")}
              </span>
              <h3>{amino.zh}</h3>
            </div>
            <div className="protein-nav">
              <button
                aria-label="上一个氨基酸"
                disabled={selected === 0}
                onClick={() => choose(selected - 1)}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                aria-label="下一个氨基酸"
                disabled={selected === PROTEIN.residues.length - 1}
                onClick={() => choose(selected + 1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <div className="protein-amino-chips">
            <span style={{ background: family.color }}>
              {residue.code} · {amino.letter}
            </span>
            <span>{family.name}</span>
            <span>
              {status.complete ? "游离氨基酸示意" : "链内残基局部结构"}
            </span>
          </div>
          <MoleculeView
            key={selected}
            label="所选氨基酸三维结构"
            nodes={detail.atoms.map((a) => ({
              position: a.position,
              label: a.element,
              title: `${a.name} ${a.element}${a.added ? " 水解后补入的端基氧" : ""}`,
              color: atomColors[a.element],
              radius: 19,
              added: a.added,
            }))}
            edges={detail.bonds.map(([a, b]) => ({ a, b }))}
            selected={atomIndex ?? undefined}
            onSelect={setAtomIndex}
            extent={
              Math.max(
                3,
                ...detail.atoms.map((a) => Math.hypot(...a.position)),
              ) + 1
            }
          />
          <div className="protein-atom-key">
            {Object.entries(atomColors).map(([el, color]) => (
              <span key={el}>
                <i style={{ background: color }} />
                {el} {{ C: "碳", N: "氮", O: "氧", S: "硫" }[el]}
              </span>
            ))}
          </div>
          <div className="protein-amino-copy">
            <strong>游离氨基酸分子式：{amino.formula}</strong>
            <p>{amino.sideChain}</p>
            <p className="protein-atom-readout" aria-live="polite">
              {atom
                ? `${atom.name} · ${atom.element}${atom.name === "CA" ? " · α 碳：连接主链和侧链的中心" : atom.name === "N" ? " · 主链氮" : atom.name === "C" ? " · 主链羧基碳" : atom.name === "OXT" ? " · 末端羧基氧" : atom.name === "O" ? " · 主链羰基氧" : " · 侧链原子"}`
                : "点击一个原子，查看它在氨基酸中的位置。"}
            </p>
            <small>
              {status.complete
                ? "绿色虚线边框表示教学模型补入的端基氧；其坐标为近似构建，不是原始晶体数据。自由端基可写作 —NH₃⁺ / —COO⁻（脯氨酸氮端为 —NH₂⁺），实际电荷随 pH 变化。"
                : "局部模型来自蛋白质中的残基，端基尚未补全，不能当作独立的游离氨基酸。"}{" "}
              仅显示实验记录中的标准残基和已解析重原子；缺失的侧链原子未补建。为方便观察，未画氢原子，连线未区分键级。拆解后保留原侧链构象，不模拟溶液中的构象变化。
            </small>
          </div>
        </section>
      </div>
      <section className="protein-sequence">
        <div>
          <h3>点序列，也能找到每一个氨基酸</h3>
          <span>N 端 → C 端 · {PROTEIN.residues.length} modeled residues</span>
        </div>
        <div className="protein-sequence-grid">
          {PROTEIN.residues.map((r, i) => {
            const a = AMINO_ACIDS[r.code];
            return (
              <button
                key={r.number}
                aria-label={`序列第 ${r.number} 位 ${a.name}`}
                aria-pressed={selected === i}
                onClick={() => choose(i)}
                style={{ background: AMINO_FAMILIES[a.family].color }}
              >
                <small>{r.number}</small>
                <strong>{a.letter}</strong>
                <span>{r.code}</span>
              </button>
            );
          })}
        </div>
        <div className="protein-family-key">
          {Object.values(AMINO_FAMILIES).map((f) => (
            <span key={f.name}>
              <i style={{ background: f.color }} />
              {f.name}
            </span>
          ))}
        </div>
      </section>
      <div className="protein-learning">
        <article>
          <h3>拆开，发生了什么？</h3>
          <p>
            当前模型包含 {PROTEIN.residues.length} 个残基、{peptides.length}{" "}
            条已建模肽键和 {PROTEIN.disulfides.length}{" "}
            条二硫键。完全水解这些肽键消耗 {peptides.length}{" "}
            个水分子；二硫键另需还原。计数只针对显示的链或结构域，不代表完整生物学组装体。
          </p>
        </article>
        <article>
          <h3>这是可观察的教学拆解</h3>
          <p>
            完整状态采用真实 α
            碳坐标；展开和分散是便于观察的排布动画。还原、水解和时间进度都是示意，不能靠普通加热或鼠标点击实现。重置是回看模型，不代表真实反应可直接逆转。
          </p>
          <a href={PROTEIN.source} target="_blank" rel="noreferrer">
            结构来源：RCSB PDB · {PROTEIN.pdb} ↗
          </a>
        </article>
      </div>
    </section>,
  );
}
