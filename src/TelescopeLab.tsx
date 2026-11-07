import { useMemo, useRef, useState } from "react";
import { ChevronDown, Crosshair, Focus, Plus, RotateCcw, Telescope, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabCheck, LabExperience, LabPanel, LabRange, LabReadout, LabSelect, useLabPlayback } from "./LabExperience";
import { addLens, DEFAULT_OPTICS, DEFAULT_VISUAL_OPTICS, lensPositionBounds, MAX_LENSES, MAX_SENSOR_X, moveLens, removeLens, solveOptics, sortedLenses, SPECTRUM, wavelengthColor, type OpticalConfig, type OpticalLens } from "./telescope-optics";
import { TelescopeScene, type OpticalTarget, type Photo } from "./TelescopeScene";
import { DEFAULT_EYE, solveVisualComparison, type ComparisonMode, type EyeConfig } from "./eye-optics";

export function TelescopeLab() {
  const [config, setConfig] = useState<OpticalConfig>(DEFAULT_VISUAL_OPTICS);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("object");
  const [target, setTarget] = useState<OpticalTarget>("moon");
  const [eye, setEye] = useState<EyeConfig>(DEFAULT_EYE), [orientationMarkers, setOrientationMarkers] = useState(true);
  const [eyeCapture, setEyeCapture] = useState<Photo | null>(null);
  const [directCapture, setDirectCapture] = useState<Photo | null>(null);
  const [rays, setRays] = useState(true), [pulses, setPulses] = useState(true), [captured, setCaptured] = useState<Photo | null>(null);
  const [selectedLensId, setSelectedLensId] = useState("eyepiece"), [selectedRayId, setSelectedRayId] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const nextLens = useRef(1);
  const lenses = useMemo(() => sortedLenses(config), [config]);
  const last = lenses[lenses.length - 1], selectedLens = lenses.find((l) => l.id === selectedLensId) ?? lenses[0];
  const benchConfig = useMemo(() => comparisonMode === "object" ? { ...config, sensorX: last.x + eye.relief } : config, [config, comparisonMode, last.x, eye.relief]);
  const solution = useMemo(() => solveOptics(benchConfig), [benchConfig]);
  const visual = useMemo(() => solveVisualComparison(config, eye), [config, eye]);
  const eyeSolution = visual.through, directSolution = visual.direct;
  const selectedIndex = lenses.findIndex((l) => l.id === selectedLens.id), bounds = lensPositionBounds(config, selectedLens.id);
  const selectedRay = solution.rays.find((r) => r.id === selectedRayId)
    ?? solution.rays.find((r) => r.wavelength === config.wavelength && r.pupil === 1) ?? solution.rays[0];
  const key = JSON.stringify({ config, comparisonMode, viewDistance: eye.relief }, (_, v) => v === Infinity ? "infinity" : v);
  const playback = useLabPlayback(key, 6);
  const update = <K extends keyof OpticalConfig>(field: K, value: OpticalConfig[K]) => setConfig((c) => ({ ...c, [field]: value }));
  const updateLens = (patch: Partial<OpticalLens>) => setConfig((c) => ({ ...c, lenses: c.lenses.map((l) => l.id === selectedLens.id ? { ...l, ...patch } : l) }));
  const canFocus = solution.focus !== null && solution.focus >= 10 && last.x + solution.focus <= MAX_SENSOR_X;
  const canAddLens = lenses.length < MAX_LENSES && addLens(benchConfig, "candidate") !== benchConfig;
  const focus = () => { if (canFocus) update("sensorX", last.x + solution.focus!); };
  const statusLabel = { focused: "In focus", defocused: "Defocused", afocal: "Afocal", virtual: "Virtual focus", chromatic: "Color fringing", blocked: "Light blocked" }[solution.status];
  const visualStatus = eyeSolution.status === "focused" ? "Sharp" : eyeSolution.status === "chromatic" ? "Color fringing" : "Unfocused";
  const visualMessage = eyeSolution.status === "defocused" ? "The original object is the upright reference. The current lens group is not focused for visual observation; adjust its spacing or viewing focus, or choose a visual telescope preset."
    : `Through the current lens group: ${eyeSolution.orientation.toLowerCase()} at ${Math.abs(eyeSolution.angularMagnification).toFixed(1)}×. Direct view of the same object: upright at 1×. Both panes use the same 8° apparent field.`;
  const focusMessage = solution.status === "blocked" ? "The selected object point is blocked by a lens aperture. Widen the aperture or reduce the field angle."
    : solution.status === "afocal" ? "This bundle leaves parallel: a bare sensor cannot form a focused image. Add a camera lens or change the lens group."
    : solution.status === "virtual" ? "The reference wavelength has a virtual focus before the final lens. Change lens spacing or optical power."
    : !canFocus ? "The reference focus is outside the sensor's travel. Move a lens or change its focal length."
    : solution.status === "chromatic" ? `${config.wavelength} nm is focused, but other wavelengths meet at different planes. Compare their focus positions in the spectrum table.`
    : solution.status === "focused" ? "The sensor meets the focus for the selected light. Change wavelength or add a lens to explore how the image changes."
    : `Move the sensor to the ${config.wavelength} nm focus. In spectrum mode, each color has its own focal plane.`;
  const setPreset = (preset: "dispersion" | "prime" | "afocal" | "galilean") => {
    const base = { ...DEFAULT_OPTICS, lenses: DEFAULT_OPTICS.lenses.map((l) => ({ ...l })) };
    setConfig(preset === "prime" ? { ...base, lenses: [base.lenses[0]], sensorX: 400, lightMode: "mono" }
      : preset === "afocal" || preset === "galilean" ? { ...base, lenses: [{ ...base.lenses[0], glass: "ideal" }, { ...base.lenses[1], x: preset === "galilean" ? 300 : 500, focalLength: preset === "galilean" ? -100 : 100, glass: "ideal", diameter: 50 }], sensorX: 700 }
      : base);
    setSelectedLensId(preset === "prime" ? "objective" : "barlow");
    setEye(DEFAULT_EYE);
  };
  return <LabExperience title="Telescope Lab" subtitle="Compare the view through your lenses with the original object." icon={<Telescope />}
    modes={<><button aria-pressed={config.lightMode === "mono"} onClick={() => update("lightMode", "mono")}>Monochromatic</button><button aria-pressed={config.lightMode === "spectrum"} onClick={() => { setConfig((c) => ({ ...c, lightMode: "spectrum", wavelength: 550 })); }}>Visible spectrum</button></>}
    playback={playback} timeLabel={`Light transit · ${(playback.progress * 100).toFixed(0)}%`} endLabel="Illustrated pass · light slowed"
    toolbar={<><span className="science-scenario-label"><Crosshair size={12} />{lenses.length} lenses · {solution.bands.length === 1 ? `${config.wavelength} nm` : "7 wavelengths"}</span><span className="optics-model-badge">Paraxial thin lenses</span></>}
    scene={<TelescopeScene config={config} solution={solution} progress={playback.progress} rays={rays} pulses={pulses} target={target} onConfigChange={setConfig} captured={captured} onCapture={setCaptured} selectedLensId={selectedLens.id} onSelectLens={setSelectedLensId} selectedRayId={selectedRay.id} onSelectRay={(id) => { setSelectedRayId(id); setInspectorOpen(true); }} eye={eyeSolution} direct={directSolution} comparisonMode={comparisonMode} eyeCapture={eyeCapture} onEyeCapture={setEyeCapture} directCapture={directCapture} onDirectCapture={setDirectCapture} onViewDistanceChange={(relief) => setEye((e) => ({ ...e, relief }))} orientationMarkers={orientationMarkers} />}
    settings={<>
      <div className="science-presets optics-presets" aria-label="Optical presets"><button onClick={() => setPreset("dispersion")}>Spectrum + Barlow</button><button onClick={() => setPreset("prime")}>Single lens</button><button onClick={() => setPreset("afocal")}>Keplerian · inverted</button><button onClick={() => setPreset("galilean")}>Galilean · upright</button></div>
      <LabPanel title="Target & comparison" number="01">
        <LabSelect label="Comparison" value={comparisonMode} onChange={(v) => setComparisonMode(v as ComparisonMode)}><option value="object">Through lenses ↔ original object</option><option value="detectors">Advanced · camera ↔ eye</option></LabSelect>
        <LabSelect label="Target" value={target} onChange={(v) => setTarget(v as OpticalTarget)}><option value="moon">Moon illustration</option><option value="saturn">Saturn & rings</option><option value="jupiter">Jupiter & moons</option><option value="binary">Double star</option><option value="arrow">Direction arrow · UP / R</option><option value="chart">Resolution chart</option><option value="point">Point source</option></LabSelect>
        <LabCheck label="Show UP / R orientation markers" checked={orientationMarkers} onChange={setOrientationMarkers} />
        <p className="optics-hint">{comparisonMode === "object" ? "Left: look through the current lenses. Right: look directly at the same original object, bypassing the lenses. Both panes share the same 8° field and scale." : "Advanced receiver experiment: a bare 36 mm sensor versus an eye after the same group. The eye adds its own focusing optics. Eye view spans 8°; the camera uses a different scale."} UP ↑ / R → mark the source orientation. Preview brightness is normalized separately.</p>
      </LabPanel>
      <LabPanel title="Light & spectrum" number="02">
        <LabSelect label="Light mode" value={config.lightMode} onChange={(v) => setConfig((c) => ({ ...c, lightMode: v as OpticalConfig["lightMode"], wavelength: v === "spectrum" ? 550 : c.wavelength }))}><option value="mono">Monochromatic · one wavelength</option><option value="spectrum">Visible spectrum · red to violet</option></LabSelect>
        {config.lightMode === "mono" ? <LabRange label="Wavelength" value={config.wavelength} min={380} max={750} step={1} unit="nm" onChange={(v) => update("wavelength", v)} />
          : <LabSelect label="Focus reference" value={String(config.wavelength)} onChange={(v) => update("wavelength", Number(v))}>{SPECTRUM.map((w) => <option key={w} value={w}>{w} nm{w === 550 ? " · green" : w === 700 ? " · red" : w === 400 ? " · violet" : ""}</option>)}</LabSelect>}
        <div className="optics-spectrum-strip" aria-label="Visible wavelengths from red 700 to violet 400 nanometers">{SPECTRUM.map((w) => <span key={w} style={{ background: wavelengthColor(w) }} title={`${w} nm`} />)}</div>
        <LabSelect label="Traced object point" value={config.source} onChange={(v) => update("source", v as OpticalConfig["source"])}><option value="axis">One point · on axis</option><option value="field">One point · off axis</option><option value="both">Center + edge points</option></LabSelect>
        <p className="optics-hint">Each color traces the same object point through every lens. Color denotes wavelength; dashed rays denote the edge point.</p>
      </LabPanel>
      <LabPanel title={`Lens group · ${lenses.length} / ${MAX_LENSES}`} number="03">
        <div className="optics-lens-list" aria-label="Select lens">{lenses.map((l, i) => <button key={l.id} aria-pressed={selectedLens.id === l.id} aria-label={`Select lens L${i + 1}`} onClick={() => setSelectedLensId(l.id)}><b>L{i + 1}</b><span>{l.focalLength > 0 ? "+" : "−"}{Math.abs(l.focalLength)}<small>{l.x} mm</small></span></button>)}</div>
        <div className="optics-lens-actions"><Button size="sm" variant="outline" disabled={!canAddLens} onClick={() => { const id = `added-${nextLens.current++}`; const next = addLens(benchConfig, id); if (next !== benchConfig) { setConfig((c) => ({ ...c, lenses: next.lenses })); setSelectedLensId(id); } }}><Plus size={13} />Add lens</Button><Button size="sm" variant="outline" disabled={selectedIndex === 0} aria-label={`Remove lens L${selectedIndex + 1}`} onClick={() => { setConfig((c) => removeLens(c, selectedLens.id)); setSelectedLensId(lenses[0].id); }}><Trash2 size={13} />Remove</Button></div>
        <div className="optics-selected-lens">L{selectedIndex + 1} · {selectedIndex === 0 ? "Objective / entrance pupil" : "Drag this lens on the bench"}</div>
        <LabSelect label="Lens type" value={selectedLens.focalLength > 0 ? "positive" : "negative"} onChange={(v) => updateLens({ focalLength: Math.abs(selectedLens.focalLength) * (v === "positive" ? 1 : -1) })}><option value="positive">Converging · positive power</option><option value="negative">Diverging · negative power</option></LabSelect>
        <LabRange label="Focal length magnitude" value={Math.abs(selectedLens.focalLength)} min={40} max={1000} step={5} unit="mm" onChange={(v) => updateLens({ focalLength: selectedLens.focalLength < 0 ? -v : v })} hint="Specified at 587.56 nm. Fixed lens shape; actual focal length changes with wavelength." />
        <LabSelect label="Lens material" value={selectedLens.glass} onChange={(v) => updateLens({ glass: v as OpticalLens["glass"] })}><option value="bk7">SCHOTT N-BK7 · dispersive glass</option><option value="ideal">Ideal · no dispersion</option></LabSelect>
        <LabRange label="Clear aperture" value={selectedLens.diameter} min={8} max={100} step={1} unit="mm" onChange={(v) => updateLens({ diameter: v })} hint="Rays outside a lens's clear aperture stop at that lens." />
        {selectedIndex > 0 && <LabRange label="Lens position" value={selectedLens.x} min={bounds.min} max={bounds.max} step={1} unit="mm" onChange={(v) => setConfig((c) => moveLens(c, selectedLens.id, v))} hint="Measured from the objective. Other lenses and the sensor stay fixed." />}
      </LabPanel>
      <LabPanel title={comparisonMode === "object" ? "Spectral output" : "Sensor & chromatic focus"} number="04" open={comparisonMode === "detectors"}>
        {comparisonMode === "detectors" && <LabRange label="Sensor position" value={config.sensorX} min={last.x + 10} max={MAX_SENSOR_X} step={1} unit="mm" onChange={(v) => update("sensorX", v)} hint={`Absolute bench position; ${(config.sensorX - last.x).toFixed(1)} mm after L${lenses.length}.`} />}
        <p className="optics-hint">Effective focal length: {solution.effectiveFocalLength === null ? "∞" : `${solution.effectiveFocalLength.toFixed(1)} mm`}{solution.fNumber === null ? "" : ` · f/${solution.fNumber.toFixed(1)}`} at {config.wavelength} nm.</p>
        {comparisonMode === "detectors" && <Button onClick={focus} disabled={!canFocus} size="sm" className="science-focus-button"><Focus size={14} /> Focus sensor · {config.wavelength} nm</Button>}
        <table className="optics-focus-table" aria-label="Focus by wavelength"><thead><tr><th>Light</th><th>Focus x / mm</th><th>{comparisonMode === "object" ? "Bundle / mm" : "Blur / mm"}</th></tr></thead><tbody>{solution.bands.map((b) => <tr key={b.wavelength} className={b.wavelength === config.wavelength ? "is-reference" : ""}><td><i style={{ background: wavelengthColor(b.wavelength) }} />{b.wavelength}</td><td>{b.focus === null ? "∞" : b.focus <= 0 ? "Virtual" : (last.x + b.focus).toFixed(2)}</td><td>{b.blurDiameter.toFixed(3)}</td></tr>)}</tbody></table>
        <div className="science-optics-message">{comparisonMode === "object" ? "These are focal planes and full on-axis bundle diameters at the viewing plane, before the eye focuses the light." : focusMessage}</div>
        {comparisonMode === "detectors" && captured && <div className="science-saved-capture" role="status"><img src={captured.url} alt="Captured telescope photograph" /><span>Photo captured<br /><small>{captured.label}</small></span></div>}
      </LabPanel>
      <LabPanel title="Viewing position & focus" number="05" open={false}>
        <LabRange label="Viewing distance after last lens" value={eye.relief} min={10} max={600} step={1} unit="mm" onChange={(v) => setEye((e) => ({ ...e, relief: v }))} />
        <LabRange label="Eye pupil diameter" value={eye.pupil} min={2} max={7} step={.5} unit="mm" onChange={(v) => setEye((e) => ({ ...e, pupil: v }))} />
        <LabCheck label="Automatic eye accommodation" checked={eye.autoFocus} onChange={(v) => setEye((e) => ({ ...e, autoFocus: v }))} />
        {!eye.autoFocus && <LabRange label="Accommodation" value={eye.accommodation} min={0} max={4} step={.1} unit="D" onChange={(v) => setEye((e) => ({ ...e, accommodation: v }))} />}
        <div className="science-optics-message">Ideal eye · retina 17 mm behind its lens. Required accommodation: {eyeSolution.requiredAccommodation === null ? "unbounded" : `${eyeSolution.requiredAccommodation.toFixed(2)} D`}; applied {eyeSolution.accommodation.toFixed(2)} D within 0–4 D. Retinal blur: {(eyeSolution.retinalBlur * 1000).toFixed(1)} µm.</div>
        <p className="optics-hint">A relaxed eye focuses parallel output. A converging bundle may need an eyepiece; the eye's focus range is limited. This reduced-eye model illustrates optics, not an individual's vision.</p>
      </LabPanel>
      <LabPanel title="Object & view" number="06" open={false}>
        <LabSelect label="Object distance" value={Number.isFinite(config.objectDistance) ? "near" : "infinity"} onChange={(v) => update("objectDistance", v === "infinity" ? Infinity : 5000)}><option value="infinity">Distant object (∞)</option><option value="near">Nearby test target</option></LabSelect>
        {Number.isFinite(config.objectDistance) && <LabRange label="Target distance" value={config.objectDistance / 1000} min={2} max={30} step={.1} unit="m" onChange={(v) => update("objectDistance", v * 1000)} />}
        <LabRange label="Field angle / target radius" value={config.fieldAngle} min={.05} max={1.2} step={.05} unit="°" onChange={(v) => update("fieldAngle", v)} />
        <LabCheck label="Geometric rays" checked={rays} onChange={setRays} /><LabCheck label="Moving light pulses" checked={pulses} onChange={setPulses} />
      </LabPanel>
      <details className="science-control-group" open={inspectorOpen} onToggle={(e) => setInspectorOpen(e.currentTarget.open)}><summary><span><b>07</b>Ray inspector</span><ChevronDown size={14} /></summary><div className="science-control-content">
        <LabSelect label="Inspected ray" value={selectedRay.id} onChange={setSelectedRayId}>{solution.rays.map((r) => <option key={r.id} value={r.id}>{r.wavelength} nm · {r.angle === 0 ? "axis" : "edge"} · pupil {r.pupil}</option>)}</LabSelect>
        <p className="optics-hint">In free space: y₂ = y₁ + d·u. At each thin lens: u₂ = u₁ − y/f(λ). Here u = dy/dx.</p>
        {selectedRay.interactions.map((hit) => <div key={hit.lensId} className="optics-ray-hit"><b>L{lenses.findIndex((l) => l.id === hit.lensId) + 1} · y = {hit.y.toFixed(4)} mm</b><span>f({selectedRay.wavelength}) = {hit.focalLength.toFixed(4)} mm</span><span>{hit.refractiveIndex === null ? "Ideal, wavelength independent" : `n = ${hit.refractiveIndex.toFixed(7)}`}</span><span>u in {hit.incomingSlope.toFixed(6)} → {hit.blocked ? "BLOCKED" : hit.outgoingSlope!.toFixed(6)}</span></div>)}
        <p className="optics-hint">Independent ABCD check: maximum {comparisonMode === "object" ? "viewing-plane" : "sensor"} coordinate difference {solution.matrixResidual.toExponential(1)} mm across all unblocked displayed rays.</p>
      </div></details>
      <Button variant="outline" size="sm" onClick={() => { setConfig(DEFAULT_VISUAL_OPTICS); setComparisonMode("object"); setEye(DEFAULT_EYE); setTarget("moon"); setSelectedLensId("eyepiece"); playback.reset(); }} className="w-full"><RotateCcw size={13} /> Restore defaults</Button>
    </>}
    readouts={comparisonMode === "object" ? <>
      <LabReadout label="Through lenses" value={visualStatus} detail={eyeSolution.status === "defocused" ? "Adjust lens spacing or viewing focus" : eyeSolution.orientation} accent />
      <LabReadout label="Magnification vs original" value={visual.relativeMagnification === null ? "—" : `${visual.relativeMagnification.toFixed(2)}×`} detail="Signed angular ratio · same 8° field" />
      <LabReadout label="Original object" value="1.00×" detail="Upright · direct unaided reference" />
      <LabReadout label="Output light" value={solution.focus === null ? "Parallel" : solution.focus > 0 ? "Converging" : "Diverging"} detail={solution.focus === null ? `${config.wavelength} nm · afocal group` : `Focal plane x = ${(last.x + solution.focus).toFixed(1)} mm`} />
      <LabReadout label="Chromatic focus span" value={solution.chromaticSpread === null ? solution.bands.every((b) => b.focus === null) ? "Afocal" : "Mixed" : `${solution.chromaticSpread.toFixed(2)} mm`} detail={config.lightMode === "mono" ? "One wavelength" : "Seven sampled wavelengths"} />
    </> : <>
      <LabReadout label="Sensor image" value={statusLabel} detail={`${config.wavelength} nm · ${solution.passedRays}/${solution.rays.length} rays pass lenses`} accent />
      <LabReadout label="Reference focus x" value={solution.focus === null ? "∞" : `${(last.x + solution.focus).toFixed(1)} mm`} detail={solution.focus !== null && solution.focus <= 0 ? "Virtual · before the last lens" : `From objective · ${config.wavelength} nm`} />
      <LabReadout label="Chromatic focus spread" value={solution.chromaticSpread === null ? "No shared span" : `${solution.chromaticSpread.toFixed(2)} mm`} detail={solution.chromaticSpread === null ? "Some bands have no real focus" : config.lightMode === "mono" ? "One wavelength selected" : "Axial span of all 7 real foci"} />
      <LabReadout label="Geometric blur" value={`${solution.blurDiameter.toFixed(3)} mm`} detail="Largest on-axis diameter · selected light" />
      <LabReadout label={eye.view === "unaided" ? "Unaided eye" : "Visual observation"} value={eyeSolution.status === "defocused" ? "Unfocused" : `${eyeSolution.angularMagnification.toFixed(2)}×`} detail={eyeSolution.status === "defocused" ? "Tune eyepiece or eye position" : `${eyeSolution.orientation} · ${eyeSolution.status === "focused" ? "sharp" : "color fringing"}`} />
    </>}
    insight={(solution.maxSlope > .15 ? `Large ray slope (${(Math.atan(solution.maxSlope) * 180 / Math.PI).toFixed(1)}°): the near-axis approximation is less accurate here. Reduce aperture or lens power. ` : "") + (comparisonMode === "object" ? visualMessage : focusMessage + (eyeSolution.status === "focused" ? ` Eye view: ${eyeSolution.orientation.toLowerCase()} at ${Math.abs(eyeSolution.angularMagnification).toFixed(1)}×.` : ""))}
    notes={<><p>This is a <b>paraxial thin-lens model in air</b>, valid for small ray slopes and thin lenses. Every displayed path uses the same computed coordinates as the ray inspector. Free propagation uses <code>y₂ = y₁ + d·u</code>; a lens changes slope by <code>u₂ = u₁ − y/f(λ)</code>. An independent ABCD matrix calculation checks sensor endpoints. The diagram magnifies the vertical scale, so drawn angles are not angle measurements.</p><p>SCHOTT N-BK7 refractive indices use the three-term Sellmeier equation with wavelength in µm. A lens's shape is held fixed: <code>f(λ) = f(d)·[n(d)−1]/[n(λ)−1]</code>, where d = 587.5618 nm. The spectrum samples seven wavelengths from 700 to 400 nm; monochromatic mode covers 380–750 nm. “Ideal” lenses deliberately have no dispersion. Clear apertures stop rays; the blur calculation accounts for the on-axis limiting pupil.</p><p>The default comparison shows the same object through the current lens group and directly without that group. Both panes use perceived orientation, a shared 8° apparent field, the same observer position and pupil. The direct reference focuses on the original object independently of telescope-side accommodation. Lens power, material and aperture changes do not alter the direct reference. In the separate advanced receiver experiment, the camera shows an uncorrected raw image on a 36 mm sensor while an eye adds focusing optics after the same group. A camera with an appropriate lens can also focus the parallel output; a bare sensor cannot. Eye view adds an ideal non-dispersive eye lens, a 17 mm retinal distance and a 2–7 mm pupil. Automatic accommodation is limited to 0–4 diopters; it cannot focus an arbitrary converging beam. The display shows perceived orientation, calibrated so an unaided eye is upright at 1×; the additional inversion on the retina is not shown as an upside-down world. For an afocal telescope <code>M = −f(objective)/f(eyepiece)</code>: the Keplerian preset is −4×, the Galilean preset +4×. A focused visual label uses a 10 µm geometric retinal-blur threshold. Both default panes use the same 8° scale. Only the advanced receiver experiment uses the different, labeled 36 mm camera and 8° eye scales. Default bench rays end at the viewing plane; advanced rays end at the sensor.</p><p>Targets, their moons and UP/R markers are illustrations with adjustable angular size. These are optical teaching views, not predictions of the detail a person can see. Preview blur is Gaussian, based on on-axis geometric blur, with display white balance; no diffraction PSF, exposure, atmospheric seeing, acuity, exact eye optics, or calibrated colors are modeled. Lens thickness, spherical aberration and exact curved-surface Snell refraction are outside this model. Light pulses are slowed; both views can be saved as local PNGs.</p><p><a href="https://media.schott.com/api/public/content/41e799d0bf874807a0bb8e702fbb75b5?v=54856406" target="_blank" rel="noreferrer">SCHOTT · N-BK7 dispersion</a><a href="https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses" target="_blank" rel="noreferrer">OpenStax · thin lenses</a><a href="https://labs.phys.utk.edu/mbreinig/phys421/modules/m5/Telescopes.html" target="_blank" rel="noreferrer">University of Tennessee · telescope orientation</a><a href="https://msl.cs.uiuc.edu/vr/node120.html" target="_blank" rel="noreferrer">University of Illinois · eye power & accommodation</a></p></>}
  />;
}
