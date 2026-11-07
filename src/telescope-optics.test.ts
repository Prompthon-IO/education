import { describe, expect, it } from "vitest";
import { addLens, DEFAULT_OPTICS, focalLengthAt, lensPositionBounds, MAX_LENSES, moveLens, REFERENCE_WAVELENGTH, refractiveIndex, removeLens, solveOptics, SPECTRUM, systemMatrix, traceRay, type OpticalConfig, type OpticalLens } from "./telescope-optics";

const objective: OpticalLens = { id: "objective", x: 0, focalLength: 400, diameter: 50, glass: "ideal" };
const single: OpticalConfig = { ...DEFAULT_OPTICS, lenses: [objective], sensorX: 400, lightMode: "mono", source: "both", wavelength: REFERENCE_WAVELENGTH };
const barlow: OpticalConfig = { ...single, lenses: [objective, { id: "barlow", x: 320, focalLength: -160, diameter: 50, glass: "ideal" }], sensorX: 480 };

describe("wavelength-dependent lens groups", () => {
  it("matches manufacturer refractive indices at four independent spectral lines", () => {
    // Both wavelengths and indices in the manufacturer table are rounded.
    for (const [wavelength, index] of [[656.3, 1.51432], [587.6, 1.51680], [486.1, 1.52238], [404.7, 1.53024]]) {
      expect(Math.abs(refractiveIndex(wavelength) - index)).toBeLessThan(1e-5);
    }
  });
  it("keeps reference shape fixed and gives violet a shorter positive focal length", () => {
    const glass = { ...objective, glass: "bk7" as const };
    expect(focalLengthAt(glass, REFERENCE_WAVELENGTH)).toBe(400);
    expect(focalLengthAt(glass, 400)).toBeLessThan(focalLengthAt(glass, 700));
    expect(focalLengthAt(glass, 700)).toBeGreaterThan(400);
    expect(focalLengthAt(objective, 400)).toBe(focalLengthAt(objective, 700));
    const negative = { ...glass, focalLength: -160 };
    expect(Math.abs(focalLengthAt(negative, 400))).toBeLessThan(Math.abs(focalLengthAt(negative, 700)));
  });
  it("focuses each pupil ray from the same object point at a single ideal objective", () => {
    const result = solveOptics(single);
    expect(result.focus).toBe(400);
    expect(result.effectiveFocalLength).toBe(400);
    expect(result.blurDiameter).toBeCloseTo(0);
    expect(result.status).toBe("focused");
    result.rays.forEach((r) => expect(r.points.slice(-1)[0].y).toBeCloseTo(r.angle === 0 ? 0 : -400 * Math.tan(single.fieldAngle * Math.PI / 180), 10));
  });
  it("satisfies the Gaussian lens equation for finite object distance", () => {
    const config = { ...single, objectDistance: 4000 }, expected = 1 / (1 / 400 - 1 / 4000);
    expect(solveOptics(config).focus).toBeCloseTo(expected, 10);
    const focused = solveOptics({ ...config, sensorX: expected });
    expect(focused.blurDiameter).toBeLessThan(1e-10);
    focused.rays.filter((r) => r.angle !== 0).forEach((r) => expect(r.points.slice(-1)[0].y).toBeCloseTo(focused.center, 10));
  });
  it("reproduces the 2x Barlow effective focal length and its separate back focus", () => {
    const result = solveOptics(barlow);
    expect(result.effectiveFocalLength).toBeCloseTo(800, 10);
    expect(result.focus).toBeCloseTo(160, 10);
    expect(result.status).toBe("focused");
    result.rays.filter((r) => r.angle !== 0).forEach((r) => expect(r.points.slice(-1)[0].y).toBeCloseTo(result.center, 10));
    expect(systemMatrix(barlow, 550).c).toBeCloseTo(-1 / 400 - 1 / -160 + 320 / (400 * -160), 12);
  });
  it("distinguishes afocal, virtual and defocused groups", () => {
    const second = barlow.lenses[1];
    const afocal = solveOptics({ ...barlow, lenses: [objective, { ...second, focalLength: 100, x: 500 }], sensorX: 700 });
    expect(afocal.status).toBe("afocal");
    expect(afocal.focus).toBeNull();
    expect(afocal.effectiveFocalLength).toBeNull();
    expect(solveOptics({ ...barlow, lenses: [objective, { ...second, focalLength: -80, x: 200 }] }).status).toBe("virtual");
    expect(solveOptics({ ...single, sensorX: 420 }).status).toBe("defocused");
    expect(solveOptics({ ...single, sensorX: 420, lenses: [{ ...objective, diameter: 25 }] }).blurDiameter)
      .toBeCloseTo(solveOptics({ ...single, sensorX: 420 }).blurDiameter / 2);
  });
  it("computes seven different spectral foci and never labels reference-only focus white-light focus", () => {
    const config = { ...single, lenses: [{ ...objective, glass: "bk7" as const }], lightMode: "spectrum" as const, wavelength: 550 };
    const result = solveOptics(config), greenFocus = result.bands.find((b) => b.wavelength === 550)!.focus!;
    expect(result.bands.map((b) => b.wavelength)).toEqual([...SPECTRUM]);
    expect(result.bands[0].focus).toBeGreaterThan(result.bands[6].focus!);
    expect(result.chromaticSpread).toBeGreaterThan(10);
    const focused = solveOptics({ ...config, sensorX: greenFocus });
    expect(focused.bands.find((b) => b.wavelength === 550)!.blurDiameter).toBeLessThan(1e-10);
    expect(focused.status).toBe("chromatic");
    expect(focused.blurDiameter).toBeGreaterThan(.12);
    expect(solveOptics({ ...config, lightMode: "mono", sensorX: greenFocus }).status).toBe("focused");
    const ideal = solveOptics({ ...config, lenses: [objective], sensorX: 400 });
    expect(ideal.chromaticSpread).toBe(0);
    expect(ideal.status).toBe("focused");
  });
  it("stops rays at a missed aperture and uses the actual limiting on-axis pupil", () => {
    const clipped = { ...single, lenses: [objective, { id: "stop", x: 200, focalLength: 1000, diameter: 8, glass: "ideal" as const }], source: "axis" as const };
    const result = solveOptics(clipped);
    expect(result.pupilDiameter).toBeCloseTo(16, 10);
    expect(result.passedRays).toBe(1);
    expect(result.rays.filter((r) => r.blockedAt).length).toBe(4);
    result.rays.filter((r) => r.blockedAt).forEach((r) => {
      expect(r.points.slice(-1)[0].x).toBe(200);
      expect(r.interactions.slice(-1)[0].outgoingSlope).toBeNull();
    });
    const allBlocked = solveOptics({ ...clipped, source: "field", fieldAngle: 1.2, lenses: [{ ...objective, diameter: 8 }, { ...clipped.lenses[1], x: 300 }] });
    expect(allBlocked.passedRays).toBe(0);
    expect(allBlocked.status).toBe("blocked");
  });
  it("checks every segment and lens kick against independent ray matrices for one to six lenses", () => {
    for (let count = 1; count <= 6; count++) {
      const lenses: OpticalLens[] = Array.from({ length: count }, (_, i) => ({ id: `l${i}`, x: i * 130, focalLength: i % 2 ? -350 : 500, diameter: 100, glass: i % 3 ? "bk7" : "ideal" }));
      for (const objectDistance of [Infinity, 5000]) {
        const config = { ...single, lenses, objectDistance, sensorX: count * 130 + 250, lightMode: "spectrum" as const };
        const result = solveOptics(config);
        expect(result.rays).toHaveLength(70);
        expect(result.matrixResidual).toBeLessThan(1e-9);
        for (const band of result.bands) expect(band.matrix.a * band.matrix.d - band.matrix.b * band.matrix.c).toBeCloseTo(1, 10);
        for (const ray of result.rays) {
          let u = ray.incomingSlope, previous = ray.points[0];
          ray.interactions.forEach((hit) => {
            expect(hit.y).toBeCloseTo(previous.y + (hit.x - previous.x) * u, 10);
            expect(hit.incomingSlope).toBeCloseTo(u, 10);
            if (!hit.blocked) { u -= hit.y / hit.focalLength; expect(hit.outgoingSlope).toBeCloseTo(u, 10); }
            previous = { x: hit.x, y: hit.y };
          });
          if (!ray.blockedAt) expect(ray.points.slice(-1)[0].y).toBeCloseTo(previous.y + (config.sensorX - previous.x) * u, 10);
          expect(ray.points.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))).toBe(true);
        }
      }
    }
  });
  it("gives a finite-distance bundle a common object point before entering the objective", () => {
    for (const pupil of [-1, -.5, 0, .5, 1]) {
      const config = { ...single, objectDistance: 4000 };
      const ray = traceRay(config, 550, pupil, config.fieldAngle);
      const atObject = ray.points[1].y - config.objectDistance * ray.incomingSlope;
      expect(atObject).toBeCloseTo(config.objectDistance * Math.tan(config.fieldAngle * Math.PI / 180), 10);
    }
  });
  it("inserts between existing elements, changes the optics, and restores it when removed", () => {
    const added = addLens(barlow, "new");
    expect(added.lenses.map((l) => l.x)).toEqual([0, 160, 320]);
    expect(added.sensorX).toBe(barlow.sensorX);
    expect(solveOptics(added).effectiveFocalLength).not.toBeCloseTo(solveOptics(barlow).effectiveFocalLength!);
    expect(solveOptics(removeLens(added, "new")).focus).toBe(solveOptics(barlow).focus);
    expect(removeLens(added, "objective").lenses).toHaveLength(3);
    const moved = moveLens(added, "new", 10000);
    expect(moved.lenses.find((l) => l.id === "new")!.x).toBe(310);
    expect(moved.sensorX).toBe(added.sensorX);
    expect(lensPositionBounds(added, "new")).toEqual({ min: 10, max: 310 });
    let many = single;
    for (let i = 0; i < 10; i++) many = addLens(many, `add-${i}`);
    expect(many.lenses).toHaveLength(MAX_LENSES);
  });
});
