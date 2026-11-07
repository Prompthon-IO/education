import { multiplyMatrices, solveOptics, sortedLenses, systemMatrix, type OpticalConfig, type OpticalSolution } from "./telescope-optics";

export const RETINA_DISTANCE = 17; // mm, idealized reduced eye
export type EyeConfig = { view: "telescope" | "unaided"; relief: number; pupil: number; autoFocus: boolean; accommodation: number };
export type ComparisonMode = "object" | "detectors";
export const DEFAULT_EYE: EyeConfig = { view: "telescope", relief: 25, pupil: 3, autoFocus: true, accommodation: 0 };
export type EyeSolution = {
  config: OpticalConfig; optics: OpticalSolution; requiredAccommodation: number | null;
  accommodation: number; angularMagnification: number; retinalBlur: number;
  status: "focused" | "chromatic" | "defocused"; orientation: "Upright" | "Inverted 180°";
};
export function solveEye(config: OpticalConfig, eye: EyeConfig): EyeSolution {
  const lenses = sortedLenses(config), last = lenses[lenses.length - 1];
  const unaided = eye.view === "unaided", eyeX = unaided ? 0 : last.x + eye.relief;
  const actualObjectDistance = Number.isFinite(config.objectDistance) ? config.objectDistance + last.x + eye.relief : Infinity;
  const objectDistance = unaided ? actualObjectDistance : config.objectDistance;
  const fieldAngle = unaided && Number.isFinite(config.objectDistance)
    ? Math.atan(config.objectDistance * Math.tan(config.fieldAngle * Math.PI / 180) / actualObjectDistance) * 180 / Math.PI : config.fieldAngle;
  const beforeEye = unaided ? { a: 1, b: 0, c: 0, d: 1 }
    : multiplyMatrices({ a: 1, b: eye.relief, c: 0, d: 1 }, systemMatrix(config, config.wavelength));
  const invS = Number.isFinite(objectDistance) ? 1 / objectDistance : 0;
  const heightFactor = beforeEye.a + beforeEye.b * invS, slopeFactor = beforeEye.c + beforeEye.d * invS;
  const requiredAccommodation = Math.abs(heightFactor) < 1e-12 ? null : 1000 * slopeFactor / heightFactor;
  const accommodation = eye.autoFocus ? Math.max(0, Math.min(4, requiredAccommodation ?? 0)) : eye.accommodation;
  const eyeLens = { id: "observer-eye", x: eyeX, focalLength: 1 / (1 / RETINA_DISTANCE + accommodation / 1000), diameter: eye.pupil, glass: "ideal" as const };
  const opticalConfig: OpticalConfig = { ...config, objectDistance, fieldAngle, source: "axis", lenses: unaided ? [eyeLens] : [...lenses, eyeLens], sensorX: eyeX + RETINA_DISTANCE };
  const optics = solveOptics(opticalConfig), reference = optics.bands.find((b) => b.wavelength === config.wavelength) ?? optics;
  const finiteAngleCorrection = !unaided && Number.isFinite(config.objectDistance) ? actualObjectDistance / config.objectDistance : 1;
  // A direct eye has coefficient -17 mm and appears upright. Display perceived orientation,
  // rather than the additional inversion on the retina: M = -coefficient / 17.
  const angularMagnification = -reference.coefficient / RETINA_DISTANCE * finiteAngleCorrection;
  return { config: opticalConfig, optics, requiredAccommodation, accommodation, angularMagnification,
    retinalBlur: optics.blurDiameter, status: reference.blurDiameter < .01 ? optics.blurDiameter < .01 ? "focused" : "chromatic" : "defocused",
    orientation: angularMagnification < 0 ? "Inverted 180°" : "Upright" };
}

/** Same observer location, light and angular display scale; the reference bypasses the group. */
export function solveVisualComparison(config: OpticalConfig, eye: EyeConfig) {
  const through = solveEye(config, { ...eye, view: "telescope" });
  const direct = solveEye(config, { ...eye, view: "unaided", autoFocus: true });
  return { through, direct, fieldOfView: 8,
    relativeMagnification: through.status === "defocused" || direct.status === "defocused"
      ? null : through.angularMagnification / direct.angularMagnification };
}
