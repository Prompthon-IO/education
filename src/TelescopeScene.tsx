import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Camera, Download, Eye, Telescope } from "lucide-react";
import { acceptedPupil, MAX_SENSOR_X, moveLens, sortedLenses, wavelengthColor, wavelengthRGB, type OpticalConfig, type OpticalSolution, type RayPoint } from "./telescope-optics";
import { RETINA_DISTANCE, type ComparisonMode, type EyeSolution } from "./eye-optics";

export type OpticalTarget = "point" | "moon" | "saturn" | "jupiter" | "binary" | "arrow" | "chart";
export type Photo = { url: string; label: string; focused: boolean };
type Props = {
  config: OpticalConfig; solution: OpticalSolution; progress: number; rays: boolean; pulses: boolean;
  target: OpticalTarget; onConfigChange: (config: OpticalConfig) => void;
  captured: Photo | null; onCapture: (photo: Photo) => void;
  selectedLensId: string; onSelectLens: (id: string) => void; selectedRayId: string; onSelectRay: (id: string) => void;
  eye: EyeSolution; direct: EyeSolution; comparisonMode: ComparisonMode; eyeCapture: Photo | null;
  directCapture: Photo | null; onDirectCapture: (photo: Photo) => void;
  onViewDistanceChange: (distance: number) => void;
  onEyeCapture: (photo: Photo) => void; orientationMarkers: boolean;
};
function pointOnPath(points: RayPoint[], progress: number) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance = lengths.reduce((a, b) => a + b, 0) * progress;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const fraction = Math.min(1, distance / Math.max(lengths[i], 1e-10));
      return { x: points[i].x + (points[i + 1].x - points[i].x) * fraction, y: points[i].y + (points[i + 1].y - points[i].y) * fraction };
    }
    distance -= lengths[i];
  }
  return points[0];
}
export function TelescopeScene(p: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), eyeCanvas = useRef<HTMLCanvasElement>(null), svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; scale: number; matrix: DOMMatrix; startX: number; initial: number } | null>(null);
  const lenses = sortedLenses(p.config), last = lenses[lenses.length - 1];
  const objectComparison = p.comparisonMode === "object";
  const outputX = objectComparison ? p.eye.config.sensorX - RETINA_DISTANCE : p.config.sensorX;
  const xMin = -160, xMax = Math.max(650, outputX + 100);
  const sx = 850 / (xMax - xMin), sy = Math.min(3.5, 95 / Math.max(...lenses.map((l) => l.diameter / 2)));
  const axis = 224, toPoint = (pt: RayPoint) => ({ x: 55 + (pt.x - xMin) * sx, y: axis - pt.y * sy });
  const sensor = toPoint({ x: outputX, y: 0 }).x;
  const paths = p.solution.rays.map((r) => r.points.map(toPoint));
  const finiteFoci = p.solution.bands.filter((b) => b.focus !== null && b.focus > 0);
  const selectedLens = lenses.find((l) => l.id === p.selectedLensId)!;
  useEffect(() => {
    if (objectComparison) renderPhoto(canvas.current!, { ...p.eye.config, source: p.config.source }, p.eye.optics, p.target, { markers: p.orientationMarkers, eye: true });
    else renderPhoto(canvas.current!, p.config, p.solution, p.target, { markers: p.orientationMarkers });
  }, [objectComparison, p.config, p.solution, p.eye, p.target, p.orientationMarkers]);
  useEffect(() => {
    const view = objectComparison ? p.direct : p.eye;
    renderPhoto(eyeCanvas.current!, { ...view.config, source: p.config.source }, view.optics, p.target, { markers: p.orientationMarkers, eye: true });
  }, [objectComparison, p.direct, p.eye, p.config.source, p.target, p.orientationMarkers]);
  const beginDrag = (event: PointerEvent<SVGGElement>, id: string) => {
    const matrix = svg.current?.getScreenCTM()?.inverse(); if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    drag.current = { id, matrix, scale: sx, startX: point.x, initial: id === "sensor" || id === "view" ? outputX : lenses.find((l) => l.id === id)!.x };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (id !== "sensor" && id !== "view") p.onSelectLens(id);
  };
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(drag.current.matrix);
    const next = Math.round(drag.current.initial + (pt.x - drag.current.startX) / drag.current.scale);
    if (drag.current.id === "view") p.onViewDistanceChange(Math.max(10, Math.min(600, next - last.x)));
    else p.onConfigChange(drag.current.id === "sensor" ? { ...p.config, sensorX: Math.max(last.x + 10, Math.min(MAX_SENSOR_X, next)) } : moveLens(p.config, drag.current.id, next));
  };
  const capture = () => {
    const photo = { url: canvas.current!.toDataURL("image/png"), focused: objectComparison ? p.eye.status === "focused" : p.solution.status === "focused", label: `${p.target} · ${objectComparison ? "through lenses" : "camera"} · ${lenses.length} lenses` };
    if (objectComparison) p.onEyeCapture(photo); else p.onCapture(photo);
  };
  const captureEye = () => {
    const view = objectComparison ? p.direct : p.eye;
    const photo = { url: eyeCanvas.current!.toDataURL("image/png"), focused: view.status === "focused", label: `${p.target} · ${objectComparison ? "original object" : "eye through lenses"} · ${view.orientation}` };
    if (objectComparison) p.onDirectCapture(photo); else p.onEyeCapture(photo);
  };
  const cameraOriented = p.solution.status === "focused" || p.solution.status === "chromatic";
  return <div className="optics-comparison-layout"><div className="optics-ray-stage">
    <svg ref={svg} viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet" aria-label="Wavelength-dependent telescope ray diagram with movable lenses" onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} style={{ background: "#142230", touchAction: "none" }}>
      <defs>
        <pattern id="optics-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#9bbbc5" strokeWidth=".5" opacity=".10" /></pattern>
        <linearGradient id="optics-glass" x1="0" x2="1"><stop stopColor="#8bccdb" stopOpacity=".15" /><stop offset=".5" stopColor="#dcf8ff" stopOpacity=".35" /><stop offset="1" stopColor="#63afc2" stopOpacity=".2" /></linearGradient>
        <clipPath id="optics-ray-clip"><rect x="18" y="95" width="964" height="255" /></clipPath>
      </defs>
      <rect width="1000" height="560" fill="url(#optics-grid)" />
      <g fontFamily="'Geist Variable',sans-serif">
        <text x="25" y="29" fill="#d2e2e8" fontSize="11" fontWeight="650" letterSpacing="1.7">FOLLOW EVERY WAVELENGTH</text>
        <text x="25" y="49" fill="#829daa" fontSize="10">{selectedLens ? `Selected L${lenses.indexOf(selectedLens) + 1} · ${selectedLens.focalLength > 0 ? "+" : ""}${selectedLens.focalLength} mm at 587.56 nm · ${selectedLens.glass === "bk7" ? "N-BK7" : "ideal"}` : "Select a lens to tune its optical power"}</text>
        {p.config.lightMode === "spectrum" && <text x="25" y="67" fill="#607f91" fontSize="8">Incoming wavelengths overlap; refraction separates their paths.</text>}
        <text x="975" y="29" textAnchor="end" fill="#839eab" fontSize="9">Vertical scale ×{(sy / sx).toFixed(1)} · lens shapes schematic</text>
        <text x="975" y="49" textAnchor="end" fill="#839eab" fontSize="9">Bench rays → {objectComparison ? "viewing plane" : "camera"} · click to inspect</text>
        <line x1="25" y1={axis} x2="975" y2={axis} stroke="#99b0ba" strokeWidth=".7" strokeDasharray="5 5" opacity=".4" />
        <g clipPath="url(#optics-ray-clip)">
          {finiteFoci.map((b) => {
            const x = toPoint({ x: last.x + b.focus!, y: 0 }).x;
            return <line key={b.wavelength} x1={x} x2={x} y1={axis - 80} y2={axis + 80} stroke={wavelengthColor(b.wavelength)} strokeDasharray="2 5" opacity=".3" />;
          })}
          {p.solution.rays.map((ray, i) => {
            const points = paths[i], color = wavelengthColor(ray.wavelength), photon = pointOnPath(points, p.progress);
            const selected = ray.id === p.selectedRayId;
            return <g key={ray.id} data-ray-id={ray.id} data-wavelength={ray.wavelength} data-blocked={!!ray.blockedAt}>
              {p.rays && <><polyline points={points.map((pt) => `${pt.x},${pt.y}`).join(" ")} fill="none" stroke={color} strokeWidth={selected ? 2.3 : 1.1} opacity={selected ? 1 : .56} strokeDasharray={ray.angle ? "6 3" : undefined} />
                <polyline points={points.map((pt) => `${pt.x},${pt.y}`).join(" ")} fill="none" stroke="transparent" strokeWidth="8" onClick={() => p.onSelectRay(ray.id)} style={{ cursor: "crosshair" }}><title>{ray.wavelength} nm · pupil {ray.pupil} · click to inspect</title></polyline></>}
              {p.pulses && p.progress > 0 && p.progress < 1 && <circle cx={photon.x} cy={photon.y} r={selected ? 3.4 : 2.2} fill={color} />}
              {ray.blockedAt && <path d={`M${points.slice(-1)[0].x - 3},${points.slice(-1)[0].y - 3}l6,6m-6,0l6,-6`} stroke={color} strokeWidth="1.5" />}
            </g>;
          })}
          {p.rays && p.config.lightMode === "spectrum" && p.solution.rays.filter((r) => r.wavelength === p.config.wavelength).map((ray) => <polyline key={`incident-${ray.id}`} points={ray.points.slice(0, 2).map(toPoint).map((pt) => `${pt.x},${pt.y}`).join(" ")} fill="none" stroke="#dce8ec" strokeWidth="1" opacity=".65" pointerEvents="none" />)}
        </g>
        {lenses.map((lens, i) => {
          const x = toPoint({ x: lens.x, y: 0 }).x, h = lens.diameter / 2 * sy, active = lens.id === p.selectedLensId;
          return <g key={lens.id} role={i ? "slider" : "button"} tabIndex={0} aria-label={i ? `Move lens L${i + 1}` : "Select objective lens L1"} aria-valuenow={i ? lens.x : undefined} aria-valuemin={i ? lenses[i - 1].x + 10 : undefined} aria-valuemax={i ? (lenses[i + 1]?.x ?? p.config.sensorX) - 10 : undefined} onPointerDown={(event) => { p.onSelectLens(lens.id); if (i) beginDrag(event, lens.id); }} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); p.onSelectLens(lens.id); }
            if (i && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); p.onSelectLens(lens.id); p.onConfigChange(moveLens(p.config, lens.id, lens.x + (event.key === "ArrowRight" ? 5 : -5))); }
          }} style={{ cursor: i ? "ew-resize" : "pointer", outline: "none" }} className="optics-bench-lens" data-lens-id={lens.id}>
            <rect x={x - 15} y={axis - h - 8} width="30" height={h * 2 + 16} rx="9" fill={active ? "#ffc56b0c" : "transparent"} stroke={active ? "#e9b866" : "transparent"} strokeDasharray="3 4" />
            <path d={lens.focalLength > 0 ? `M${x},${axis - h}Q${x + 20},${axis} ${x},${axis + h}Q${x - 20},${axis} ${x},${axis - h}` : `M${x - 11},${axis - h}Q${x + 3},${axis} ${x - 11},${axis + h}L${x + 11},${axis + h}Q${x - 3},${axis} ${x + 11},${axis - h}Z`} fill="url(#optics-glass)" stroke={active ? "#f4c679" : "#8dc9dc"} strokeWidth="1.5" />
            <line x1={x} x2={x} y1={axis - h} y2={axis + h} stroke="#a6dded" opacity=".3" strokeWidth=".6" />
            <text x={x} y={108 - i % 3 * 14} textAnchor="middle" fontSize="11" fontWeight="650" fill={active ? "#f5c883" : "#a0bfce"}>L{i + 1}</text>
            <line x1={x} x2={x} y1={axis + h + 8} y2="354" stroke="#557181" strokeWidth=".6" />
            <rect x={x - 17} y="345" width="34" height="18" rx="4" fill={active ? "#3d3932" : "#243a49"} stroke={active ? "#d6ac6a" : "#516d7d"} />
            <text x={x} y="357" textAnchor="middle" fill="#bdd0d9" fontSize="9">{i ? "↔" : "0"}</text>
          </g>;
        })}
        <g role="slider" tabIndex={0} aria-label={objectComparison ? "Move viewing plane" : "Move camera sensor"} aria-valuenow={outputX} aria-valuemin={last.x + 10} aria-valuemax={objectComparison ? last.x + 600 : MAX_SENSOR_X} onPointerDown={(event) => beginDrag(event, objectComparison ? "view" : "sensor")} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); const delta = event.key === "ArrowRight" ? 1 : -1; if (objectComparison) p.onViewDistanceChange(Math.max(10, Math.min(600, outputX - last.x + delta))); else p.onConfigChange({ ...p.config, sensorX: Math.max(last.x + 10, Math.min(MAX_SENSOR_X, p.config.sensorX + delta)) }); } }} style={{ cursor: "ew-resize", outline: "none" }} className="optics-bench-sensor">
          <rect x={sensor - 13} y={axis - 18 * sy - 12} width="26" height={36 * sy + 24} rx="7" fill="transparent" />
          {objectComparison ? <line x1={sensor} x2={sensor} y1={axis - 90} y2={axis + 90} stroke="#a0cadf" strokeWidth="1.2" strokeDasharray="3 4" /> : <rect x={sensor - 4} y={axis - 18 * sy} width="8" height={36 * sy} rx="2" fill="#b7c9d9" stroke="#e1eff7" />}
          <text x={sensor} y={objectComparison ? 72 : 88} textAnchor="middle" fill="#e0ebf0" fontSize="10">{objectComparison ? "View plane" : "Sensor"}</text>
          <line x1={sensor} x2={sensor} y1={axis + 18 * sy + 8} y2="375" stroke="#9ab1bf" strokeWidth=".6" />
          <rect x={sensor - 26} y="366" width="52" height="18" rx="4" fill="#36495b" stroke="#90acbf" /><text x={sensor} y="378" textAnchor="middle" fill="#e0ebf0" fontSize="9">↔ {objectComparison ? "view" : "camera"}</text>
        </g>
        <line x1={toPoint({ x: 0, y: 0 }).x} x2={sensor} y1="399" y2="399" stroke="#526b7c" strokeWidth=".7" />
        <text x={toPoint({ x: 0, y: 0 }).x} y="412" fill="#92a8b4" fontSize="9">0 mm</text><text x={sensor} y="412" textAnchor="end" fill="#92a8b4" fontSize="9">{outputX.toFixed(1)} mm</text>
      </g>
    </svg>
    </div><div className="optics-observers" aria-label={objectComparison ? "Through lenses and original object comparison" : "Advanced camera and eye comparison"}>
      <div className="optics-comparison-caption">{objectComparison ? "SAME OBJECT · SAME 8° FIELD · THROUGH LENSES ↔ DIRECT VIEW" : "ADVANCED RECEIVER EXPERIMENT · BARE CAMERA SENSOR ↔ EYE"}</div>
      <ObservationCard canvas={canvas} kind={objectComparison ? "through" : "camera"} icon={objectComparison ? <Telescope size={11} /> : <Camera size={11} />}
        title={objectComparison ? "THROUGH CURRENT LENSES" : "CAMERA · 36 MM"} canvasLabel={objectComparison ? "View through current lens group" : "Camera raw sensor preview"}
        focused={objectComparison ? p.eye.status === "focused" : p.solution.status === "focused"}
        status={objectComparison ? eyeStatus(p.eye) : p.solution.status === "chromatic" ? "COLOR FRINGING" : p.solution.status.toUpperCase()}
        caption={objectComparison ? eyeCaption(p.eye) : `${cameraOriented ? p.solution.coefficient < 0 ? "Inverted 180°" : "Upright" : "No focused image"} · raw sensor, no auto-rotation`}
        captureLabel={objectComparison ? "Capture through lenses" : "Capture camera"} onCapture={capture} photo={objectComparison ? p.eyeCapture : p.captured}
        filename={objectComparison ? "telescope-through-lenses.png" : "telescope-camera.png"} downloadLabel={objectComparison ? "Download through-lenses view" : "Download captured telescope photo"} fieldOfView={objectComparison ? "8deg" : "36mm"} />
      <ObservationCard canvas={eyeCanvas} kind={objectComparison ? "unaided" : "eye"} icon={<Eye size={11} />}
        title={objectComparison ? "ORIGINAL OBJECT · UNAIDED" : "EYE THROUGH TELESCOPE"} canvasLabel={objectComparison ? "Original object direct view" : "Perceived eye observation preview"}
        focused={(objectComparison ? p.direct : p.eye).status === "focused"} status={eyeStatus(objectComparison ? p.direct : p.eye)} caption={eyeCaption(objectComparison ? p.direct : p.eye)}
        captureLabel={objectComparison ? "Capture original" : "Capture eye view"} onCapture={captureEye} photo={objectComparison ? p.directCapture : p.eyeCapture}
        filename={objectComparison ? "telescope-original.png" : "telescope-eye.png"} downloadLabel={objectComparison ? "Download original view" : "Download captured eye view"} fieldOfView="8deg" />
    </div></div>;
}

function eyeStatus(view: EyeSolution) { return view.status === "focused" ? "SHARP" : view.status === "chromatic" ? "COLOR FRINGING" : "UNFOCUSED"; }
function eyeCaption(view: EyeSolution) { return `${view.status === "defocused" ? "Visual focus unavailable" : `${view.orientation} · ${view.angularMagnification.toFixed(2)}×`} · 8° apparent field`; }
function ObservationCard(p: {
  canvas: RefObject<HTMLCanvasElement | null>; kind: string; icon: ReactNode; title: string; canvasLabel: string;
  focused: boolean; status: string; caption: string; captureLabel: string; onCapture: () => void;
  photo: Photo | null; filename: string; downloadLabel: string; fieldOfView: string;
}) {
  return <div className="optics-observer-card" data-observer={p.kind} data-field-of-view={p.fieldOfView}>
    <div className="science-capture-head"><span>{p.icon}{p.title}</span><b className={p.focused ? "" : "out"}>{p.status}</b></div>
    <canvas ref={p.canvas} width="720" height="480" aria-label={p.canvasLabel} />
    <div className="optics-observer-caption">{p.caption}</div>
    <div className="science-capture-actions"><button onClick={p.onCapture}>{p.icon}{p.captureLabel}</button>{p.photo && <a href={p.photo.url} download={p.filename} aria-label={p.downloadLabel}><Download size={12} /> PNG</a>}</div>
  </div>;
}

function renderPhoto(canvas: HTMLCanvasElement, config: OpticalConfig, solution: OpticalSolution, target: OpticalTarget, options: { eye?: boolean; markers?: boolean } = {}) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 720, 480); ctx.fillStyle = "#060b13"; ctx.fillRect(0, 0, 720, 480);
  if (!solution.passedRays) return;
  const channelTotals = [0, 0, 0];
  for (const band of solution.bands) wavelengthRGB(band.wavelength).forEach((value, channel) => { channelTotals[channel] += value; });
  for (const band of solution.bands) {
    if (!solution.rays.some((ray) => ray.wavelength === band.wavelength && !ray.blockedAt)) continue;
    const source = document.createElement("canvas"); source.width = 720; source.height = 480;
    const src = source.getContext("2d")!;
    const pixelScale = options.eye ? 720 / (2 * RETINA_DISTANCE * Math.tan(4 * Math.PI / 180)) : 20;
    const coefficient = options.eye ? -band.coefficient : band.coefficient;
    if (target === "point") {
      const angles = config.source === "axis" ? [0] : config.source === "field" ? [config.fieldAngle] : [0, config.fieldAngle];
      src.fillStyle = "white";
      for (const angle of angles) { if (!acceptedPupil(config, band.wavelength, angle)) continue; const y = coefficient * Math.tan(angle * Math.PI / 180); src.beginPath(); src.arc(360, 240 - y * pixelScale, 4, 0, Math.PI * 2); src.fill(); }
    } else {
      src.save(); src.translate(360, 240); if (coefficient < 0) src.rotate(Math.PI);
      const r = Math.max(2, Math.min(650, Math.abs(coefficient * Math.tan(config.fieldAngle * Math.PI / 180)) * pixelScale));
      drawTarget(src, target, r);
      if (options.markers && target !== "arrow") { src.strokeStyle = "#d8ebff"; src.fillStyle = "#d8ebff"; src.lineWidth = Math.max(1.5, r * .012); src.beginPath(); src.moveTo(-r * 1.15, -r * .7); src.lineTo(-r * 1.15, -r * 1.15); src.lineTo(-r * 1.25, -r * 1.02); src.moveTo(-r * 1.15, -r * 1.15); src.lineTo(-r * 1.05, -r * 1.02); src.stroke(); src.font = `600 ${Math.max(12, r * .17)}px sans-serif`; src.fillText("UP", -r * 1.27, -r * 1.28); src.fillText("R →", r * 1.1, 0); }
      src.restore();
    }
    // Tint retains target texture. The display mixture is explicitly not a radiometric camera model.
    const tinted = document.createElement("canvas"); tinted.width = 720; tinted.height = 480;
    const tint = tinted.getContext("2d")!; tint.drawImage(source, 0, 0);
    const rgb = wavelengthRGB(band.wavelength).map((value, channel) => config.lightMode === "spectrum" ? value / Math.max(1, channelTotals[channel]) * 255 : value);
    // Neutral display white balance; this changes presentation only, never ray paths or focus.
    tint.globalCompositeOperation = "multiply"; tint.fillStyle = `rgb(${rgb.join(",")})`; tint.fillRect(0, 0, 720, 480);
    tint.globalCompositeOperation = "destination-in"; tint.drawImage(source, 0, 0);
    const blur = Math.min(100, band.blurDiameter * pixelScale / 3.5);
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1;
    ctx.filter = blur > .1 ? `blur(${blur}px)` : "none"; ctx.drawImage(tinted, 0, 0);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  // Display-only automatic exposure makes severe defocus visible without changing geometry.
  const frame = ctx.getImageData(0, 0, 720, 480), background = [6, 11, 19];
  let peak = 0;
  for (let i = 0; i < frame.data.length; i += 4) for (let c = 0; c < 3; c++) peak = Math.max(peak, frame.data[i + c] - background[c]);
  if (peak > 0 && peak < 180) {
    const gain = Math.min(128, 180 / peak);
    for (let i = 0; i < frame.data.length; i += 4) for (let c = 0; c < 3; c++) frame.data[i + c] = background[c] + Math.max(0, frame.data[i + c] - background[c]) * gain;
    ctx.putImageData(frame, 0, 0);
  }
}
function drawTarget(src: CanvasRenderingContext2D, target: Exclude<OpticalTarget, "point">, r: number) {
  if (target === "moon") {
    const g = src.createRadialGradient(-r * .32, -r * .3, r * .04, 0, 0, r);
    g.addColorStop(0, "#eee9d9"); g.addColorStop(.7, "#c9c6bc"); g.addColorStop(1, "#6d7480"); src.fillStyle = g; src.beginPath(); src.arc(0, 0, r, 0, Math.PI * 2); src.fill();
    src.save(); src.beginPath(); src.arc(0, 0, r, 0, Math.PI * 2); src.clip();
    for (let i = 0; i < 55; i++) {
      const a = i * 2.39996, dist = r * Math.sqrt((i + .5) / 55), x = Math.cos(a) * dist, y = Math.sin(a) * dist;
      const cr = r * (.025 + ((Math.sin(i * 17) + 1) / 2) * .09);
      src.fillStyle = i % 4 === 0 ? "#555c6555" : "#777e8738"; src.beginPath(); src.ellipse(x, y, cr, cr * .83, a, 0, Math.PI * 2); src.fill(); src.lineWidth = Math.max(.4, r * .007); src.strokeStyle = "#ffffe63b"; src.stroke();
    } src.restore();
  } else if (target === "saturn") {
    src.rotate(-.34);
    const ring = (front: boolean) => { src.strokeStyle = "#b8ac93"; src.lineWidth = r * .25; src.beginPath(); src.ellipse(0, 0, r * 1.65, r * .5, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); src.stroke(); src.strokeStyle = "#6d6f7377"; src.lineWidth = r * .035; src.beginPath(); src.ellipse(0, 0, r * 1.63, r * .5, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); src.stroke(); };
    ring(false); const g = src.createLinearGradient(-r, -r, r, r); g.addColorStop(0, "#efe0ba"); g.addColorStop(.65, "#c3ab7f"); g.addColorStop(1, "#6e6255"); src.fillStyle = g; src.beginPath(); src.arc(0, 0, r * .82, 0, Math.PI * 2); src.fill();
    src.save(); src.beginPath(); src.arc(0, 0, r * .82, 0, Math.PI * 2); src.clip(); src.strokeStyle = "#8e7c5b44"; src.lineWidth = r * .06; for (let i = -2; i < 4; i++) { src.beginPath(); src.ellipse(0, i * r * .18, r * .95, r * .08, 0, 0, Math.PI); src.stroke(); } src.restore(); ring(true);
  } else if (target === "jupiter") {
    src.save(); src.beginPath(); src.arc(0, 0, r * .8, 0, Math.PI * 2); src.clip(); src.fillStyle = "#e7cfad"; src.fillRect(-r, -r, 2 * r, 2 * r);
    for (let i = -4; i <= 4; i++) { src.fillStyle = i % 2 ? "#a57759" : "#e9d8bd"; src.fillRect(-r, i * r * .18, 2 * r, r * .11); }
    src.fillStyle = "#b27653"; src.beginPath(); src.ellipse(r * .35, r * .27, r * .19, r * .10, .15, 0, Math.PI * 2); src.fill(); src.restore();
    for (const [i, x] of [-1.8, -1.2, 1.35, 1.9].entries()) { src.fillStyle = "#e8e1ca"; src.beginPath(); src.arc(x * r, (i % 2 ? .14 : -.12) * r, Math.max(2, r * .045), 0, Math.PI * 2); src.fill(); }
  } else if (target === "binary") {
    for (const sign of [-1, 1]) { const x = sign * r * .5, y = -sign * r * .2; src.fillStyle = "#fff4dd"; src.beginPath(); src.arc(x, y, Math.max(2.5, r * .055), 0, Math.PI * 2); src.fill(); }
  } else if (target === "arrow") {
    src.fillStyle = "#e7eff8"; src.beginPath(); src.moveTo(0, -r); src.lineTo(r * .5, -r * .3); src.lineTo(r * .18, -r * .3); src.lineTo(r * .18, r * .65); src.lineTo(-r * .18, r * .65); src.lineTo(-r * .18, -r * .3); src.lineTo(-r * .5, -r * .3); src.closePath(); src.fill();
    src.font = `700 ${Math.max(12, r * .3)}px sans-serif`; src.textAlign = "center"; src.fillText("UP", 0, -r * 1.18); src.fillText("R →", r * .8, r * .45);
  } else {
    src.fillStyle = "#e9e4d8"; src.fillRect(-r, -r, r * 2, r * 2); src.fillStyle = "#14202e";
    for (let i = 0; i < 8; i++) src.fillRect(-r * .85 + i * r * .11, -r * .75, r * .05, r * 1.15);
    src.font = `700 ${Math.max(4, r * .24)}px sans-serif`; src.textAlign = "center"; src.fillText("SPACE", 0, r * .78);
  }
}
