import { ProteinOrigin } from "./ProteinOrigin";
import { translateChem, useChemLanguage } from "./chem-language";
import { useEffect, useState } from "react";
import catalog from "./data/proteins/catalog.json";
import { ProteinStructure } from "./ProteinExplorer";
import type { Protein } from "./protein-model";
import "./protein-explorer.css";

const structures = import.meta.glob<{ default: Protein }>([
  "./data/proteins/*.json",
  "!./data/proteins/catalog.json",
  "!./data/proteins/crambin.json",
  "!./data/proteins/origins.json",
]);
export function ProteinExplorer() {
  const { localize } = useChemLanguage();
  const [selected, setSelected] = useState(catalog[0].pdb);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [loaded, setLoaded] = useState<Protein | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const entry = catalog.find((p) => p.pdb === selected)!;
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError(false);
    structures[`./data/proteins/${selected.toLowerCase()}.json`]()
      .then((module) => {
        if (active) setLoaded(module.default);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [selected, retry]);
  const choose = (id: string) => {
    setSelected(id);
    setExpanded(false);
  };
  const matches = catalog.filter((p) =>
    `${p.name} ${p.zh} ${p.location} ${p.category} ${p.pdb} ${translateChem(p.location, "en")} ${translateChem(p.category, "en")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return localize(
    <div className="protein-library">
      <div className="protein-library-heading">
        <div>
          <span className="chem-eyebrow">
            20 REAL PROTEINS · EXPERIMENTAL STRUCTURES
          </span>
          <h2>探索蛋白质的形状</h2>
          <p>
            从种子到肌肉，从细菌到人体。选一个真实结构，转一转，再拆开看看。
          </p>
        </div>
        <button
          className="protein-library-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起结构库" : "浏览全部 20 种蛋白质"}
        </button>
      </div>
      {expanded && (
        <section aria-label="蛋白质结构库">
          <label className="protein-library-search">
            查找蛋白质
            <input
              type="search"
              placeholder="名字、出现位置或 PDB 编号…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span>{matches.length} / 20</span>
          </label>
          <div className="protein-library-grid">
            {matches.map((p, index) => (
              <button
                key={p.pdb}
                className="protein-library-card"
                aria-pressed={selected === p.pdb}
                onClick={() => choose(p.pdb)}
                aria-label={`查看 ${p.zh}`}
              >
                <ProteinOrigin key={p.pdb} pdb={p.pdb} compact />
                <div className="protein-library-preview">
                  <svg viewBox="0 0 160 104" aria-hidden="true">
                    {p.peptideBonds.map(([a, b], i) => (
                      <line
                        key={i}
                        x1={p.preview[a][0]}
                        y1={p.preview[a][1]}
                        x2={p.preview[b][0]}
                        y2={p.preview[b][1]}
                        stroke={`hsl(${145 + index * 9} 30% 48%)`}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                  <span>{p.category}</span>
                </div>
                <strong>{p.zh}</strong>

                <p>{p.location}</p>
                <small>
                  {p.pdb} · {p.count} 残基 · {p.scope}
                </small>
              </button>
            ))}
          </div>
          {!matches.length && (
            <p role="status">没有匹配的蛋白质，试试“肌肉”或“酶”。</p>
          )}
        </section>
      )}
      <section className="protein-description" aria-label="当前蛋白质介绍">
        <ProteinOrigin key={selected} pdb={selected} />
        <div>
          <span className="chem-eyebrow">NOW EXPLORING</span>
          <h3>{entry.zh}</h3>
          <p>{entry.description}</p>
        </div>
        <dl>
          <div>
            <dt>在哪里出现</dt>
            <dd>{entry.location}</dd>
          </div>
          <div>
            <dt>结构来源生物</dt>
            <dd>{entry.organism}</dd>
          </div>
          <div>
            <dt>当前展示范围</dt>
            <dd>
              链 {entry.chain} · {entry.scope} · {entry.count} 个已建模残基
            </dd>
          </div>
          <div>
            <dt>实验与来源</dt>
            <dd>
              {entry.method} ·{" "}
              <a href={entry.source} target="_blank" rel="noreferrer">
                PDB {entry.pdb} ↗
              </a>
            </dd>
          </div>
        </dl>
      </section>
      {error ? (
        <div role="alert">
          结构加载失败。
          <button onClick={() => setRetry((v) => v + 1)}>重试</button>
        </div>
      ) : loaded?.pdb === selected ? (
        <ProteinStructure key={selected} protein={loaded} />
      ) : (
        <p role="status">正在加载真实结构…</p>
      )}
    </div>,
  );
}
