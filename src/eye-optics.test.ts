import { describe, expect, it } from "vitest";
import { DEFAULT_EYE, solveEye, solveVisualComparison } from "./eye-optics";
import { acceptedPupil, DEFAULT_OPTICS, solveOptics, type OpticalConfig } from "./telescope-optics";

const visual = (galilean = false): OpticalConfig => ({ ...DEFAULT_OPTICS, lenses: [
  { id: "objective", x: 0, focalLength: 400, diameter: 50, glass: "ideal" },
  { id: "eyepiece", x: galilean ? 300 : 500, focalLength: galilean ? -100 : 100, diameter: 50, glass: "ideal" },
], sensorX: 700 });
describe("camera and visual observers", () => {
  it("gives an unaided relaxed eye an upright 1x perceived image, with an inverted retinal image", () => {
    const eye = solveEye(DEFAULT_OPTICS, { ...DEFAULT_EYE, view: "unaided" });
    expect(eye.angularMagnification).toBeCloseTo(1, 12);
    expect(eye.orientation).toBe("Upright");
    expect(eye.optics.coefficient).toBeCloseTo(-17, 12);
    expect(eye.status).toBe("focused");
    expect(eye.requiredAccommodation).toBe(0);
  });
  it("models a Keplerian eyepiece as sharp and inverted at -4x while a bare camera is unfocused", () => {
    const eye = solveEye(visual(), DEFAULT_EYE);
    expect(eye.angularMagnification).toBeCloseTo(-4, 12);
    expect(eye.orientation).toBe("Inverted 180°");
    expect(eye.status).toBe("focused");
    expect(eye.requiredAccommodation).toBeCloseTo(0, 12);
    expect(solveOptics(visual()).status).toBe("afocal");
    expect(eye.retinalBlur).toBeLessThan(1e-10);
  });
  it("models a Galilean eyepiece as upright at +4x", () => {
    const eye = solveEye(visual(true), DEFAULT_EYE);
    expect(eye.angularMagnification).toBeCloseTo(4, 12);
    expect(eye.orientation).toBe("Upright");
    expect(eye.status).toBe("focused");
  });
  it("calculates accommodation for finite targets and clamps rather than faking impossible eye focus", () => {
    const near = solveEye({ ...DEFAULT_OPTICS, objectDistance: 2000 }, { ...DEFAULT_EYE, view: "unaided" });
    expect(near.requiredAccommodation).toBeCloseTo(1000 / (2000 + 320 + 25), 12);
    expect(near.retinalBlur).toBeLessThan(1e-10);
    const cameraFocused = solveEye(DEFAULT_OPTICS, DEFAULT_EYE);
    expect(cameraFocused.requiredAccommodation).toBeLessThan(0);
    expect(cameraFocused.accommodation).toBe(0);
    expect(cameraFocused.status).toBe("defocused");
    const manual = solveEye(visual(), { ...DEFAULT_EYE, autoFocus: false, accommodation: 4 });
    expect(manual.status).toBe("defocused");
  });
  it("admits the continuous pupil bundle even when sparse illustrated rays miss an eye aperture", () => {
    const eye = solveEye(visual(), DEFAULT_EYE);
    const interval = acceptedPupil(eye.config, 550, .35);
    expect(interval).not.toBeNull();
    expect(interval![1]).toBeGreaterThan(interval![0]);
    expect(acceptedPupil(eye.config, 550, 15)).toBeNull();
  });
  it("focuses the real intermediate image with positive accommodation when the eye moves behind it", () => {
    const eye = solveEye(DEFAULT_OPTICS, { ...DEFAULT_EYE, relief: 450 });
    expect(eye.requiredAccommodation).toBeGreaterThan(0);
    expect(eye.requiredAccommodation).toBeLessThan(4);
    expect(eye.optics.bands.find((b) => b.wavelength === 550)!.blurDiameter).toBeLessThan(1e-10);
    expect(eye.orientation).toBe("Inverted 180°");
    expect(eye.status).not.toBe("defocused");
  });
  it("compares the through-lens image with an upright 1x original on the same angular scale", () => {
    const inverted = solveVisualComparison(visual(), { ...DEFAULT_EYE, view: "unaided" });
    expect(inverted.fieldOfView).toBe(8);
    expect(inverted.through.orientation).toBe("Inverted 180°");
    expect(inverted.direct.orientation).toBe("Upright");
    expect(inverted.relativeMagnification).toBeCloseTo(-4, 12);
    expect(inverted.direct.angularMagnification).toBe(1);
    expect(solveVisualComparison(visual(true), DEFAULT_EYE).relativeMagnification).toBeCloseTo(4, 12);
  });
  it("keeps the original reference independent of lens focal lengths, materials and apertures", () => {
    const config = visual(), before = solveVisualComparison(config, DEFAULT_EYE);
    const altered = { ...config, lenses: config.lenses.map((l) => ({ ...l, glass: "bk7" as const, focalLength: l.focalLength * .8, diameter: 20 })) };
    const after = solveVisualComparison(altered, DEFAULT_EYE);
    expect(after.direct).toEqual(before.direct);
    expect(after.through.optics.coefficient).not.toBe(before.through.optics.coefficient);
    expect(after.direct.config.lenses).toHaveLength(1);
    expect(after.direct.config.lenses[0].id).toBe("observer-eye");
  });
  it("lets the direct reference focus on the original independently of telescope-side accommodation", () => {
    const result = solveVisualComparison(visual(), { ...DEFAULT_EYE, autoFocus: false, accommodation: 4 });
    expect(result.through.status).toBe("defocused");
    expect(result.direct.status).toBe("focused");
    expect(result.direct.accommodation).toBe(0);
    expect(result.relativeMagnification).toBeNull();
  });
  it("focuses an afocal telescope on a camera when a camera lens is supplied", () => {
    const group = visual();
    expect(solveOptics(group).status).toBe("afocal");
    const withCameraLens = { ...group, lenses: [...group.lenses,
      { id: "camera-lens", x: 525, focalLength: 50, diameter: 50, glass: "ideal" as const }], sensorX: 575 };
    const image = solveOptics(withCameraLens);
    expect(image.focus).toBeCloseTo(50, 12);
    expect(image.blurDiameter).toBeLessThan(1e-10);
    expect(image.status).toBe("focused");
  });
});
