import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { circularSpeed, outsidePlanet, OUTCOME_LABELS, type MeteorConfig, type MeteorFrame, type MeteorRun, type Planet } from "./meteor-physics";

type Props = {
  planet: Planet; config: MeteorConfig; run: MeteorRun; frameIndex: number;
  onConfigChange: (config: MeteorConfig) => void;
  zoom: number; onZoomChange: (zoom: number) => void;
  prediction: boolean; grid: boolean; profile: boolean;
};
type Drag = { kind: "position" | "velocity"; matrix: DOMMatrix; scale: number; cx: number; cy: number; config: MeteorConfig; unitSpeed: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function MeteorScene(p: Props) {
  const svg = useRef<SVGSVGElement>(null), drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [placementMessage, setPlacementMessage] = useState("");
  useEffect(() => {
    const el = svg.current!;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  const { w, h } = size, cx = w / 2, cy = h / 2, scale = Math.min(w, h) / 14 * p.zoom;
  const gridStep = scale >= 18 ? 1 : scale >= 9 ? 2 : scale >= 4 ? 5 : 10 ** Math.ceil(Math.log10(20 / scale));
  const start = { x: cx + p.config.startX * scale, y: cy - p.config.startY * scale };
  const initialRadius = Math.hypot(p.config.startX, p.config.startY) * p.planet.radius;
  const unitSpeed = circularSpeed(p.planet, initialRadius) / 1000;
  const vectorLength = 30 + 52 * Math.min(3, p.config.speed / unitSpeed);
  const angle = p.config.angle * Math.PI / 180;
  const tip = { x: start.x + Math.cos(angle) * vectorLength, y: start.y - Math.sin(angle) * vectorLength };
  const frame = p.run.frames[p.frameIndex], complete = p.frameIndex === p.run.frames.length - 1;
  const maximumAltitude = useMemo(() => p.run.frames.reduce((maximum, f) => Math.max(maximum, f.altitude), 1) * 1.1, [p.run]);
  const captureIndex = useMemo(() => p.run.capture ? p.run.frames.findIndex((f) => f.t >= p.run.capture!.t) : -1, [p.run]);
  const endTime = p.run.frames[p.run.frames.length - 1].t;
  const timeUnit = endTime >= 86400 ? "d" : endTime >= 3600 ? "h" : endTime >= 120 ? "m" : "s";
  const timeDivisor = timeUnit === "d" ? 86400 : timeUnit === "h" ? 3600 : timeUnit === "m" ? 60 : 1;
  const project = (f: Pick<MeteorFrame, "x" | "y">) => ({ x: cx + f.x / p.planet.radius * scale, y: cy - f.y / p.planet.radius * scale });
  const current = project(frame);
  const path = (end: number, profile = false, startIndex = 0) => {
    const stride = Math.max(1, Math.ceil((end - startIndex) / 1800));
    const maximum = profile ? maximumAltitude : 1;
    const finish = p.run.frames[p.run.frames.length - 1].t;
    const points: string[] = [];
    const add = (f: MeteorFrame) => {
      const pt = profile ? { x: 58 + f.t / finish * (w - 90), y: h - 58 - f.altitude / Math.max(1, maximum) * (h - 135) } : project(f);
      points.push(`${pt.x.toFixed(2)},${pt.y.toFixed(2)}`);
    };
    for (let i = startIndex; i <= end; i += stride) add(p.run.frames[i]);
    add(p.run.frames[end]);
    return points.join(" ");
  };
  const bound = frame.speed ** 2 / 2 - p.planet.mu / Math.hypot(frame.x, frame.y) < 0;
  const color = bound ? "#7edbb5" : "#ffb273";
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(d.matrix);
    if (d.kind === "position") {
      const x = clamp((pt.x - d.cx) / d.scale, -12, 12), y = clamp((d.cy - pt.y) / d.scale, -12, 12);
      p.onConfigChange(outsidePlanet({ ...d.config, startX: Number(x.toFixed(3)), startY: Number(y.toFixed(3)) }));
    } else {
      const originX = d.cx + d.config.startX * d.scale, originY = d.cy - d.config.startY * d.scale;
      const dx = pt.x - originX, dy = originY - pt.y;
      const speed = clamp((Math.hypot(dx, dy) - 30) / 52 * d.unitSpeed, 0, 72);
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      p.onConfigChange({ ...d.config, speed: Number(speed.toFixed(3)), angle: Number(angle.toFixed(1)) });
    }
  };
  const begin = (e: PointerEvent, kind: Drag["kind"], place = false) => {
    if (p.profile || !svg.current) return;
    e.preventDefault(); e.stopPropagation();
    const matrix = svg.current.getScreenCTM()?.inverse(); if (!matrix) return;
    if (place) {
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
      if (Math.hypot(pt.x - cx, pt.y - cy) < scale * (1 + p.config.diameter / (2 * p.planet.radius) + .015)) {
        setPlacementMessage("Choose a starting point outside the planet."); return;
      }
    }
    setPlacementMessage("");
    drag.current = { kind, matrix, scale, cx, cy, config: p.config, unitSpeed };
    svg.current.setPointerCapture(e.pointerId);
    if (place) onMove(e as PointerEvent<SVGSVGElement>);
  };
  const positionKey = (key: string) => {
    const delta = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] }[key];
    if (!delta) return false;
    p.onConfigChange(outsidePlanet({ ...p.config, startX: clamp(p.config.startX + delta[0], -12, 12), startY: clamp(p.config.startY + delta[1], -12, 12) }));
    return true;
  };
  const fit = () => {
    let maxX = 2, maxY = 2;
    p.run.frames.forEach((f) => { maxX = Math.max(maxX, Math.abs(f.x / p.planet.radius)); maxY = Math.max(maxY, Math.abs(f.y / p.planet.radius)); });
    const base = Math.min(w, h) / 14;
    p.onZoomChange(clamp(Math.min((w - 100) / (2 * (maxX + .8) * base), (h - 110) / (2 * (maxY + .8) * base)), .01, 2.5));
  };
  const eventPoint = p.run.brakeEvent ? project(p.run.brakeEvent) : null;
  const gridLines = [];
  if (p.grid && !p.profile) {
    const limitX = Math.min(2000, Math.ceil(w / (2 * scale))), limitY = Math.min(2000, Math.ceil(h / (2 * scale)));
    const step = gridStep;
    for (let i = Math.ceil(-limitX / step) * step; i <= limitX; i += step) gridLines.push(<line key={`x${i}`} x1={cx + i * scale} x2={cx + i * scale} y1={0} y2={h} stroke={i === 0 ? "#7395ad2b" : "#65829a12"} />);
    for (let i = Math.ceil(-limitY / step) * step; i <= limitY; i += step) gridLines.push(<line key={`y${i}`} y1={cy + i * scale} y2={cy + i * scale} x1={0} x2={w} stroke={i === 0 ? "#7395ad2b" : "#65829a12"} />);
  }
  return <>
    <svg ref={svg} viewBox={`0 0 ${w} ${h}`} className="meteor-sandbox" aria-label={p.profile ? "Meteor altitude profile" : "2D orbital sandbox. Drag asteroid position and velocity handle."}
      onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <defs><marker id="meteor-velocity-tip" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6" fill="none" stroke="#ff9a50" strokeWidth="1.3" /></marker><clipPath id="meteor-flat-planet"><circle cx={cx} cy={cy} r={scale} /></clipPath></defs>
      <rect width={w} height={h} fill="#0b1726" onPointerDown={(e) => begin(e, "position", true)} />
      <g pointerEvents="none">{Array.from({ length: 65 }, (_, i) => <circle key={i} cx={((Math.sin(i * 17.34) + 1) / 2) * w} cy={((Math.sin(i * 33.71 + 4) + 1) / 2) * h} r={i % 5 === 0 ? 1 : .55} fill="#b2cee5" opacity={i % 5 === 0 ? .38 : .18} />)}{gridLines}</g>
      <g fontFamily="'Geist Variable',sans-serif" pointerEvents="none"><text x="20" y="26" fill="#b7ccdc" fontSize="10" letterSpacing="1.4" fontWeight="650">{p.profile ? "ALTITUDE THROUGH THE ENCOUNTER" : "MISS, HIT, OR BECOME A MOON?"}</text><text x="20" y="45" fill="#778fa7" fontSize="10">{p.profile ? "Altitude above the surface · km" : w < 620 ? "Drag asteroid / orange handle · click space to place" : "Drag the asteroid to place it · drag the orange handle to set velocity"}</text></g>
      {p.profile ? <g pointerEvents="none">
        {[0, 1, 2, 3, 4].map((i) => { const y = h - 58 - i / 4 * (h - 135); return <g key={i}><line x1="58" x2={w - 32} y1={y} y2={y} stroke="#7895aa24" /><text x="49" y={y + 3} textAnchor="end" fill="#7e98ad" fontSize="9">{Math.round(maximumAltitude / 1000 * i / 4)}</text><text x={58 + i / 4 * (w - 90)} y={h - 34} textAnchor="middle" fill="#7e98ad" fontSize="9">{Number((endTime * i / 4 / timeDivisor).toFixed(timeUnit === "s" ? 0 : 1))}{timeUnit}</text></g>; })}
        {p.prediction && <polyline points={path(p.run.frames.length - 1, true)} fill="none" stroke="#a7bfd94d" strokeDasharray="4 5" />}
        <polyline points={path(p.frameIndex, true)} fill="none" stroke={color} strokeWidth="2" />
        <circle cx={58 + frame.t / endTime * (w - 90)} cy={h - 58 - frame.altitude / maximumAltitude * (h - 135)} r="3.5" fill={color} />
      </g> : <>
        <g pointerEvents="none">
          {p.prediction && <polyline points={path(p.run.frames.length - 1)} fill="none" stroke={p.run.outcome === "satellite" ? "#7edbb550" : "#bbd3e54d"} strokeWidth="1.2" strokeDasharray="4 6" />}
          {captureIndex >= 0 && p.frameIndex >= captureIndex ? <><polyline points={path(captureIndex)} fill="none" stroke="#ffb273" strokeWidth="2.2" strokeLinejoin="round" /><polyline points={path(p.frameIndex, false, captureIndex)} fill="none" stroke="#7edbb5" strokeWidth="2.2" strokeLinejoin="round" /></> : <polyline points={path(p.frameIndex)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />}
          {p.config.atmosphere > 0 && p.planet.density > 0 && <circle cx={cx} cy={cy} r={scale + 4} fill="none" stroke={p.planet.color} strokeOpacity=".32" strokeWidth="3" />}
          <circle cx={cx} cy={cy} r={scale} fill={p.planet.color} stroke="#dae6ee66" strokeWidth="1" />
          <g clipPath="url(#meteor-flat-planet)" fill={p.planet.id === "earth" ? "#6eaa98" : "#ffffff"} opacity={p.planet.id === "earth" ? .85 : .18}>
            {p.planet.id === "earth" ? <><path d={`M ${cx - scale} ${cy - scale * .3} l ${scale * .6} ${-scale * .4} l ${scale * .3} ${scale * .4} l ${-scale * .3} ${scale * .6} l ${scale * .4} ${scale * .8} l ${-scale * .5} ${-scale * .2} Z`} /><path d={`M ${cx + scale * .2} ${cy - scale} l ${scale} ${scale * .5} l ${-scale * .4} ${scale * .4} l ${scale * .3} ${scale * .7} l ${-scale * .8} ${-scale * .1} Z`} /></> : <><circle cx={cx - scale * .35} cy={cy - scale * .22} r={scale * .35} /><circle cx={cx + scale * .3} cy={cy + scale * .4} r={scale * .43} /><circle cx={cx + scale * .4} cy={cy - scale * .45} r={scale * .18} /></>}
          </g>
          <text x={cx} y={cy + scale + 20} textAnchor="middle" fill="#bdcfdd" fontSize="11" fontWeight="600">{p.planet.name}</text>
          {eventPoint && (p.prediction || frame.t >= p.run.brakeEvent!.t) && <g><circle cx={eventPoint.x} cy={eventPoint.y} r="9" fill="#b59bff1a" stroke="#ba9fff" strokeDasharray={frame.t < p.run.brakeEvent!.t ? "3 3" : undefined} /><text x={eventPoint.x + 13} y={eventPoint.y - 12} fill="#c7b5ff" fontSize="9">Teaching brake −{Math.round(p.config.captureBrake * 100)}%</text></g>}
          {p.frameIndex > 0 && <circle cx={current.x} cy={current.y} r={Math.min(10, Math.max(4, 3 + Math.log10(p.config.diameter + 1)))} fill={frame.density > 1e-7 && frame.speed > 2000 ? "#ffe4b4" : "#ffc591"} stroke="#fff0d4" strokeWidth="1" />}
          {complete && p.run.outcome === "impact" && <g stroke="#ffa46a"><circle cx={current.x} cy={current.y} r="12" fill="none" /><path d={`M ${current.x - 17} ${current.y} h 34 M ${current.x} ${current.y - 17} v 34`} /></g>}
          <line x1={start.x} y1={start.y} x2={tip.x} y2={tip.y} stroke="#ff9a50" strokeWidth="1.8" markerEnd="url(#meteor-velocity-tip)" opacity={p.frameIndex > 0 ? .65 : 1} />
          <text x={tip.x + 10} y={tip.y - 9} fill="#f4b681" fontSize="10">{p.config.speed.toFixed(2)} km/s</text>
          <text x={start.x - 14} y={start.y + 25} fill="#91a7b8" fontSize="9">Start ({p.config.startX.toFixed(1)}, {p.config.startY.toFixed(1)}) R</text>
        </g>
        <g data-control="position" role="button" aria-label="Drag asteroid initial position" tabIndex={0} style={{ cursor: "grab" }} onPointerDown={(e) => begin(e, "position")} onKeyDown={(e) => { if (positionKey(e.key)) e.preventDefault(); }}>
          <circle cx={start.x} cy={start.y} r="18" fill="transparent" /><circle cx={start.x} cy={start.y} r="10" fill="#ff9a5014" stroke="#eaa46b99" strokeDasharray={p.frameIndex > 0 ? "3 3" : undefined} /><path d={`M ${start.x - 6} ${start.y - 4} l 7 -3 l 6 5 l -3 7 l -8 0 Z`} fill={p.frameIndex === 0 ? "#e9ba91" : "#b4c2ca55"} stroke="#ffdfb5" />
        </g>
        <g data-control="velocity" role="slider" aria-label="Drag initial velocity" aria-valuemin={0} aria-valuemax={72} aria-valuenow={p.config.speed} aria-valuetext={`${p.config.speed.toFixed(2)} km/s at ${p.config.angle.toFixed(0)} degrees`} tabIndex={0} style={{ cursor: "crosshair" }} onPointerDown={(e) => begin(e, "velocity")} onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); p.onConfigChange({ ...p.config, angle: (p.config.angle + (e.key === "ArrowRight" ? 5 : -5) + 360) % 360 }); }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); p.onConfigChange({ ...p.config, speed: clamp(p.config.speed + (e.key === "ArrowUp" ? .01 : -.01), 0, 72) }); }
        }}><circle cx={tip.x} cy={tip.y} r="17" fill="transparent" /><circle cx={tip.x} cy={tip.y} r="5" fill="#142335" stroke="#ffa365" strokeWidth="2" /></g>
      </>}
      <g pointerEvents="none" fontFamily="'Geist Variable',sans-serif"><text x="20" y={h - 31} fill="#94aabe" fontSize="9">{placementMessage || (p.profile ? "Playback follows simulated time." : `Grid: ${gridStep} planet radius (R) · asteroid / atmosphere outline enlarged`)}</text><text x="20" y={h - 15} fill="#647c93" fontSize="9">{p.config.captureBrake > 0 ? "Artificial brake enabled · no Charon / third-body dynamics" : "Two-body model · no Charon / third-body dynamics"}</text></g>
      {complete && <g pointerEvents="none"><rect x={w - 166} y="15" width="149" height="28" rx="5" fill="#172d3d" stroke="#4e6c8044" /><text x={w - 91} y="33" fill={p.run.outcome === "satellite" ? "#8de1bc" : "#f0b67d"} fontSize="10" textAnchor="middle">{OUTCOME_LABELS[p.run.outcome]}</text></g>}
    </svg>
    {!p.profile && <div className="meteor-view-controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => p.onZoomChange(clamp(p.zoom / 1.25, .01, 2.5))}>−</button><button onClick={fit}>Fit trajectory</button><button aria-label="Zoom in" title="Zoom in" onClick={() => p.onZoomChange(clamp(p.zoom * 1.25, .01, 2.5))}>+</button></div>}
  </>;
}
