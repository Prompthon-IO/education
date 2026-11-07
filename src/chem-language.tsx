import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import dictionary from "./i18n/chemistry-zh-en.tsv?raw";
export type ChemLanguage = "zh" | "en" | "both";
const pairs = dictionary
  .trim()
  .split("\n")
  .map((line) => line.split("\t") as [string, string]);
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
const en = new Map(pairs.map(([a, b]) => [normalize(a), normalize(b)]));
const zh = new Map(pairs.map(([a, b]) => [normalize(b), normalize(a)]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const zhPattern = new RegExp(
  [...en.keys()]
    .filter((s) => /\p{Script=Han}/u.test(s))
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|"),
  "gu",
);
const enPattern = new RegExp(
  "(?<![A-Za-z])(?:" +
    [...zh.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|") +
    ")(?![A-Za-z])",
  "g",
);
export function translateChem(text: string, language: "zh" | "en"): string {
  const normalized = normalize(text);
  if (language === "zh" && /\p{Script=Han}/u.test(normalized))
    return normalized;
  const map = language === "en" ? en : zh;
  const exact = map.get(normalized);
  if (exact) return exact;
  return normalized
    .replace(
      language === "en" ? zhPattern : enPattern,
      (match) => ` ${map.get(match) ?? match} `,
    )
    .replace(/ +/g, " ")
    .trim();
}
const Context = createContext<{
  language: ChemLanguage;
  setLanguage: (v: ChemLanguage) => void;
}>({ language: "both", setLanguage: () => {} });
export function ChemLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState<ChemLanguage>(() => {
    try {
      const saved = localStorage.getItem("chem-language");
      return saved === "en" || saved === "zh" || saved === "both"
        ? saved
        : "both";
    } catch {
      return "both";
    }
  });
  const setLanguage = (value: ChemLanguage) => {
    setValue(value);
    try {
      localStorage.setItem("chem-language", value);
    } catch {
      /* Storage may be disabled. */
    }
  };
  return (
    <Context.Provider value={{ language, setLanguage }}>
      <div
        className={`chem-language-${language}`}
        lang={language === "en" ? "en" : "zh-CN"}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function ChemLanguageSwitch() {
  const { language, setLanguage } = useContext(Context);
  return (
    <div
      className="chem-language-switch"
      role="group"
      aria-label="Language / 语言"
    >
      {(
        [
          ["zh", "中文"],
          ["en", "English"],
          ["both", "中英对照"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          aria-pressed={language === value}
          onClick={() => setLanguage(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function useChemLanguage() {
  const { language } = useContext(Context);
  const text = (value: string) => {
    const a = translateChem(value, "zh"),
      b = translateChem(value, "en");
    return language === "en"
      ? b
      : language === "zh"
        ? a
        : a === b
          ? a
          : `${a} / ${b}`;
  };
  const localize = (node: ReactNode, inSvg = false): ReactNode => {
    if (typeof node === "string") {
      if (!node.trim()) return node;
      const a = translateChem(node, "zh"),
        b = translateChem(node, "en");
      if (language !== "both" || a === b || inSvg) return text(node);
      return (
        <bdi className="chem-dual">
          <bdi lang="zh-CN">{a}</bdi>
          <bdi lang="en">{b}</bdi>
        </bdi>
      );
    }
    if (Array.isArray(node)) {
      // Join adjacent text and values so dynamic sentences translate as a unit.
      const joined: ReactNode[] = [];
      for (const part of node) {
        if (typeof part === "string" || typeof part === "number") {
          const last = joined.length - 1;
          if (last >= 0 && typeof joined[last] === "string")
            joined[last] = String(joined[last]) + part;
          else joined.push(String(part));
        } else joined.push(part);
      }
      return Children.map(joined, (child) => localize(child, inSvg));
    }
    if (!isValidElement(node)) return node;
    const element = node as ReactElement<Record<string, unknown>>;
    // The switch owns its labels and must remain recognizable in every language.
    if (element.type === ChemLanguageSwitch) return element;
    const svg = inSvg || element.type === "svg";
    if (inSvg && element.type === "text" && language === "both") {
      const parts = Children.toArray(element.props.children as ReactNode);
      if (parts.every((p) => typeof p === "string" || typeof p === "number")) {
        const raw = parts.join(""),
          a = translateChem(raw, "zh"),
          b = translateChem(raw, "en");
        if (a !== b) {
          const fontSize = Math.min(14, Number(element.props.fontSize) || 14);
          return cloneElement(
            element,
            {},
            <>
              <tspan x={element.props.x as number} dy="0" fontSize={fontSize}>
                {a}
              </tspan>
              <tspan
                x={element.props.x as number}
                dy={fontSize + 3}
                fontSize={fontSize * 0.84}
                textLength={b.length > 120 ? 790 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {b}
              </tspan>
            </>,
          );
        }
      }
    }

    const props: Record<string, unknown> = {};
    for (const key of ["aria-label", "title", "placeholder", "alt"])
      if (typeof element.props[key] === "string")
        props[key] = text(element.props[key] as string);
    if (element.props.lang) props.lang = language === "en" ? "en" : "zh-CN";
    if (element.props.children !== undefined)
      props.children = localize(
        element.props.children as ReactNode,
        svg || element.type === "option",
      );
    return cloneElement(element, props);
  };
  return { language, text, localize };
}
