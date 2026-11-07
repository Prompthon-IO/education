import { translateChem, useChemLanguage } from "./chem-language";
import { useState, useRef, type CSSProperties } from "react";
import { Search, RotateCcw, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ELEMENT_FAMILIES,
  PERIODIC_ELEMENTS,
  matchesElement,
} from "./periodic-table";
import "./periodic-table.css";
export function PeriodicTable() {
  const { localize } = useChemLanguage();
  const detailRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(6);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [charge, setCharge] = useState(0);
  const element = PERIODIC_ELEMENTS[selected - 1];
  const category = ELEMENT_FAMILIES[element.family];
  const matches = PERIODIC_ELEMENTS.filter((e) =>
    matchesElement(e, translateChem(query, "en"), family),
  );
  const choose = (n: number, reveal = false) => {
    setSelected(n);
    setCharge(0);
    if (reveal)
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  };
  const clear = () => {
    setQuery("");
    setFamily("all");
  };
  return localize(
    <section className="periodic-app" lang="en">
      <div className="periodic-heading">
        <div>
          <span className="chem-eyebrow">
            118 ELEMENTS · ONE WORLD TO EXPLORE
          </span>
          <h2>Periodic Table of the Elements</h2>
          <p>Choose an element. Discover what makes every atom unique.</p>
        </div>
        <span className="periodic-count">{matches.length} / 118 elements</span>
      </div>
      <div className="periodic-toolbar">
        <label className="periodic-search">
          <Search size={18} />
          <input
            aria-label="Search elements"
            placeholder="Name, symbol or atomic number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="periodic-filter">
          Category
          <select
            aria-label="Filter element category"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="all">All categories</option>
            {Object.entries(ELEMENT_FAMILIES).map(([key, v]) => (
              <option key={key} value={key}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={clear}>
          <RotateCcw size={15} />
          Clear filters
        </Button>
      </div>
      {(query || family !== "all") && (
        <div className="periodic-results" aria-live="polite">
          {matches.length ? (
            <>
              <span>Matching elements:</span>
              {matches.map((e) => (
                <button key={e.number} onClick={() => choose(e.number, true)}>
                  {e.symbol} · {e.name}
                </button>
              ))}
            </>
          ) : (
            <p>
              No elements found. Try “oxygen”, “O” or “8”, or clear the filters.
            </p>
          )}
        </div>
      )}
      <p className="periodic-scroll-hint">
        Columns are groups (1–18). Rows are periods (1–7). On small screens,
        swipe the table sideways.
      </p>
      <div
        className="periodic-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable periodic table"
      >
        <div className="periodic-grid">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={`group-${i}`}
              className="periodic-group"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {i + 1}
            </span>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={`period-${i}`}
              className="periodic-period"
              style={{ gridColumn: 1, gridRow: i + 2 }}
            >
              {i + 1}
            </span>
          ))}
          <div
            className="periodic-table-note"
            style={{ gridColumn: "4 / 14", gridRow: "2 / 4" }}
          >
            <strong>
              Small building blocks.
              <br />
              Endless possibilities.
            </strong>
            <span>Atomic number · Symbol · English name</span>
          </div>
          {PERIODIC_ELEMENTS.map((e) => {
            const f = ELEMENT_FAMILIES[e.family];
            return (
              <button
                key={e.number}
                className={`periodic-cell ${selected === e.number ? "selected" : ""} ${matchesElement(e, translateChem(query, "en"), family) ? "" : "dimmed"}`}
                style={
                  {
                    gridColumn: e.column + 1,
                    gridRow: e.row + 1,
                    "--element-bg": f.color,
                    "--element-ink": f.ink,
                  } as CSSProperties
                }
                aria-label={`${e.number} ${e.name} ${e.symbol}`}
                aria-pressed={selected === e.number}
                onClick={() => choose(e.number, true)}
              >
                <small>{e.number}</small>
                <strong>{e.symbol}</strong>
                <span>{e.name}</span>
              </button>
            );
          })}
          <div
            className="periodic-series"
            style={{ gridColumn: 4, gridRow: 7 }}
          >
            57–71
            <br />
            La–Lu ↓
          </div>
          <div
            className="periodic-series"
            style={{ gridColumn: 4, gridRow: 8 }}
          >
            89–103
            <br />
            Ac–Lr ↓
          </div>
          <span
            className="periodic-series-label"
            style={{ gridColumn: "1 / 4", gridRow: 10 }}
          >
            Lanthanoids
          </span>
          <span
            className="periodic-series-label"
            style={{ gridColumn: "1 / 4", gridRow: 11 }}
          >
            Actinoids
          </span>
        </div>
      </div>
      <div className="periodic-legend" aria-label="Element categories">
        {Object.entries(ELEMENT_FAMILIES).map(([key, f]) => (
          <button
            key={key}
            aria-pressed={family === key}
            onClick={() => setFamily(family === key ? "all" : key)}
          >
            <i style={{ background: f.color }} />
            {f.name}
          </button>
        ))}
      </div>
      <section
        ref={detailRef}
        className="periodic-details"
        aria-label="Selected element details"
        aria-live="polite"
      >
        <div
          className="periodic-identity"
          style={{ background: category.color, color: category.ink }}
        >
          <span>ATOMIC NUMBER {element.number}</span>
          <strong>{element.symbol}</strong>
          <h3>{element.name}</h3>
          <p>{category.name}</p>
          <div>
            <Button
              variant="ghost"
              aria-label="Previous element"
              disabled={selected === 1}
              onClick={() => choose(selected - 1)}
            >
              <ArrowLeft size={18} />
            </Button>
            <Button
              variant="ghost"
              aria-label="Next element"
              disabled={selected === 118}
              onClick={() => choose(selected + 1)}
            >
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
        <div className="periodic-facts">
          <span className="chem-eyebrow">
            GET TO KNOW {element.symbol.toUpperCase()}
          </span>
          <h3>Its place in the table</h3>
          <dl>
            <div>
              <dt>Atomic number</dt>
              <dd>{element.number}</dd>
            </div>
            <div>
              <dt>
                {element.mass.startsWith("[")
                  ? "Isotope mass number"
                  : "Atomic weight (abridged)"}
              </dt>
              <dd>{element.mass}</dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{element.period}</dd>
            </div>
            <div>
              <dt>Group</dt>
              <dd>{element.group ?? "Shown in separate series"}</dd>
            </div>
          </dl>
          <p>{category.description}</p>
          <small>
            {element.mass.startsWith("[")
              ? "Brackets give the mass number of a selected isotope, not an average atomic weight."
              : "Atomic weight is a relative average based on isotopes. It is not the number of protons plus neutrons in every atom."}{" "}
            Values follow the IUPAC 4 May 2022 table; uncertainties are omitted
            here.
          </small>
        </div>
        <div className="periodic-atom">
          <span className="chem-eyebrow">TRY IT / ELECTRONS & CHARGE</span>
          <h3>Build an atom or ion</h3>
          <div className="periodic-charge">
            <strong>
              {element.symbol}
              <sup>
                {charge === 0
                  ? ""
                  : `${Math.abs(charge) === 1 ? "" : Math.abs(charge)}${charge > 0 ? "+" : "−"}`}
              </sup>
            </strong>
            <span>
              {charge === 0
                ? "Neutral atom"
                : charge > 0
                  ? "Positive ion"
                  : "Negative ion"}
            </span>
          </div>
          <dl>
            <div>
              <dt>Protons</dt>
              <dd>{element.number}</dd>
            </div>
            <div>
              <dt>Electrons</dt>
              <dd>{element.number - charge}</dd>
            </div>
            <div>
              <dt>Net charge</dt>
              <dd>
                {charge > 0 ? "+" : ""}
                {charge}
              </dd>
            </div>
          </dl>
          <div className="periodic-electron-controls">
            <button
              disabled={charge >= 3 || element.number - charge === 0}
              onClick={() => setCharge((c) => c + 1)}
            >
              − Electron
            </button>
            <button
              disabled={charge <= -3}
              onClick={() => setCharge((c) => c - 1)}
            >
              + Electron
            </button>
            <button onClick={() => setCharge(0)}>Reset</button>
          </div>
          <p>
            Changing electrons changes the charge. The proton count still
            identifies {element.name}.
          </p>
          <small>
            A charge-counting model, not a prediction of which ions are stable.
            Neutron numbers depend on the isotope.
          </small>
        </div>
      </section>
      <footer className="periodic-source">
        Names, symbols and mass values:{" "}
        <a
          href="https://iupac.org/wp-content/uploads/2022/07/IUPAC_Periodic_Table-04May22_CRA.pdf"
          target="_blank"
          rel="noreferrer"
        >
          IUPAC Periodic Table (4 May 2022) ↗
        </a>
        . Colors are teaching categories; some boundaries vary between
        references. The detached rows belong to periods 6 and 7.
      </footer>
    </section>,
  );
}
