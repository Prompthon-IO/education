import { clampProgress, mix } from "./reaction-animation";
export type ElectronFocus = "all" | "oxygen" | "left" | "right";
export type TeachingElectron = {
  id: string;
  origin: "oxygen" | "hydrogen";
  kind: "core" | "lone" | "shared";
  side?: "left" | "right";
  x: number;
  y: number;
};
// Lewis-style bookkeeping: 8 distinct valence electrons plus 2 oxygen core electrons.
export function waterElectronModel(progress: number) {
  const t = clampProgress((progress - 0.2) / 0.55);
  const distance = mix(300, 170, t);
  const electrons: TeachingElectron[] = [
    { id: "core-1", origin: "oxygen", kind: "core", x: 416, y: 215 },
    { id: "core-2", origin: "oxygen", kind: "core", x: 484, y: 215 },
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((offset) => ({
        id: `lone-${side}-${offset}`,
        origin: "oxygen" as const,
        kind: "lone" as const,
        x: 450 + offset * 9,
        y: 215 + side * 104,
      })),
    ),
    ...(["left", "right"] as const).flatMap((side, i) => {
      const sign = i === 0 ? -1 : 1;
      return [
        {
          id: `oxygen-${side}`,
          origin: "oxygen" as const,
          kind: "shared" as const,
          side,
          x: 450 + sign * mix(110, 100, t),
          y: mix(215, 207, t),
        },
        {
          id: `hydrogen-${side}`,
          origin: "hydrogen" as const,
          kind: "shared" as const,
          side,
          x: 450 + sign * mix(220, 100, t),
          y: mix(215, 223, t),
        },
      ];
    }),
  ];
  return { distance, electrons, complete: t === 1 };
}
export function countedElectrons(focus: ElectronFocus, complete: boolean) {
  if (focus === "all") return 8;
  if (focus === "oxygen") return complete ? 8 : 6;
  return complete ? 2 : 1;
}
export function isCountedElectron(
  e: TeachingElectron,
  focus: ElectronFocus,
  complete: boolean,
) {
  if (e.kind === "core") return false;
  if (focus === "all") return true;
  if (focus === "oxygen") return e.origin === "oxygen" || complete;
  return e.side === focus && (complete || e.origin === "hydrogen");
}
