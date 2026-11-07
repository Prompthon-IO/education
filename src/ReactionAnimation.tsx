import { useChemLanguage } from "./chem-language";
import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Flame,
  Move3D,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ELEMENTS, rotatePoint, type Point3 } from "./chemistry";
import {
  REACTION_CASES,
  WATER_ATOMS,
  WATER_INITIAL_BONDS,
  WATER_FINAL_BONDS,
  clampProgress,
  stageForProgress,
  mix,
  proteinPoint,
  type ReactionCase,
} from "./reaction-animation";
import "./reaction-animation.css";
import { WaterElectrons } from "./WaterElectrons";

export function ReactionAnimation() {
  const { localize } = useChemLanguage();
  const [example, setExample] = useState<ReactionCase>("electrons");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [rotation, setRotation] = useState({ yaw: 0.15, pitch: -0.15 });
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const scene = REACTION_CASES[example];
  const stage = stageForProgress(progress);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      const delta = last === undefined ? 0 : Math.min(now - last, 100);
      setProgress((p) => Math.min(1, p + (delta * speed) / 14000));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => {
    if (progress >= 1) setPlaying(false);
  }, [progress]);
  const seek = (p: number) => {
    setPlaying(false);
    setProgress(clampProgress(p));
  };
  const project = (point: Point3) => {
    const [x, y, z] = rotatePoint(point, rotation.yaw, rotation.pitch);
    const scale = 8 / (8 - z);
    return { x: 450 + x * 72 * scale, y: 208 + y * 72 * scale, z, r: scale };
  };
  const waterMove = clampProgress((progress - 0.23) / 0.57);
  const waterPoints = WATER_ATOMS.map((a) =>
    project(a.start.map((v, i) => mix(v, a.end[i], waterMove)) as Point3),
  );
  const oldOpacity = 1 - clampProgress((progress - 0.15) / 0.22),
    newOpacity = clampProgress((progress - 0.64) / 0.21);
  const proteinColors = ["#5c9cbd", "#d99a54", "#987abd"];
  const chains = Array.from({ length: example === "protein" ? 3 : 1 }, (_, c) =>
    Array.from({ length: 19 }, (_, i) => {
      if (example === "protein") return project(proteinPoint(i, c, progress));
      const separation = clampProgress((progress - 0.5) / 0.4);
      return project([
        (i - 9) * 0.28 + (i > 8 ? 1 : -1) * separation * 0.7,
        Math.sin(i * 0.6) * 0.35,
        Math.cos(i * 0.6) * 0.25,
      ]);
    }),
  );
  const broken = example === "hydrolysis" && progress >= 0.6;
  const renderWaterBond = (pair: number[], i: number, old: boolean) => {
    const a = waterPoints[pair[0]],
      b = waterPoints[pair[1]];
    return (
      <g key={`${old}-${i}`} opacity={old ? oldOpacity : newOpacity}>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#9baeb4"
          strokeWidth="8"
        />
        {old && i === 0 && (
          <line
            x1={a.x}
            y1={a.y + 11}
            x2={b.x}
            y2={b.y + 11}
            stroke="#9baeb4"
            strokeWidth="5"
          />
        )}
      </g>
    );
  };
  const controls = (
    <>
      <div className="reaction-player">
        <Button
          onClick={() => {
            if (progress >= 1) setProgress(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
          {playing ? "暂停" : progress >= 1 ? "再看一次" : "播放动画"}
        </Button>
        <Button variant="outline" onClick={() => seek(0)} aria-label="重置动画">
          <RotateCcw size={16} />
        </Button>
        <Button
          variant="outline"
          onClick={() => seek([0.3, 0.6, 1, 1][stage])}
          disabled={progress >= 1}
        >
          <SkipForward size={16} />
          下一步
        </Button>
        <label className="reaction-speed">
          速度
          <select
            aria-label="动画速度"
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
          >
            <option value=".5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
          </select>
        </label>
        <output aria-label="动画进度百分比">
          {Math.round(progress * 100)}%
        </output>
      </div>
      <input
        className="reaction-timeline"
        aria-label="反应动画进度"
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(progress * 100)}
        onChange={(e) => seek(+e.target.value / 100)}
      />
      <div className="reaction-chapters">
        {scene.stages.map((title, i) => (
          <button
            key={title}
            aria-current={stage === i ? "step" : undefined}
            onClick={() => seek([0, 0.3, 0.6, 1][i])}
          >
            <span>0{i + 1}</span>
            {title}
          </button>
        ))}
      </div>
    </>
  );
  return localize(
    <div className="reaction-animation">
      <div className="reaction-case-picker" aria-label="动画案例">
        {(Object.keys(REACTION_CASES) as ReactionCase[]).map((key) => (
          <button
            key={key}
            aria-pressed={key === example}
            onClick={() => {
              setExample(key);
              seek(0);
              setRotation({ yaw: 0.15, pitch: -0.15 });
            }}
          >
            <small>{REACTION_CASES[key].tag}</small>
            <strong>{REACTION_CASES[key].name}</strong>
          </button>
        ))}
      </div>
      <section className="reaction-film">
        <div className="reaction-film-heading">
          <div>
            <span className="chem-eyebrow">看见变化</span>
            <h2>{scene.name}</h2>
          </div>
          <span className="reaction-condition">
            <Flame size={16} />
            {scene.condition}
          </span>
        </div>
        <div className="reaction-equation" aria-label="反应方程式或过程示意">
          {scene.equation}
        </div>
        {example === "electrons" && (
          <div className="electron-playback">{controls}</div>
        )}
        <div className="reaction-stage-labels">
          <span>
            {example === "electrons"
              ? ""
              : example === "water"
                ? "反应物 · 2H₂ + O₂"
                : example === "protein"
                  ? "折叠 → 展开"
                  : "完整肽链 + 水"}
          </span>
          <span>
            {example === "electrons"
              ? ""
              : example === "water"
                ? "产物 · 2H₂O"
                : example === "protein"
                  ? "展开 → 聚集"
                  : "两条较短的链"}
          </span>
        </div>
        {example === "electrons" ? (
          <WaterElectrons progress={progress} />
        ) : (
          <svg
            className="reaction-stage"
            viewBox="0 0 900 420"
            role="img"
            aria-label={`${scene.name}：${scene.stages[stage]}`}
            onPointerDown={(e) => {
              pointer.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!pointer.current) return;
              setRotation((r) => ({
                yaw: r.yaw + (e.clientX - pointer.current!.x) * 0.007,
                pitch: r.pitch + (e.clientY - pointer.current!.y) * 0.007,
              }));
              pointer.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              pointer.current = null;
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
          >
            <defs>
              <marker
                id="reaction-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9cfc5" />
              </marker>
              {Object.entries(ELEMENTS).map(([key, el]) => (
                <radialGradient
                  key={key}
                  id={`reaction-${key}`}
                  cx="30%"
                  cy="25%"
                >
                  <stop offset="0" stopColor="white" />
                  <stop offset=".6" stopColor={el.color} />
                  <stop
                    offset="1"
                    stopColor={key === "H" ? "#a3b8c8" : el.color}
                  />
                </radialGradient>
              ))}
            </defs>
            <line
              x1="80"
              y1="354"
              x2="820"
              y2="354"
              stroke="#dae5df"
              strokeWidth="2"
              markerEnd="url(#reaction-arrow)"
            />
            <circle cx={80 + progress * 730} cy="354" r="7" fill="#407f60" />
            {example === "water" ? (
              <>
                {WATER_INITIAL_BONDS.map((b, i) => renderWaterBond(b, i, true))}
                {WATER_FINAL_BONDS.map((b, i) => renderWaterBond(b, i, false))}
                {waterPoints
                  .map((p, i) => ({ ...p, i }))
                  .sort((a, b) => a.z - b.z)
                  .map((p) => (
                    <g key={p.i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={(WATER_ATOMS[p.i].element === "O" ? 24 : 18) * p.r}
                        fill={`url(#reaction-${WATER_ATOMS[p.i].element})`}
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y + 5}
                        textAnchor="middle"
                        fill="#263d48"
                        fontWeight="700"
                      >
                        {WATER_ATOMS[p.i].element}
                        <tspan fontSize="9" dy="5">
                          {p.i + 1}
                        </tspan>
                      </text>
                    </g>
                  ))}
                <text
                  x="450"
                  y="398"
                  textAnchor="middle"
                  fill="#60796d"
                  fontSize="14"
                >
                  四个氢 + 两个氧，全程守恒 · 小编号帮你追踪同一颗原子
                </text>
              </>
            ) : (
              <>
                {chains.map((chain, c) => (
                  <g key={c}>
                    {chain.slice(1).map((p, i) => {
                      const a = chain[i];
                      return (
                        <line
                          key={i}
                          x1={a.x}
                          y1={a.y}
                          x2={p.x}
                          y2={p.y}
                          stroke={proteinColors[c]}
                          strokeWidth="5"
                          opacity={broken && i === 8 ? 0 : 1}
                        />
                      );
                    })}
                    {chain.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={7 * p.r}
                        fill={proteinColors[c]}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    ))}
                  </g>
                ))}
                {example === "protein" && (
                  <g opacity={clampProgress((progress - 0.65) / 0.3)}>
                    {[4, 9, 14].flatMap((i) =>
                      [0, 1].map((c) => (
                        <line
                          key={`${i}-${c}`}
                          x1={chains[c][i].x}
                          y1={chains[c][i].y}
                          x2={chains[c + 1][i].x}
                          y2={chains[c + 1][i].y}
                          stroke="#879e85"
                          strokeDasharray="4 5"
                          strokeWidth="2"
                        />
                      )),
                    )}
                  </g>
                )}
                {example === "hydrolysis" && (
                  <>
                    {!broken ? (
                      <text
                        x="450"
                        y={mix(90, 155, progress / 0.6)}
                        textAnchor="middle"
                        fill="#4d8499"
                        fontSize="22"
                      >
                        H₂O
                      </text>
                    ) : (
                      <>
                        <text
                          x={chains[0][8].x - 5}
                          y={chains[0][8].y - 20}
                          textAnchor="middle"
                          fill="#c16853"
                          fontSize="16"
                        >
                          –COOH
                        </text>
                        <text
                          x={chains[0][9].x + 12}
                          y={chains[0][9].y - 20}
                          textAnchor="middle"
                          fill="#4d8499"
                          fontSize="16"
                        >
                          H₂N–
                        </text>
                      </>
                    )}
                  </>
                )}
                <text
                  x="450"
                  y="398"
                  textAnchor="middle"
                  fill="#60796d"
                  fontSize="14"
                >
                  {example === "protein"
                    ? "三条蛋白质链 · 实线：肽链骨架保持完整 · 虚线：链间相互作用"
                    : "一颗珠子 = 一个氨基酸残基 · 只演示一个肽键的水解"}
                </text>
              </>
            )}
          </svg>
        )}
        {example !== "electrons" && (
          <div className="reaction-drag-hint">
            <Move3D size={15} />
            拖动模型，换个角度观察
          </div>
        )}
        {example !== "electrons" && controls}
      </section>
      <section className="reaction-explanation" aria-live="polite">
        <div>
          <span className="chem-eyebrow">STEP 0{stage + 1}</span>
          <h3>{scene.stages[stage]}</h3>
          <p>{scene.descriptions[stage]}</p>
        </div>
        <aside>
          <strong>
            {example === "electrons"
              ? "共用电子，不会复制电子"
              : example === "protein"
                ? "展开 ≠ 剪断"
                : example === "hydrolysis"
                  ? "水解 ≠ 仅仅加热"
                  : "连接改变，原子守恒"}
          </strong>
          <p>{scene.note}</p>
          {example === "electrons" && (
            <a
              href="https://wou.edu/chemistry/files/2019/04/CH103-Allied-Health-Chemistry-PDF-Version.pdf"
              target="_blank"
              rel="noreferrer"
            >
              延伸阅读：Western Oregon University · Electron Sharing ↗
            </a>
          )}
          {(example === "protein" || example === "hydrolysis") && (
            <a
              href="https://annex.exploratorium.edu/cooking/meat/INT-what-is-meat.html"
              target="_blank"
              rel="noreferrer"
            >
              延伸阅读：Exploratorium · 肉的科学 ↗
            </a>
          )}
        </aside>
      </section>
    </div>,
  );
}
