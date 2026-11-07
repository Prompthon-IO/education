import { useId } from "react";
import { ArrowDown, Clock3, Wind } from "lucide-react";
import { fallFrame, fallMedium, fallShapeLabel, type FallSolution } from "./fall-physics";
import { FallAirflow, FallBody } from "./FallBody";

export const FALL_COLORS = ["#ffbd7a", "#81e0d0"];

export function FreeFallScene({ solutions, time, duration, forces, trails, onSelect, selected, airflow }: {
  solutions: FallSolution[]; time: number; duration: number; forces: boolean; trails: boolean;
  onSelect: (side: number) => void; selected: number; airflow: boolean;
}) {
  const maxHeight = Math.max(...solutions.map((s) => s.config.height));
  // One force scale for both sides; same-length arrows mean the same force.
  const maxWeight = Math.max(.01, ...solutions.map((s) => s.config.mass * s.config.gravity));
  return <div className="fall-scene">
    <div className="fall-scene-caption"><span><Clock3 size={12} /> SAME CLOCK{solutions.length === 2 ? " · SAME HEIGHT SCALE" : " · RELEASED FROM REST"}</span><b>t = {time.toFixed(2)} s</b></div>
    <div className={`fall-lanes ${solutions.length === 1 ? "fall-single" : ""}`}>
      {solutions.map((solution, i) => <FallLane key={i} solution={solution} side={i} time={time} maxHeight={maxHeight} maxWeight={maxWeight} forces={forces} trails={trails} selected={selected === i} onSelect={() => onSelect(i)} airflow={airflow} />)}
    </div>
    <div className="fall-legend"><span><i className="fall-weight-key" />Gravity pulls down</span><span><i className="fall-drag-key" />Air pushes up</span>{trails && <span className="fall-trail-key">··· Dots every 0.25 s</span>}{airflow && <span>Flow sketches · not CFD</span>}</div>
    <SpeedChart solutions={solutions} time={time} duration={duration} />
  </div>;
}

function FallLane({ solution, side, time, maxHeight, maxWeight, forces, trails, selected, onSelect, airflow }: {
  solution: FallSolution; side: number; time: number; maxHeight: number; maxWeight: number;
  forces: boolean; trails: boolean; selected: boolean; onSelect: () => void; airflow: boolean;
}) {
  const id = useId().replace(/:/g, ""), frame = fallFrame(solution, time), color = FALL_COLORS[side];
  const { config, landingTime, terminalSpeed } = solution;
  const y = (height: number) => 310 - height / maxHeight * 230;
  const ballY = y(frame.height), x = 161;
  const nearTerminal = !frame.landed && terminalSpeed !== null && terminalSpeed > 0 && frame.speed >= terminalSpeed * .98;
  const status = frame.landed ? "Landed" : config.gravity === 0 ? "Floating · g = 0" : time === 0 ? "Ready to drop" : nearTerminal ? "Near terminal speed" : "Falling";
  const dragLength = frame.drag / maxWeight * 66, weightLength = frame.weight / maxWeight * 66;
  const trailEnd = Math.min(time, landingTime ?? time);
  const trailCount = Math.min(60, Math.floor(trailEnd / .25));
  return <section className={`fall-lane fall-lane-${side} ${selected ? "is-selected" : ""}`} aria-label={`Experiment ${side === 0 ? "A" : "B"}`}>
    <button className="fall-lane-head" aria-label={`Configure experiment ${side === 0 ? "A" : "B"}`} aria-pressed={selected} onClick={onSelect}>
      <span className="fall-side-badge" style={{ color, borderColor: color }}>{side === 0 ? "A" : "B"}</span>
      <span><strong>{config.shape === "sphere" ? fallMedium(solution) : fallShapeLabel(config)}</strong><small>g {config.gravity.toFixed(2)} · Cd {Number(config.dragCoefficient.toFixed(3))} · {config.height} m{config.shape !== "sphere" ? ` · ${fallMedium(solution).toLowerCase()}` : ""}</small></span>
      <Wind size={16} className={solution.dragFactor > 0 ? "fall-air-icon" : "fall-air-icon is-off"} />
    </button>
    <div className="fall-world">
      <svg viewBox="0 0 340 382" role="img" aria-label={`Side ${side === 0 ? "A" : "B"}: ${status}, height ${frame.height.toFixed(2)} meters, speed ${frame.speed.toFixed(2)} meters per second, ${fallShapeLabel(config)}`}>
        <defs>
          <radialGradient id={`${id}-ball`} cx=".3" cy=".25"><stop stopColor="#fff5df" /><stop offset=".45" stopColor={color} /><stop offset="1" stopColor={side === 0 ? "#c87736" : "#32988f"} /></radialGradient>
          <linearGradient id={`${id}-floor`} x2="0" y2="1"><stop stopColor="#49646b" stopOpacity=".5" /><stop offset="1" stopColor="#20323b" stopOpacity="0" /></linearGradient>
          <pattern id={`${id}-hatch`} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 12L12-3M9 15L15 9" stroke="#9bb6bd" strokeOpacity=".18" /></pattern>
        </defs>
        {[0, 1, 2, 3, 4].map((n) => {
          const height = maxHeight * n / 4, yy = y(height);
          return <g key={n}><line x1="45" x2="316" y1={yy} y2={yy} stroke="#8dabbc" strokeOpacity={n === 0 ? .35 : .12} strokeDasharray={n === 0 ? undefined : "3 6"} /><text x="35" y={yy + 4} textAnchor="end" fill="#98b0c1" fontSize="13">{Number(height.toFixed(1))}</text></g>;
        })}
        <text x="24" y="38" fill="#8aa4b6" fontSize="12">m</text>
        {solution.dragFactor > 0 && Array.from({ length: 25 }, (_, i) => <circle key={i} cx={60 + (i * 67 % 243)} cy={45 + (i * 41 % 252)} r={i % 3 === 0 ? 2 : 1.2} fill="#88d7d2" opacity={Math.min(.28, config.airDensity * .12)} />)}
        <line x1="74" x2="301" y1={y(config.height)} y2={y(config.height)} stroke={color} strokeOpacity=".5" strokeDasharray="5 5" />
        <text x="301" y={y(config.height) - 10} textAnchor="end" fill={color} opacity=".8" fontSize="12">RELEASE · {config.height} m</text>
        <line x1={x} x2={x} y1={y(config.height)} y2="310" stroke={color} strokeOpacity=".1" />
        {trails && Array.from({ length: trailCount }, (_, i) => {
          const t = (Math.floor(trailEnd / .25) - trailCount + i + 1) * .25;
          const past = fallFrame(solution, t);
          return !past.landed && <circle key={i} cx={x} cy={y(past.height)} r="3" fill={color} opacity={.16 + .32 * (i + 1) / trailCount} />;
        })}
        <ellipse cx={x} cy="323" rx={16 + (1 - frame.height / maxHeight) * 8} ry="4" fill="#03111d" opacity={.25 + .4 * (1 - frame.height / maxHeight)} />
        <path d="M45 323H316V352H45Z" fill={`url(#${id}-floor)`} />
        <rect x="45" y="323" width="271" height="14" fill={`url(#${id}-hatch)`} />
        <line x1="45" y1="323" x2="316" y2="323" stroke="#9cafaa" strokeWidth="1.5" />
        <g transform={`translate(${x} ${ballY})`}>
          {airflow && !frame.landed && <FallAirflow config={config} time={time} speed={frame.speed} />}
          <FallBody config={config} color={color} fill={`url(#${id}-ball)`} />
        </g>
        {forces && <g aria-label={`Forces: gravity ${frame.weight.toFixed(2)} N down, air resistance ${frame.drag.toFixed(2)} N up${frame.landed ? `, ground support ${frame.support.toFixed(2)} N up` : ""}`}>
          {weightLength > 0 && <ForceArrow x={x - 23} y={ballY} length={weightLength} down color="#ffab65" />}
          {dragLength > .05 && <ForceArrow x={x + 23} y={ballY} length={dragLength} color="#8adcf4" />}
          {frame.landed && weightLength > 0 && <ForceArrow x={x + 23} y={ballY} length={weightLength} color="#a5dba2" />}
        </g>}
        <text x={x} y="365" textAnchor="middle" fontSize="13" fontWeight="600" fill={nearTerminal ? "#99e3cf" : frame.landed ? "#b3c9b9" : "#a4becd"}>{status}</text>
      </svg>
    </div>
    <div className="fall-lane-metrics" aria-label={`Side ${side === 0 ? "A" : "B"} live measurements`}>
      <div><span>HEIGHT</span><strong>{frame.height.toFixed(1)} <small>m</small></strong></div>
      <div><span>SPEED <ArrowDown size={9} /></span><strong style={{ color }}>{frame.speed.toFixed(2)} <small>m/s</small></strong></div>
      <div><span>ACCEL.</span><strong>{frame.acceleration.toFixed(2)} <small>m/s²</small></strong></div>
    </div>
    {forces && <div className="fall-force-values"><span>↓ Gravity {frame.weight.toFixed(2)} N</span><span>{frame.landed ? `↑ Ground ${frame.support.toFixed(2)} N` : `↑ Air ${frame.drag.toFixed(2)} N`}</span></div>}
  </section>;
}

function ForceArrow({ x, y, length, down = false, color }: { x: number; y: number; length: number; down?: boolean; color: string }) {
  const end = y + (down ? length : -length), head = Math.min(5, length * .45);
  return <g stroke={color} strokeWidth="2.3" strokeLinecap="round" fill="none"><path d={`M${x} ${y}V${end}`} /><path d={`M${x - head} ${end + (down ? -head : head)}L${x} ${end}l${head} ${down ? -head : head}`} /></g>;
}

function SpeedChart({ solutions, time, duration }: { solutions: FallSolution[]; time: number; duration: number }) {
  const width = 620, left = 44, right = 595, top = 16, bottom = 84;
  const maxSpeed = Math.max(1, ...solutions.map((s) => s.impactSpeed)) * 1.12;
  const x = (t: number) => left + t / duration * (right - left), y = (speed: number) => bottom - speed / maxSpeed * (bottom - top);
  const finiteLandings = solutions.flatMap((s) => s.landingTime === null ? [] : [s.landingTime]);
  const landingGap = solutions.length === 2 && finiteLandings.length === 2 ? Math.abs(finiteLandings[0] - finiteLandings[1]) : null;
  return <div className="fall-chart">
    <div className="fall-chart-head"><b>WATCH THE SPEED</b><span>{landingGap === null ? "A flat line means steady speed" : landingGap < .005 ? "Same landing time" : `${landingGap.toFixed(2)} s between landings`}</span></div>
    <svg viewBox={`0 0 ${width} 110`} role="img" aria-label="Speed versus time. Both experiments use the same axes. Dashed curves predict the full fall; solid curves show elapsed time. Curves end at impact.">
      {[0, .5, 1].map((f) => <g key={f}><line x1={left} x2={right} y1={y(maxSpeed * f)} y2={y(maxSpeed * f)} stroke="#7596a7" strokeOpacity=".18" /><text x={left - 8} y={y(maxSpeed * f) + 3} textAnchor="end" fill="#8ca7b7" fontSize="9">{(maxSpeed * f).toFixed(0)}</text></g>)}
      <text x="5" y="10" fill="#8ca7b7" fontSize="9">m/s</text>
      {[0, .25, .5, .75, 1].map((f) => <text key={f} x={x(duration * f)} y="101" fill="#8ca7b7" fontSize="9" textAnchor="middle">{(duration * f).toFixed(1)}{f === 1 ? " s" : ""}</text>)}
      {solutions.map((s, i) => {
        const end = s.landingTime ?? duration;
        // Include pre-impact speed at the endpoint; the ball rests after landing.
        const speedAt = (t: number) => s.landingTime !== null && t >= s.landingTime ? s.impactSpeed : fallFrame(s, t).speed;
        const path = (until: number) => Array.from({ length: 101 }, (_, n) => { const t = until * n / 100; return `${n === 0 ? "M" : "L"}${x(t).toFixed(2)} ${y(speedAt(t)).toFixed(2)}`; }).join(" ");
        const shown = Math.min(time, end), offset = solutions.length === 2 ? i === 0 ? -7 : 7 : 0;
        return <g key={i}><path d={path(end)} fill="none" stroke={FALL_COLORS[i]} strokeWidth="1.5" strokeOpacity=".4" strokeDasharray="4 5" /><path d={path(shown)} fill="none" stroke={FALL_COLORS[i]} strokeWidth="2.5" />{time > 0 && <circle cx={x(shown)} cy={y(speedAt(shown))} r="3.5" fill={FALL_COLORS[i]} />}<text x={x(end) + 6} y={y(speedAt(end)) + offset} fill={FALL_COLORS[i]} fontSize="10">{i === 0 ? "A" : "B"}</text></g>;
      })}
      <line x1={x(time)} x2={x(time)} y1={top} y2={bottom} stroke="#d7e6eb" strokeOpacity=".35" strokeDasharray="3 3" />
    </svg>
    <p>Dashed = prediction · solid = elapsed · curves end just before landing</p>
  </div>;
}
