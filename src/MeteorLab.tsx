import { useMemo, useState, type CSSProperties } from "react";
import { Globe2, Orbit, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabCheck, LabExperience, LabPanel, LabRange, LabReadout, LabSelect, useLabPlayback } from "./LabExperience";
import { circularSpeed, DEFAULT_METEOR, escapeSpeed, METEOR_MATERIALS, METEOR_PRESETS, orbitalElements, outsidePlanet, OUTCOME_LABELS, PLANETS, simulateMeteor, type MeteorConfig, type MeteorRun } from "./meteor-physics";
import { MeteorScene } from "./MeteorScene";

export function meteorTime(seconds: number) {
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}
function explanation(run: MeteorRun) {
  switch (run.outcome) {
    case "satellite": return run.initiallyBound
      ? "Satellite orbit: two revolutions observed with a clear periapsis. This asteroid was already gravitationally bound at the start; it was not newly captured."
      : `Captured into a satellite orbit after ${run.capture?.source === "brake" ? "the artificial teaching brake" : "atmospheric energy loss"}. Two bound revolutions observed; this is stability within the simplified model.`;
    case "impact": return run.capture ? "Energy became bound, but the later trajectory still hit the planet. Being bound is not enough: the entire orbit must clear the surface." : "Impact: the asteroid's path intersects the surface. Being below escape speed does not make a safe satellite orbit.";
    case "escaped": return "Escape: the asteroid is moving outward with non-negative orbital energy. Gravity bends the path but cannot permanently capture an unbound body without an energy exchange.";
    case "ablated": return "Atmospheric ablation: at most 0.5% of the initial mass remains. The run ends here.";
    case "decaying": return "Bound orbit observed, but its periapsis still crosses appreciable atmosphere. Drag can continue shrinking this orbit; it is not labeled stable.";
    case "bound": return "Still bound at the simulation limit. Two clear revolutions were not verified, so a stable satellite outcome is not inferred.";
    default: return "The simulation limit was reached. An impact, escape, or verified satellite orbit is not inferred.";
  }
}

export function MeteorLab() {
  const [config, setConfig] = useState<MeteorConfig>(DEFAULT_METEOR);
  const [profile, setProfile] = useState(false), [prediction, setPrediction] = useState(true), [grid, setGrid] = useState(true), [zoom, setZoom] = useState(1);
  const run = useMemo(() => simulateMeteor(config), [config]);
  const playback = useLabPlayback(JSON.stringify(config), 15);
  const planet = PLANETS.find((p) => p.id === config.planet)!;
  const finalFrame = run.frames[run.frames.length - 1];
  const targetTime = playback.progress * finalFrame.t, tolerance = Math.max(1e-8, finalFrame.t * 1e-12);
  let lo = 0, hi = run.frames.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (run.frames[mid].t <= targetTime + tolerance) lo = mid; else hi = mid - 1; }
  const index = playback.progress >= 1 ? run.frames.length - 1 : lo;
  const frame = run.frames[index], complete = playback.progress >= 1;
  const framePlayback = { ...playback, step: (direction: number) => {
    const next = Math.max(0, Math.min(run.frames.length - 1, index + direction));
    playback.seek(run.frames[next].t / finalFrame.t);
  } };
  const update = <K extends keyof MeteorConfig>(field: K, value: MeteorConfig[K]) => setConfig((c) => outsidePlanet({ ...c, [field]: value }));
  const initialR = Math.hypot(config.startX, config.startY) * planet.radius;
  const vCircular = circularSpeed(planet, initialR) / 1000, vEscape = escapeSpeed(planet, initialR - planet.radius) / 1000;
  const currentOrbit = orbitalElements(planet, frame.x, frame.y, frame.vx, frame.vy);
  const periapsisAltitude = (currentOrbit.periapsis - planet.radius - config.diameter / 2) / 1000;
  const activePreset = METEOR_PRESETS.find((p) => JSON.stringify(p.config) === JSON.stringify(config));
  const maximumSpeed = Math.max(config.speed, planet.id === "pluto" ? 4 : planet.id === "moon" ? 12 : 72);
  const outcomeDetail = run.outcome === "satellite" ? run.initiallyBound ? "Initially bound · 2 orbits" : "Captured · 2 orbits"
    : run.outcome === "impact" ? run.capture ? "Bound, then collided" : "Surface contact"
    : run.outcome === "escaped" ? "Outbound · unbound"
    : run.outcome === "ablated" ? "0.5% mass cutoff" : "Observation limit";
  const useCircular = () => setConfig((c) => ({ ...c, speed: vCircular, angle: (Math.atan2(-c.startX, c.startY) * 180 / Math.PI + 360) % 360, captureBrake: 0 }));
  return <LabExperience title="Meteor Lab" subtitle="Place an asteroid. Set its velocity. Miss, hit, or become a moon." icon={<Orbit />}
    modes={<><button aria-pressed={!profile} onClick={() => setProfile(false)}>2D sandbox</button><button aria-pressed={profile} onClick={() => setProfile(true)}>Altitude profile</button></>}
    playback={framePlayback} timeLabel={`t = ${meteorTime(frame.t)}`} endLabel={`${meteorTime(finalFrame.t)} simulated · 15s at 1×`}
    toolbar={<><span className="science-scenario-label"><Globe2 size={12} />{planet.name}</span><span>{config.captureBrake > 0 ? "2D · teaching brake enabled" : "2D · gravity + atmosphere"}</span></>}
    scene={<MeteorScene planet={planet} config={config} run={run} frameIndex={index} onConfigChange={setConfig} zoom={zoom} onZoomChange={setZoom} prediction={prediction} grid={grid} profile={profile} />}
    settings={<>
      <div className="science-presets meteor-presets" aria-label="Meteor scenarios">{METEOR_PRESETS.map((preset) => <button key={preset.id} aria-pressed={activePreset?.id === preset.id} title={preset.description} onClick={() => { setConfig({ ...preset.config }); setZoom(preset.id === "burn" ? 1.5 : 1); }}>{preset.name}</button>)}</div>
      {config.captureBrake > 0 && <div className="meteor-assist-note">Teaching assist: removes {Math.round(config.captureBrake * 100)}% of speed at the first closest approach. This is an artificial impulse, not natural Pluto capture.</div>}
      <LabPanel title="Central body" number="01">
        <div className="science-planet-picker meteor-planet-picker" role="group" aria-label="Choose planet">{PLANETS.map((p) => <button key={p.id} aria-pressed={p.id === config.planet} onClick={() => update("planet", p.id)}><span className="science-mini-planet" style={{ "--planet-color": p.color } as CSSProperties} />{p.name}</button>)}</div>
        <div className="science-composition">{planet.id === "pluto" ? "Dwarf planet · " : ""}{planet.composition}<br />1 R = {(planet.radius / 1000).toLocaleString()} km · surface escape {(escapeSpeed(planet) / 1000).toFixed(2)} km/s</div>
      </LabPanel>
      <LabPanel title="Initial position" number="02">
        <LabRange label="Initial X" value={config.startX} min={-12} max={12} step={.05} unit="R" onChange={(v) => update("startX", v)} />
        <LabRange label="Initial Y" value={config.startY} min={-12} max={12} step={.05} unit="R" onChange={(v) => update("startY", v)} hint="Drag the asteroid, or click empty space to place it. The planet stays at (0, 0). Starts inside the body are moved just outside its surface." />
      </LabPanel>
      <LabPanel title="Launch velocity" number="03">
        <LabRange label="Launch speed" value={config.speed} min={0} max={maximumSpeed} step={.01} unit="km/s" onChange={(v) => update("speed", v)} />
        <LabRange label="Launch direction" value={config.angle} min={0} max={360} unit="°" onChange={(v) => update("angle", v)} hint="0° right · 90° up · 180° left · 270° down. Drag the orange handle to change direction and speed." />
        <div className="meteor-speed-actions"><button onClick={useCircular}>Set circular orbit</button><button onClick={() => update("speed", vEscape * 1.1)}>1.1× escape speed</button></div>
        <div className="science-composition">At this starting point: circular {vCircular.toFixed(3)} km/s · escape {vEscape.toFixed(3)} km/s. A clear trajectory is still required.</div>
      </LabPanel>
      <LabPanel title="Asteroid" number="04" open={false}>
        <LabRange label="Diameter" value={config.diameter} min={.1} max={10_000} step={.1} unit="m" onChange={(v) => update("diameter", v)} hint="In vacuum, size does not change a small body's gravitational acceleration. Size affects drag, ablation, and surface contact." />
        <LabSelect label="Material" value={config.material} onChange={(v) => update("material", v as MeteorConfig["material"])}>{Object.entries(METEOR_MATERIALS).map(([id, m]) => <option key={id} value={id}>{m.name} · {m.density.toLocaleString()} kg/m³</option>)}</LabSelect>
      </LabPanel>
      <LabPanel title="Atmosphere" number="05" open={false}>
        <LabRange label="Atmosphere fraction" value={config.atmosphere} min={0} max={3} step={.05} unit="×" disabled={planet.density === 0} onChange={(v) => update("atmosphere", v)} hint={planet.density === 0 ? "No modeled atmosphere." : `1× = illustrative baseline; surface density ${(planet.density * config.atmosphere).toPrecision(3)} kg/m³. 0× = vacuum.`} />
        <LabRange label="Atmosphere thickness" value={config.thickness} min={.25} max={2} step={.05} unit="×" disabled={planet.density === 0} onChange={(v) => update("thickness", v)} />
        <LabRange label="Drag coefficient" value={config.drag} min={.2} max={2} step={.05} unit="Cd" disabled={planet.density === 0} onChange={(v) => update("drag", v)} />
      </LabPanel>
      <LabPanel title="Capture teaching assist" number="06" open={config.captureBrake > 0}>
        <LabRange label="Periapsis brake" value={config.captureBrake * 100} min={0} max={80} unit="%" onChange={(v) => update("captureBrake", v / 100)} hint="0% = off. Removes this fraction of velocity once at the first closest approach outside the body. Too much braking can cause a later impact." />
        <div className="meteor-assist-note">A demonstration of energy removal. Charon, third-body encounters, and natural capture mechanisms are not simulated.</div>
      </LabPanel>
      <LabPanel title="View & overlays" number="07" open={false}>
        <LabRange label="View zoom" value={zoom} min={.01} max={2.5} step={.01} unit="×" onChange={setZoom} />
        <LabCheck label="Predicted trajectory" checked={prediction} onChange={setPrediction} /><LabCheck label="Reference grid" checked={grid} onChange={setGrid} />
      </LabPanel>
      <Button variant="outline" size="sm" onClick={() => { setConfig({ ...DEFAULT_METEOR }); setZoom(1); playback.reset(); }} className="w-full"><RotateCcw size={13} /> Restore defaults</Button>
    </>}
    readouts={<>
      <LabReadout label={complete ? "Result" : "Prediction"} value={OUTCOME_LABELS[run.outcome]} detail={outcomeDetail} accent />
      <LabReadout label="Speed" value={`${(frame.speed / 1000).toFixed(3)} km/s`} detail={`Local escape ${(escapeSpeed(planet, frame.altitude) / 1000).toFixed(3)} km/s`} />
      <LabReadout label="Orbital energy" value={`${currentOrbit.energy < 0 ? "−" : "+"}${Math.abs(currentOrbit.energy / 1e6).toFixed(3)}`} detail="km²/s² · negative = bound" />
      <LabReadout label="Orbital periapsis" value={periapsisAltitude < 0 ? "Intersects" : `${Math.round(periapsisAltitude).toLocaleString()} km`} detail={periapsisAltitude < 0 ? "Orbit crosses the surface" : "Above surface · current orbit"} />
      <LabReadout label="Mass remaining" value={`${(frame.mass / run.initialMass * 100).toFixed(1)}%`} detail={`Closest pass ${Math.max(0, Math.round(run.closestAltitude / 1000)).toLocaleString()} km (full run)`} />
    </>}
    insight={complete ? explanation(run) : config.captureBrake > 0 ? "Teaching brake enabled: compare Capture assist with Escape. Same initial flyby; different energy after closest approach." : "Try Escape, Impact, and Satellite orbit. Drag the start or orange velocity handle; playback resets so you can compare the new trajectory."}
    notes={<><p>This is a flat 2D model with a fixed central body. Coordinates use its radius R. The asteroid is a test body; its mass does not change the planet's motion. Gravity uses <code>a = −μr/r³</code>. Specific orbital energy is <code>ε = v²/2 − μ/r</code>. Negative energy alone is insufficient for a satellite: the orbit must also clear the surface.</p><p>“Satellite orbit” requires two observed revolutions, negative energy, a clear periapsis, and negligible modeled atmosphere there. An asteroid already bound at the initial state is labeled separately from a new positive-to-negative energy transition. Atmospheric orbits are labeled decaying; unresolved runs are not claimed stable. A bound trajectory can later impact.</p><p>The optional teaching brake removes a chosen fraction of speed once at first closest approach. It represents a hypothetical energy-removal event; it does not simulate Charon, a binary asteroid, tidal dissipation, or natural capture. The real Pluto–Charon system needs a multiple-body model, so this demo does not predict a real long-term Pluto satellite.</p><p>Atmosphere: <code>ρ(h) = ρ₀ × fraction × exp(−h/H)</code>, drag <code>½ρv²CdA</code>, fixed heat-transfer coefficient 0.1, and material ablation energy. Pluto's density is an illustrative profile based on historical pressure/temperature and a lower-atmosphere scale height; it is not a current atmosphere measurement. No lift, fragmentation, or crater calculation is included. Asteroid symbols and atmosphere outlines are enlarged.</p><p><a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html" target="_blank" rel="noreferrer">NASA · Pluto data</a><a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA · planetary data</a><a href="https://doi.org/10.1017/S1743921304008968" target="_blank" rel="noreferrer">IAU · capture and orbital energy</a><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/" target="_blank" rel="noreferrer">NASA · drag</a></p></>}
  />;
}
