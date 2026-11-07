import { useId } from "react";
import { fallShapeLabel, shapeDragCoefficient, type FallConfig } from "./fall-physics";

/** Symbols share a frontal width; their size is schematic, not a geometry solver. */
export function FallBody({ config, color, fill = color }: { config: FallConfig; color: string; fill?: string }) {
  switch (config.shape) {
    case "cone": return <g fill={fill} stroke={color} strokeWidth="1"><path d={config.coneOrientation === "tip-first" ? "M-14-25H14L0 13Z" : "M0-25L14 13H-14Z"} /><path d={config.coneOrientation === "tip-first" ? "M-14-25L0 13V-25Z" : "M0-25V13H-14Z"} fill="#ffffff" fillOpacity=".14" stroke="none" /><ellipse cy={config.coneOrientation === "tip-first" ? -25 : 13} rx="14" ry="3" fill={color} /></g>;
    case "cube": return <g stroke={color} strokeWidth="1"><path d="M-13-13H13V13H-13Z" fill={fill} /><path d="M-13-13L-6-20H20L13-13ZM13-13L20-20V6L13 13" fill={color} fillOpacity=".6" /></g>;
    case "plate": return <g fill={fill} stroke={color}><path d="M-14 7H14L20 2H-8Z" /><path d="M-14 7H14V13H-14Z" /><path d="M14 7L20 2V8L14 13Z" fill={color} /></g>;
    case "streamlined": return <g fill={fill} stroke={color}><path d="M-13-24H13V-1Q13 11 0 13Q-13 11-13-1Z" /><path d="M-7-18V-1Q-7 6-2 8" stroke="white" strokeOpacity=".35" strokeWidth="2" fill="none" /></g>;
    case "parachute": return <g><path d="M-35-42Q0-92 35-42Q22-51 12-42Q0-52-12-42Q-23-51-35-42" fill={color} opacity=".85" /><path d="M-35-42L-5-6M35-42L5-6M-12-42L-3-7M12-42L3-7" fill="none" stroke={color} strokeWidth="1" opacity=".7" /><circle r="10" fill={fill} stroke={color} /></g>;
    default: return <g><circle r="13" fill={fill} stroke={color} strokeWidth=".8" /><path d="M-5-7q-4 2-4 5" stroke="white" strokeOpacity=".7" strokeWidth="2" fill="none" strokeLinecap="round" /></g>;
  }
}

const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) => (1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3;

/** Illustrative streamlines and wake, moving upward relative to a falling body. */
export function FallAirflow({ config, time, speed = 10 }: { config: FallConfig; time: number; speed?: number }) {
  const air = config.airResistance && config.airDensity > 0;
  if (!air || speed <= 0) return null;
  const wake = 5 + Math.min(1.5, config.dragCoefficient) * 17;
  return <g aria-hidden="true" opacity=".65">
    <path d={`M-12-20Q${-wake - 4}-55 ${-wake}-82H${wake}Q${wake + 4}-55 12-20Z`} fill="#92cfd6" opacity=".06" />
    {[-1, 1].flatMap((side) => [0, 1, 2].map((lane) => {
      const start = 28 + lane * 13, spread = wake + lane * 10;
      const d = `M${side * start} 58C${side * start} 29 ${side * (start + 7)} 13 ${side * (start + 4)}-10C${side * (start + 4)}-34 ${side * spread}-53 ${side * spread}-84`;
      const u = ((time * Math.max(.08, Math.min(2, speed / 10)) + lane * .29 + (side === 1 ? .14 : 0)) % 1 + 1) % 1;
      const q = u < .5 ? u * 2 : (u - .5) * 2;
      const px = side * (u < .5 ? bezier(start, start, start + 7, start + 4, q) : bezier(start + 4, start + 4, spread, spread, q));
      const py = u < .5 ? bezier(58, 29, 13, -10, q) : bezier(-10, -34, -53, -84, q);
      return <g key={`${side}-${lane}`}><path d={d} fill="none" stroke="#86c4d5" strokeOpacity=".45" strokeWidth=".8" /><circle cx={px} cy={py} r="1.8" fill="#b0edf0" /></g>;
    }))}
    {config.dragCoefficient > .7 && [-1, 1].map((side) => <path key={side} d={`M${side * 12}-30c${side * wake}-18 ${side * wake}-40 ${side * 3}-35c${side * -12} 4 ${side * -6} 15 ${side * 1} 10`} stroke="#8dd4dc" strokeWidth="1" fill="none" strokeOpacity=".3" />)}
  </g>;
}

export function ShapeFlowPreview({ config, time }: { config: FallConfig; time: number }) {
  const id = useId().replace(/:/g, "");
  const sameCd = Math.abs(config.dragCoefficient - shapeDragCoefficient(config.shape, config.coneOrientation)) < 1e-6;
  const air = config.airResistance && config.airDensity > 0;
  return <div className="fall-shape-preview">
    <div><b>{fallShapeLabel(config)}</b><span>Cd {config.dragCoefficient.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} · {sameCd ? "teaching estimate" : "custom"}</span></div>
    <svg viewBox="0 0 240 172" role="img" aria-label={air ? `${fallShapeLabel(config)} with schematic upward relative airflow and ${config.dragCoefficient > .7 ? "broad" : "narrower"} wake. Frontal area held constant when choosing shapes.` : `${fallShapeLabel(config)} with air disabled. No airflow or aerodynamic drag.`}>
      <defs><linearGradient id={id}><stop stopColor="#c5f0df" /><stop offset="1" stopColor="#469f97" /></linearGradient></defs>
      <g transform="translate(111 93)"><FallAirflow config={config} time={time} /><FallBody config={config} color="#8bdccb" fill={`url(#${id})`} /></g>
      <path d="M25 135V96m-4 5 4-5 4 5" stroke="#95cfde" fill="none" />
      <text x="15" y="154" fill="#95b9c8" fontSize="8">{air ? "RELATIVE AIR ↑" : "AIR OFF"}</text>
      <path d="M207 80V121m-4-5 4 5 4-5" stroke="#ffb47b" fill="none" />
      <text x="192" y="137" fill="#ffb47b" fontSize="8">FALL ↓</text>
      <text x="111" y="14" textAnchor="middle" fill="#95b9c8" fontSize="8">{air ? "WAKE BEHIND THE BODY" : "NO AERODYNAMIC FORCE"}</text>
    </svg>
    <p>{air ? "Flow sketch at 10 m/s · not a fluid simulation. Wider wakes illustrate how shape can increase drag." : "Air off · changing shape alone cannot change the fall in vacuum."}</p>
  </div>;
}
