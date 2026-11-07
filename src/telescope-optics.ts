/** First-order optics in air. All lengths are mm; u = dy/dx is a paraxial slope.
 * Rays and ABCD matrices are evaluated independently and cross-checked.
 * Glass data: SCHOTT N-BK7 datasheet (2023), Sellmeier coefficients, λ in µm.
 * https://media.schott.com/api/public/content/41e799d0bf874807a0bb8e702fbb75b5?v=54856406
 */
export const REFERENCE_WAVELENGTH = 587.5618; // Fraunhofer d line, nm
export const SPECTRUM = [700, 620, 580, 550, 500, 450, 400] as const;
export const MAX_LENSES = 6;
export const MAX_SENSOR_X = 1600;
export type Glass = "bk7" | "ideal";
export type OpticalLens = { id: string; x: number; focalLength: number; diameter: number; glass: Glass };
export type OpticalConfig = {
  lenses: OpticalLens[]; sensorX: number; objectDistance: number; fieldAngle: number;
  lightMode: "mono" | "spectrum"; wavelength: number; source: "axis" | "field" | "both";
};
export const DEFAULT_OPTICS: OpticalConfig = {
  lenses: [
    { id: "objective", x: 0, focalLength: 400, diameter: 50, glass: "bk7" },
    { id: "barlow", x: 320, focalLength: -160, diameter: 40, glass: "bk7" },
  ],
  sensorX: 480, objectDistance: Infinity, fieldAngle: .35,
  lightMode: "spectrum", wavelength: 550, source: "axis",
};
/** A focused visual telescope makes through-versus-unaided comparison clear on first use. */
export const DEFAULT_VISUAL_OPTICS: OpticalConfig = {
  ...DEFAULT_OPTICS,
  lenses: [
    { id: "objective", x: 0, focalLength: 400, diameter: 50, glass: "ideal" },
    { id: "eyepiece", x: 500, focalLength: 100, diameter: 50, glass: "ideal" },
  ],
  sensorX: 700,
};
export type RayPoint = { x: number; y: number };
export type LensInteraction = {
  lensId: string; x: number; y: number; incomingSlope: number; outgoingSlope: number | null;
  focalLength: number; refractiveIndex: number | null; blocked: boolean;
};
export type OpticalRay = {
  id: string; wavelength: number; points: RayPoint[]; pupil: number; angle: number;
  incomingSlope: number; interactions: LensInteraction[]; blockedAt: string | null;
};
export type Matrix = { a: number; b: number; c: number; d: number };
export type FocusStatus = "focused" | "defocused" | "virtual" | "afocal";
export type SpectralSolution = {
  wavelength: number; focus: number | null; effectiveFocalLength: number | null;
  blurDiameter: number; center: number; coefficient: number; status: FocusStatus;
  matrix: Matrix; pupilDiameter: number;
};
export type OpticalSolution = Omit<SpectralSolution, "status"> & {
  status: FocusStatus | "chromatic" | "blocked"; bands: SpectralSolution[];
  chromaticSpread: number | null; fNumber: number | null; rays: OpticalRay[];
  maxSlope: number; matrixResidual: number; passedRays: number;
};

export function refractiveIndex(wavelength: number): number {
  const l2 = (wavelength / 1000) ** 2;
  const b = [1.03961212, .231792344, 1.01046945];
  const c = [.00600069867, .0200179144, 103.560653];
  return Math.sqrt(1 + b.reduce((sum, value, i) => sum + value * l2 / (l2 - c[i]), 0));
}
export function focalLengthAt(lens: OpticalLens, wavelength: number): number {
  // Fixed lens curvatures: 1/f(λ) = (n(λ)-1)(1/R1 - 1/R2).
  return lens.glass === "ideal" ? lens.focalLength
    : lens.focalLength * (refractiveIndex(REFERENCE_WAVELENGTH) - 1) / (refractiveIndex(wavelength) - 1);
}
export function sortedLenses(config: OpticalConfig) { return [...config.lenses].sort((a, b) => a.x - b.x); }
export function lensPositionBounds(config: OpticalConfig, id: string) {
  const lenses = sortedLenses(config), i = lenses.findIndex((l) => l.id === id);
  return i <= 0 ? { min: 0, max: 0 } : { min: lenses[i - 1].x + 10, max: (lenses[i + 1]?.x ?? config.sensorX) - 10 };
}
export function moveLens(config: OpticalConfig, id: string, position: number): OpticalConfig {
  const bounds = lensPositionBounds(config, id);
  return { ...config, lenses: config.lenses.map((l) => l.id === id ? { ...l, x: Math.max(bounds.min, Math.min(bounds.max, position)) } : l) };
}
export function addLens(config: OpticalConfig, id: string): OpticalConfig {
  if (config.lenses.length >= MAX_LENSES) return config;
  const lenses = sortedLenses(config), positions = [...lenses.map((l) => l.x), config.sensorX];
  let gap = 0;
  for (let i = 1; i < positions.length - 1; i++) if (positions[i + 1] - positions[i] > positions[gap + 1] - positions[gap]) gap = i;
  if (positions[gap + 1] - positions[gap] < 20) return config;
  const lens: OpticalLens = { id, x: (positions[gap] + positions[gap + 1]) / 2, focalLength: 250, diameter: 50, glass: "bk7" };
  return { ...config, lenses: [...lenses, lens].sort((a, b) => a.x - b.x) };
}
export function removeLens(config: OpticalConfig, id: string): OpticalConfig {
  if (id === sortedLenses(config)[0].id) return config;
  return { ...config, lenses: config.lenses.filter((l) => l.id !== id) };
}
export function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return { a: left.a * right.a + left.b * right.c, b: left.a * right.b + left.b * right.d,
    c: left.c * right.a + left.d * right.c, d: left.c * right.b + left.d * right.d };
}
export function systemMatrix(config: OpticalConfig, wavelength: number): Matrix {
  let matrix = { a: 1, b: 0, c: 0, d: 1 }, previous = 0;
  for (const lens of sortedLenses(config)) {
    matrix = multiplyMatrices({ a: 1, b: lens.x - previous, c: 0, d: 1 }, matrix);
    matrix = multiplyMatrices({ a: 1, b: 0, c: -1 / focalLengthAt(lens, wavelength), d: 1 }, matrix);
    previous = lens.x;
  }
  return matrix;
}
export function traceRay(config: OpticalConfig, wavelength: number, pupil: number, angle: number): OpticalRay {
  const lenses = sortedLenses(config), entrance = lenses[0].diameter / 2;
  const y0 = pupil * entrance;
  const incomingSlope = (Number.isFinite(config.objectDistance) ? y0 / config.objectDistance : 0) - Math.tan(angle * Math.PI / 180);
  const points = [{ x: -150, y: y0 - 150 * incomingSlope }];
  const interactions: LensInteraction[] = [];
  let y = y0, slope = incomingSlope, x = 0, blockedAt: string | null = null;
  for (const lens of lenses) {
    y += (lens.x - x) * slope; x = lens.x;
    points.push({ x, y });
    const f = focalLengthAt(lens, wavelength), blocked = Math.abs(y) > lens.diameter / 2 + 1e-9;
    interactions.push({ lensId: lens.id, x, y, incomingSlope: slope, outgoingSlope: blocked ? null : slope - y / f,
      focalLength: f, refractiveIndex: lens.glass === "bk7" ? refractiveIndex(wavelength) : null, blocked });
    if (blocked) { blockedAt = lens.id; break; }
    slope -= y / f;
  }
  if (!blockedAt) points.push({ x: config.sensorX, y: y + (config.sensorX - x) * slope });
  return { id: `${wavelength}:${angle}:${pupil}`, wavelength, points, pupil, angle, incomingSlope, interactions, blockedAt };
}
/** Exact entrance-pupil interval admitted by all apertures for this 2D point bundle. */
export function acceptedPupil(config: OpticalConfig, wavelength: number, angle: number): [number, number] | null {
  const lenses = sortedLenses(config);
  let low = -lenses[0].diameter / 2, high = -low, a = 1, b = 0;
  let uA = Number.isFinite(config.objectDistance) ? 1 / config.objectDistance : 0, uB = -Math.tan(angle * Math.PI / 180), x = 0;
  for (const lens of lenses) {
    a += (lens.x - x) * uA; b += (lens.x - x) * uB; x = lens.x;
    if (Math.abs(a) < 1e-12) { if (Math.abs(b) > lens.diameter / 2) return null; }
    else {
      const p = (-lens.diameter / 2 - b) / a, q = (lens.diameter / 2 - b) / a;
      low = Math.max(low, Math.min(p, q)); high = Math.min(high, Math.max(p, q));
      if (high - low < 1e-12) return null;
    }
    const f = focalLengthAt(lens, wavelength); uA -= a / f; uB -= b / f;
  }
  return [low, high];
}
function solveWavelength(config: OpticalConfig, wavelength: number): SpectralSolution {
  const lenses = sortedLenses(config), invS = Number.isFinite(config.objectDistance) ? 1 / config.objectDistance : 0;
  const matrix = systemMatrix(config, wavelength), z = config.sensorX - lenses[lenses.length - 1].x;
  const a = matrix.a + matrix.b * invS, c = matrix.c + matrix.d * invS;
  const focus = Math.abs(c) < 1e-12 ? null : -a / c;
  // The on-axis pupil is limited by every clear aperture, not just the first lens.
  let pupilRadius = lenses[0].diameter / 2, heightFactor = 1, slopeFactor = invS, x = 0;
  for (const lens of lenses) {
    heightFactor += (lens.x - x) * slopeFactor;
    if (Math.abs(heightFactor) > 1e-12) pupilRadius = Math.min(pupilRadius, lens.diameter / 2 / Math.abs(heightFactor));
    slopeFactor -= heightFactor / focalLengthAt(lens, wavelength); x = lens.x;
  }
  const blurDiameter = 2 * pupilRadius * Math.abs(a + z * c), coefficient = -(matrix.b + z * matrix.d);
  return { wavelength, matrix, focus, effectiveFocalLength: Math.abs(matrix.c) < 1e-12 ? null : -1 / matrix.c,
    blurDiameter, coefficient, center: coefficient * Math.tan(config.fieldAngle * Math.PI / 180), pupilDiameter: 2 * pupilRadius,
    status: focus === null ? "afocal" : focus <= 0 ? "virtual" : blurDiameter < .12 ? "focused" : "defocused" };
}
export function solveOptics(config: OpticalConfig): OpticalSolution {
  const wavelengths: readonly number[] = config.lightMode === "spectrum" ? SPECTRUM : [config.wavelength];
  const bands = wavelengths.map((w) => solveWavelength(config, w));
  const reference = bands.find((b) => b.wavelength === config.wavelength) ?? solveWavelength(config, config.wavelength);
  const angles = config.source === "axis" ? [0] : config.source === "field" ? [config.fieldAngle] : [0, config.fieldAngle];
  const rays = wavelengths.flatMap((w) => angles.flatMap((angle) => [-1, -.5, 0, .5, 1].map((pupil) => traceRay(config, w, pupil, angle))));
  let matrixResidual = 0, maxSlope = 0, passedRays = 0;
  const lastX = sortedLenses(config).slice(-1)[0].x, z = config.sensorX - lastX;
  for (const ray of rays) {
    for (const hit of ray.interactions) maxSlope = Math.max(maxSlope, Math.abs(hit.incomingSlope), Math.abs(hit.outgoingSlope ?? 0));
    if (ray.blockedAt) continue;
    passedRays++;
    const matrix = bands.find((b) => b.wavelength === ray.wavelength)!.matrix;
    const expected = (matrix.a + z * matrix.c) * ray.points[1].y + (matrix.b + z * matrix.d) * ray.incomingSlope;
    matrixResidual = Math.max(matrixResidual, Math.abs(ray.points.slice(-1)[0].y - expected));
  }
  const realFoci = bands.filter((b) => b.focus !== null && b.focus > 0).map((b) => b.focus!);
  const chromaticSpread = realFoci.length === bands.length ? Math.max(...realFoci) - Math.min(...realFoci) : null;
  const blurDiameter = Math.max(...bands.map((b) => b.blurDiameter));
  const status = !passedRays ? "blocked" : reference.status === "focused" && blurDiameter >= .12 ? "chromatic" : reference.status;
  return { ...reference, blurDiameter, bands, chromaticSpread, status, rays, maxSlope, matrixResidual, passedRays,
    fNumber: reference.effectiveFocalLength === null ? null : Math.abs(reference.effectiveFocalLength) / reference.pupilDiameter };
}

/** Display colors only; not a spectral power distribution or camera response. */
export function wavelengthRGB(wavelength: number): [number, number, number] {
  const w = wavelength;
  const rgb = w < 440 ? [(440 - w) / 60, 0, 1] : w < 490 ? [0, (w - 440) / 50, 1]
    : w < 510 ? [0, 1, (510 - w) / 20] : w < 580 ? [(w - 510) / 70, 1, 0]
    : w < 645 ? [1, (645 - w) / 65, 0] : [1, 0, 0];
  return rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)) as [number, number, number];
}
export function wavelengthColor(wavelength: number) { return `rgb(${wavelengthRGB(wavelength).join(",")})`; }
