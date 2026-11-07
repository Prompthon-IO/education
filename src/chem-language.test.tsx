import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { ChemLanguageProvider, translateChem } from "./chem-language";
import { PERIODIC_ELEMENTS, ELEMENT_FAMILIES } from "./periodic-table";
import { PeriodicTable } from "./PeriodicTable";
import { WaterElectrons } from "./WaterElectrons";
import { ProteinOrigin } from "./ProteinOrigin";
import catalog from "./data/proteins/catalog.json";
import origins from "./data/proteins/origins.json";
const han = /\p{Script=Han}/u;
afterEach(() => vi.unstubAllGlobals());
describe("Chemistry Lab language and source images", () => {
  it("translates every Chinese teaching string and all 20 protein descriptions", () => {
    for (const file of [
      "ChemistryLab.tsx",
      "ProteinExplorer.tsx",
      "ProteinLibrary.tsx",
      "ProteinOrigin.tsx",
      "ReactionAnimation.tsx",
      "WaterElectrons.tsx",
      "chemistry.ts",
      "reaction-animation.ts",
      "electron-model.ts",
      "protein-model.ts",
    ]) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(`src/${file}`, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (n: ts.Node) => {
        if (
          ts.isStringLiteral(n) ||
          ts.isJsxText(n) ||
          ts.isNoSubstitutionTemplateLiteral(n) ||
          ts.isTemplateHead(n) ||
          ts.isTemplateMiddle(n) ||
          ts.isTemplateTail(n)
        ) {
          if (han.test(n.text))
            expect(
              translateChem(n.text, "en"),
              `${file}: ${n.text}`,
            ).not.toMatch(han);
        }
        ts.forEachChild(n, visit);
      };
      visit(tree);
    }
    for (const p of catalog)
      for (const key of [
        "zh",
        "category",
        "location",
        "description",
        "scope",
      ] as const)
        expect(translateChem(p[key], "en"), p[key]).not.toMatch(han);
  });
  it("has Chinese names for all 118 elements and explanations for every category", () => {
    for (const p of PERIODIC_ELEMENTS)
      expect(translateChem(p.name, "zh"), p.name).toMatch(han);
    for (const p of Object.values(ELEMENT_FAMILIES))
      expect(translateChem(p.description, "zh")).toMatch(han);
    expect(translateChem("氧", "en")).toBe("Oxygen");
    expect(translateChem("H₂O + CO₂ → H₂CO₃", "en")).toBe("H₂O + CO₂ → H₂CO₃");
  });
  it("renders English-only teaching content and bilingual paired explanations", () => {
    vi.stubGlobal("localStorage", { getItem: () => "en" });
    const html = renderToStaticMarkup(
      <ChemLanguageProvider>
        <WaterElectrons progress={1} />
        <PeriodicTable />
      </ChemLanguageProvider>,
    );
    expect(html).not.toMatch(han);
    expect(html).toContain("Why 2?");
    expect(html).toContain("Carbon");
    vi.stubGlobal("localStorage", { getItem: () => "both" });
    const dual = renderToStaticMarkup(
      <ChemLanguageProvider>
        <WaterElectrons progress={1} />
      </ChemLanguageProvider>,
    );
    expect(dual).toContain("为什么是 2");
    expect(dual).toContain("Why 2?");
    expect(dual).toContain('lang="en"');
  });
  it("gives every protein a real bundled source image with attribution and a translated caption", () => {
    for (const p of catalog) {
      const image = origins[p.pdb as keyof typeof origins];
      expect(image).toBeDefined();
      expect(existsSync(`public${image.src}`)).toBe(true);
      expect(readFileSync(`public${image.src}`).length).toBeGreaterThan(1000);
      expect(image.source).toContain("commons.wikimedia.org/wiki/File:");
      expect(image.author.length).toBeGreaterThan(0);
      expect(image.license.length).toBeGreaterThan(0);
      expect(translateChem(image.caption, "en")).toBe(image.captionEn);
      expect(renderToStaticMarkup(<ProteinOrigin pdb={p.pdb} />)).toContain(
        image.src,
      );
    }
  });
});
