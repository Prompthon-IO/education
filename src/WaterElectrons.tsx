import { useChemLanguage } from "./chem-language";
import { useState } from "react";
import {
  waterElectronModel,
  countedElectrons,
  isCountedElectron,
  type ElectronFocus,
} from "./electron-model";
import "./water-electrons.css";
export function WaterElectrons({ progress }: { progress: number }) {
  const { localize } = useChemLanguage();
  const [focus, setFocus] = useState<ElectronFocus>("all");
  const [showCore, setShowCore] = useState(true);
  const model = waterElectronModel(progress);
  const moving = progress > 0.2 && !model.complete;
  const label =
    focus === "all"
      ? "独立的外层电子"
      : focus === "oxygen"
        ? "计入氧外层的电子"
        : `计入${focus === "left" ? "左" : "右"}侧氢的电子`;
  return localize(
    <section className="electron-view" aria-label="水分子外层电子动画">
      <div className="electron-view-heading">
        <div>
          <strong>成键放大镜 · 每一个电子都看得见</strong>
          <p>点选原子，跟着高亮小点数一数。</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={showCore}
            onChange={(e) => setShowCore(e.target.checked)}
          />
          显示氧的内层 2 个电子
        </label>
      </div>
      <div className="electron-focus" aria-label="选择电子计数对象">
        {(
          [
            ["all", "全部外层电子"],
            ["left", "左侧 H"],
            ["oxygen", "氧 O"],
            ["right", "右侧 H"],
          ] as const
        ).map(([key, title]) => (
          <button
            key={key}
            aria-pressed={focus === key}
            onClick={() => setFocus(key)}
          >
            {title}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 900 445"
        className="electron-canvas"
        role="group"
        aria-label={
          model.complete
            ? "两个氢分别共用一对电子，氧周围八个电子"
            : "氢各有一个电子，氧外层六个电子，观察共用过程"
        }
      >
        <text x="450" y="31" textAnchor="middle" fill="#547964" fontSize="16">
          {model.complete
            ? "同一对共用电子，同时计入两侧原子"
            : moving
              ? "电子逐渐形成共用对 · 不代表真实运动轨迹"
              : "起点：分开画的原子 · 用来解释成键计数"}
        </text>
        <circle
          cx="450"
          cy="215"
          r="110"
          fill={focus === "oxygen" ? "#e7f2e480" : "#e7f2e430"}
          stroke={focus === "oxygen" ? "#58966a" : "#a1bba4"}
          strokeWidth="2"
        />
        {showCore && (
          <circle
            cx="450"
            cy="215"
            r="34"
            fill="none"
            stroke="#b5c4ca"
            strokeDasharray="3 4"
          />
        )}
        {(["left", "right"] as const).map((side, i) => {
          const x = 450 + (i === 0 ? -1 : 1) * model.distance;
          return (
            <g key={side}>
              <circle
                cx={x}
                cy="215"
                r="80"
                fill={focus === side ? "#fae9c870" : "#fae9c830"}
                stroke={focus === side ? "#c29435" : "#dbc28f"}
                strokeWidth="2"
              />
              <g
                role="button"
                tabIndex={0}
                aria-label={`选择${i === 0 ? "左" : "右"}侧氢的电子`}
                onClick={() => setFocus(side)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFocus(side);
                  }
                }}
              >
                <circle cx={x} cy="215" r="25" fill="#ecd7a5" />
                <text
                  x={x}
                  y="222"
                  textAnchor="middle"
                  fontSize="23"
                  fill="#715226"
                  fontWeight="700"
                >
                  H
                </text>
              </g>
              <text
                x={x}
                y="335"
                textAnchor="middle"
                fill="#856e41"
                fontSize="15"
              >
                {model.complete
                  ? "H：2 / 2 ✓"
                  : moving
                    ? "H：正在共用…"
                    : "H：1 / 2"}
              </text>
            </g>
          );
        })}
        <g
          role="button"
          tabIndex={0}
          aria-label="选择氧的外层电子"
          onClick={() => setFocus("oxygen")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFocus("oxygen");
            }
          }}
        >
          <circle cx="450" cy="215" r="24" fill="#e8a39a" />
          <text
            x="450"
            y="222"
            textAnchor="middle"
            fontSize="23"
            fill="#84453e"
            fontWeight="700"
          >
            O
          </text>
        </g>
        {model.complete &&
          [-1, 1].map((side) => (
            <rect
              key={side}
              x={450 + side * 100 - 14}
              y="192"
              width="28"
              height="46"
              rx="14"
              fill="#d9bd6630"
              stroke="#b8993c"
              strokeDasharray="4 3"
            />
          ))}
        {model.electrons
          .filter((e) => showCore || e.kind !== "core")
          .map((e) => {
            const active = isCountedElectron(e, focus, model.complete);
            return (
              <g key={e.id} opacity={focus === "all" || active ? 1 : 0.2}>
                <circle
                  cx={e.x}
                  cy={e.y}
                  r={e.kind === "core" ? 4 : 7}
                  fill={
                    e.kind === "core"
                      ? "#8797a7"
                      : e.origin === "oxygen"
                        ? "#3b9b86"
                        : "#d6a240"
                  }
                  stroke="white"
                  strokeWidth="2"
                />
                {active && focus !== "all" && (
                  <circle
                    cx={e.x}
                    cy={e.y}
                    r="11"
                    stroke="#365d48"
                    strokeWidth="1.5"
                    fill="none"
                  />
                )}
              </g>
            );
          })}
        <text x="450" y="360" textAnchor="middle" fill="#48735a" fontSize="16">
          {model.complete
            ? "O：8 / 8 ✓（4 个独有 + 4 个共用）"
            : moving
              ? "O：正在形成两对共用电子…"
              : "O：外层 6 / 8，内层已有 2"}
        </text>
        <text x="450" y="404" textAnchor="middle" fill="#809487" fontSize="13">
          圆圈表示电子层的计数范围，不是电子运行轨道；水的实际分子形状为折线形。
        </text>
      </svg>
      <div className="electron-ledger" aria-live="polite">
        <strong>
          {label}：
          {moving && focus !== "all"
            ? "形成中"
            : countedElectrons(focus, model.complete)}
        </strong>
        <span>实际总数始终为 10：8 个外层电子 + 2 个氧内层电子</span>
        <p>
          {model.complete
            ? "8 + 2 + 2 不能当成实际总数：共用电子在两个原子周围各数一次，没有复制，也没有变多。"
            : "氧贡献 6 个外层电子，每个氢贡献 1 个。播放动画，看看它们怎样组成两对共用电子。"}
        </p>
      </div>
      <div className="electron-key">
        <span>
          <i style={{ background: "#3b9b86" }} />
          来自氧的电子
        </span>
        <span>
          <i style={{ background: "#d6a240" }} />
          来自氢的电子
        </span>
        <span>
          <i style={{ background: "#8797a7" }} />
          氧的内层电子
        </span>
        <small>颜色只帮助追踪来源，所有电子本质相同。</small>
      </div>
      <div className="electron-why">
        <article>
          <b>为什么是 2？</b>
          <p>
            氢只涉及第一层的 1s 轨道，它最多容纳 2
            个电子。共用一对电子后，氢满足二电子规则（duet）。
          </p>
        </article>
        <article>
          <b>为什么常见的是 8？</b>
          <p>
            氧的第二层有 1 个 s 轨道和 3 个 p 轨道，每个最多容纳 2 个电子：4 × 2
            = 8。这对应八电子规则（octet）。
          </p>
        </article>
        <article>
          <b>“稳定”是什么意思？</b>
          <p>
            成键后的体系可以比相应的分离原子能量更低。2 和 8
            是有用的电子计数规律，不是所有反应的唯一原因，也不是“永不反应”。
          </p>
        </article>
      </div>
    </section>,
  );
}
