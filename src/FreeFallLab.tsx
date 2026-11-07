import { useMemo, useState } from "react";
import { ArrowDownToLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabCheck, LabExperience, LabPanel, LabRange, LabReadout, LabSelect, useLabPlayback } from "./LabExperience";
import { FreeFallScene } from "./FreeFallScene";
import { ShapeFlowPreview } from "./FallBody";
import { FALL_PRESETS, FALL_SHAPES, fallDuration, shapeDragCoefficient, solveFall, withFallShape, type ConeOrientation, type FallConfig, type FallShape } from "./fall-physics";
import "./free-fall.css";

export function FreeFallLab() {
  const [configs, setConfigs] = useState<[FallConfig, FallConfig]>(() => [{ ...FALL_PRESETS[0].a }, { ...FALL_PRESETS[0].b }]);
  const [compare, setCompare] = useState(true), [selected, setSelected] = useState(1);
  const [linkedHeight, setLinkedHeight] = useState(true);
  const [forces, setForces] = useState(true), [trails, setTrails] = useState(true);
  const [advanced, setAdvanced] = useState(false), [airflow, setAirflow] = useState(true);
  const solutions = useMemo(() => configs.map(solveFall), [configs]);
  const visible = compare ? solutions : solutions.slice(0, 1);
  const duration = fallDuration(visible);
  const playback = useLabPlayback(JSON.stringify({ configs: compare ? configs : [configs[0]], compare }), duration);
  const stepPlayback = { ...playback, step: (direction: number) => playback.seek(playback.progress + direction * .05 / duration) };
  const time = playback.progress * duration;
  const selectedSide = compare ? selected : 0;
  const current = configs[selectedSide], currentSolution = solutions[selectedSide];
  const side = selectedSide === 0 ? "A" : "B";
  const activePreset = FALL_PRESETS.find((p) => JSON.stringify(configs) === JSON.stringify([p.a, p.b]));
  const update = (patch: Partial<FallConfig>) => setConfigs((previous) => previous.map((config, i) => ({ ...config, ...(i === selectedSide ? patch : linkedHeight && patch.height !== undefined ? { height: patch.height } : {}) })) as [FallConfig, FallConfig]);
  const preset = (id: string) => {
    const p = FALL_PRESETS.find((item) => item.id === id)!;
    setConfigs([{ ...p.a }, { ...p.b }]); setCompare(true); setLinkedHeight(true); setSelected(1); playback.reset();
    if (p.advanced) setAdvanced(true);
  };
  const aTime = solutions[0].landingTime, bTime = solutions[1].landingTime;
  const gap = aTime !== null && bTime !== null ? Math.abs(aTime - bTime) : null;
  const timeText = (t: number | null) => t === null ? "No landing" : `${t.toFixed(2)} s`;
  const insight = visible.some((s) => s.config.gravity === 0)
    ? "At g = 0, an object released from rest stays where it is. Air resistance cannot start it moving: drag needs motion through air."
    : compare && visible.every((s) => s.dragFactor === 0) && configs[0].gravity === configs[1].gravity && configs[0].height === configs[1].height
      ? "They land together! Without air resistance, mass does not change the fall. Same gravity + same height = same landing time."
      : currentSolution.dragFactor > 0
        ? "Watch the blue arrow grow as the object speeds up. When air resistance nearly balances gravity, the object keeps falling at almost steady speed — its terminal speed."
        : "Gravity keeps speeding this object up. Try adding air resistance, then compare the curved speed graph with the straight vacuum line.";
  return <LabExperience title="Free Fall Lab" subtitle="Drop, compare, and discover what slows falling objects." icon={<ArrowDownToLine />}
    modes={<><button aria-pressed={!compare} onClick={() => { setCompare(false); setSelected(0); }}>Single drop</button><button aria-pressed={compare} onClick={() => setCompare(true)}>Side by side</button><button className="fall-advanced-switch" aria-label="Advanced mode" aria-pressed={advanced} onClick={() => setAdvanced(!advanced)}>Advanced</button></>}
    playback={stepPlayback} timeLabel={`t = ${time.toFixed(2)} s`} endLabel={`${duration.toFixed(2)} s · 1× = real time`}
    toolbar={<><span className="science-scenario-label">{compare ? "A ↔ B · simultaneous release" : "A · released from rest"}</span><span className="fall-model-badge">Gravity + air drag</span></>}
    scene={<FreeFallScene solutions={visible} time={time} duration={duration} forces={forces} trails={trails} onSelect={setSelected} selected={selectedSide} airflow={advanced && airflow} />}
    settings={<>
      <div className="science-presets fall-presets" aria-label="Free fall presets">{FALL_PRESETS.filter((p) => advanced || !p.advanced).map((p) => <button key={p.id} aria-pressed={activePreset?.id === p.id} onClick={() => preset(p.id)}>{p.label}</button>)}</div>
      <div className="fall-question"><span>TRY AN EXPERIMENT</span>{activePreset?.question ?? "Change one thing at a time. Predict which ball will land first, then press Play."}</div>
      {advanced && <LabPanel title="Shape & airflow" number="A+">
        {compare && <div className="fall-side-picker" aria-label="Choose shape side">{[0, 1].map((i) => <button key={i} aria-label={`Edit shape ${i === 0 ? "A" : "B"}`} aria-pressed={selectedSide === i} onClick={() => setSelected(i)}><b>{i === 0 ? "A" : "B"}</b><span>{i === 0 ? "Left side" : "Right side"}</span></button>)}</div>}
        <LabSelect label={`Side ${side} body shape`} value={current.shape} onChange={(shape) => update(withFallShape(current, shape as FallShape))}>{FALL_SHAPES.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}</LabSelect>
        {current.shape === "cone" && <LabSelect label={`Side ${side} cone orientation`} value={current.coneOrientation} onChange={(orientation) => update(withFallShape(current, "cone", orientation as ConeOrientation))}><option value="tip-first">Tip down · pointed end first</option><option value="base-first">Base down · flat end first</option></LabSelect>}
        <ShapeFlowPreview config={current} time={time} />
        <p className="fall-hint">{FALL_SHAPES.find((shape) => shape.id === current.shape)!.description} Choosing a shape loads an approximate Cd; mass and frontal area stay the same. Override Cd below to experiment.</p>
        <button className="fall-use-shape-cd" onClick={() => update({ dragCoefficient: shapeDragCoefficient(current.shape, current.coneOrientation) })}>Use shape estimate · Cd {shapeDragCoefficient(current.shape, current.coneOrientation)}</button>
        <LabCheck label="Airflow sketches" checked={airflow} onChange={setAirflow} />
      </LabPanel>}
      <LabPanel title="Release height" number="01">
        {compare && <LabCheck label="Same height on both sides" checked={linkedHeight} onChange={(linked) => { setLinkedHeight(linked); if (linked) setConfigs((c) => [{ ...c[0], height: c[selectedSide].height }, { ...c[1], height: c[selectedSide].height }]); }} />}
        <LabRange label={compare && linkedHeight ? "Shared drop height" : `Side ${side} drop height`} value={current.height} min={1} max={100} step={1} unit="m" onChange={(height) => update({ height })} />
        <p className="fall-hint">All objects start at rest. {compare ? "The same ruler and clock make differences visible." : "Press Play to release the object."} Changing a physics setting resets the drop.</p>
      </LabPanel>
      <LabPanel title="Gravity & air resistance" number="02">
        {compare && <div className="fall-side-picker" aria-label="Choose experiment to configure">{[0, 1].map((i) => <button key={i} aria-label={`Edit side ${i === 0 ? "A" : "B"}`} aria-pressed={selectedSide === i} onClick={() => setSelected(i)}><b>{i === 0 ? "A" : "B"}</b><span>{i === 0 ? "Left side" : "Right side"}</span></button>)}</div>}
        <LabRange label={`Side ${side} gravity`} value={current.gravity} min={0} max={25} step={.01} unit="m/s²" onChange={(gravity) => update({ gravity })} hint="Stronger gravity → faster acceleration. Earth ≈ 9.81; Moon ≈ 1.62. 0 = no pull." />
        <div className="fall-gravity-shortcuts" aria-label={`Side ${side} gravity shortcuts`}><button onClick={() => update({ gravity: 9.81 })}>Earth · 9.81</button><button onClick={() => update({ gravity: 1.62 })}>Moon · 1.62</button><button onClick={() => update({ gravity: 0 })}>Zero g</button></div>
        <LabCheck label={`Side ${side} air resistance`} checked={current.airResistance} onChange={(airResistance) => update({ airResistance })} />
        <LabRange label={`Side ${side} drag coefficient`} value={current.dragCoefficient} min={0} max={2} step={.005} unit="Cd" disabled={!current.airResistance} onChange={(dragCoefficient) => update({ dragCoefficient })} hint="Bigger Cd = more drag at the same speed, area and air density. Cd has no unit. 0 = no drag." />
      </LabPanel>
      <LabPanel title={`Side ${side} · object & atmosphere`} number="03" open={false}>
        <LabRange label={`Side ${side} mass`} value={current.mass} min={.05} max={10} step={.05} unit="kg" onChange={(mass) => update({ mass })} hint="In vacuum, heavy and light balls fall together. With air, mass changes how much drag slows the ball." />
        <LabRange label={`Side ${side} frontal area`} value={current.area} min={.005} max={1} step={.005} unit="m²" onChange={(area) => update({ area })} hint="Area facing the air. A wider parachute catches more air. Ball drawings are enlarged and not to scale." />
        <LabRange label={`Side ${side} air density`} value={current.airDensity} min={0} max={2.5} step={.025} unit="kg/m³" disabled={!current.airResistance} onChange={(airDensity) => update({ airDensity })} hint="1.225 ≈ sea-level air. 0 = vacuum. Density stays constant throughout each fall." />
        <div className="fall-equation"><b>Air resistance = ½ × ρ × Cd × A × v²</b><span>Same speed? A higher density, Cd or area gives a bigger upward push.</span></div>
      </LabPanel>
      <LabPanel title="Visual helpers" number="04" open={false}>
        <LabCheck label="Force arrows" checked={forces} onChange={setForces} />
        <LabCheck label="Equal-time trail dots" checked={trails} onChange={setTrails} />
        <p className="fall-hint">Arrow length compares force on one shared scale. Orange = gravity, blue = air. On the ground, green = support. Trail dots mark 0.25-second intervals: bigger gaps mean faster motion.</p>
      </LabPanel>
      <Button variant="outline" size="sm" className="w-full" onClick={() => { preset("air"); setForces(true); setTrails(true); setAdvanced(false); setAirflow(true); playback.setRate(1); }}><RotateCcw size={13} /> Restore defaults</Button>
    </>}
    readouts={<>
      <LabReadout label="A · landing time" value={timeText(aTime)} detail={aTime === null ? "No gravity · released from rest" : `${configs[0].height} m · predicted from release`} accent />
      <LabReadout label={compare ? "B · landing time" : "A · gravity"} value={compare ? timeText(bTime) : `${configs[0].gravity.toFixed(2)} m/s²`} detail={compare ? bTime === null ? "No gravity · released from rest" : `${configs[1].height} m · predicted from release` : "Downward gravitational acceleration"} />
      <LabReadout label={compare ? "Landing difference" : "A · weight"} value={compare ? gap === null ? "No shared finish" : gap < .005 ? "Together" : `${gap.toFixed(2)} s` : `${(current.mass * current.gravity).toFixed(2)} N`} detail={compare ? gap === null ? "One or both balls stay in place" : gap < .005 ? "Same time within 0.005 s" : `Side ${aTime! < bTime! ? "A" : "B"} arrives first` : "Mass × gravity"} />
      <LabReadout label={`${side} · impact speed`} value={currentSolution.landingTime === null ? "No impact" : `${currentSolution.impactSpeed.toFixed(2)} m/s`} detail="Predicted speed just before landing" />
      <LabReadout label={`${side} · terminal speed`} value={current.gravity === 0 ? "Not falling" : currentSolution.terminalSpeed === null ? "No drag limit" : `${currentSolution.terminalSpeed.toFixed(2)} m/s`} detail={currentSolution.dragFactor === 0 ? "No air resistance to balance gravity" : "Speed where upward drag equals weight"} />
    </>}
    insight={insight}
    notes={<>
      <p><b>Free fall and air resistance.</b> Strictly, free fall means only gravity acts. This lab compares that ideal case with falling through air. Both experiments release a body from rest at t = 0. Gravity g, mass m, reference frontal area A, drag coefficient Cd and air density ρ are constant in each run. The Moon shortcut changes gravity only; the Earth vs Moon preset disables air on both sides to isolate gravity.</p>
      <p>Downward is positive. Before impact, <code>m dv/dt = mg − kv²</code>, with <code>k = ½ρCdA</code>. Without drag, <code>v = gt</code> and <code>s = ½gt²</code>. With drag and g &gt; 0, <code>vₜ = √(mg/k)</code>, <code>v = vₜ tanh(gt/vₜ)</code> and <code>s = (m/k) ln cosh(gt/vₜ)</code>. Landing is calculated from s = release height. These exact constant-coefficient solutions also drive the animation, measurements and chart.</p>
      <p>Terminal speed is approached gradually and may not be reached before impact. At zero gravity, a body released from rest stays still. The body stops without bouncing when it reaches the ground; a support force then balances its weight. Speed-graph curves end just before impact, while live speed becomes zero after landing. Dashed curves are predictions, not past motion. Arrow lengths share one scale across both sides; object and parachute drawings are schematic. The parachute represents an already open canopy.</p>
      <p><b>Advanced shapes.</b> Shape selection loads a fixed, approximate teaching Cd into the same drag equation, without adding another drag multiplier. Frontal area and mass are independent and remain unchanged. Sphere 0.47, cube 1.05, flat plate 1.28 and rounded nose 0.295 are representative examples, not universal constants. Cone tip-first 0.50 and base-first 1.10 are simplified classroom assumptions; a real cone's Cd depends on apex angle, orientation and flow conditions. A pointed cone need not have less drag than a sphere. Orientation is held fixed: tumbling and aerodynamic stability are not simulated.</p>
      <p>Advanced airflow and wake outlines are qualitative illustrations, not computed fluid streamlines or a CFD result. Relative air goes upward past a downward-moving body. The close-up illustrates a fixed 10 m/s airflow; moving scene particles follow the simulation clock and stop on pause. Actual aerodynamic force still comes only from the stated drag equation. Reynolds-number changes, boundary layers and turbulent flow are not solved.</p>
      <p>This short-drop teaching model omits wind, buoyancy, changing air density with height, changing Cd with speed, spin, lift and parachute deployment. Mass and area can be varied independently to isolate their effects; the settings do not define a particular real material.</p>
      <p><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/" target="_blank" rel="noreferrer">NASA · drag equation</a><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/falling-object-with-air-resistance/" target="_blank" rel="noreferrer">NASA · falling through air</a><a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/" target="_blank" rel="noreferrer">NASA · shape and drag</a><a href="https://www.solarcarchallenge.org/challenge/workshop/2026/SpecialtyWorkshop-Aerodynamics_2025-2026.pdf" target="_blank" rel="noreferrer">Solar Car Challenge · representative shapes</a></p>
    </>}
  />;
}
