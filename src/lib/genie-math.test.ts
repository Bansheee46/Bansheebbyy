import { describe, it, expect } from "vitest";
import { clamp, lerp, eioC, eIn2, eOut2 } from "./genie-math";

describe("clamp", () => {
  it("clamps value below range", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps value above range", () => expect(clamp(15, 0, 10)).toBe(10));
  it("returns value within range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("handles min equals max", () => expect(clamp(5, 3, 3)).toBe(3));
});

describe("lerp", () => {
  it("returns a at t=0", () => expect(lerp(0, 100, 0)).toBe(0));
  it("returns b at t=1", () => expect(lerp(0, 100, 1)).toBe(100));
  it("returns midpoint at t=0.5", () => expect(lerp(0, 100, 0.5)).toBe(50));
  it("works with negative values", () => expect(lerp(-10, 10, 0.5)).toBe(0));
});

describe("eioC (cubic ease-in-out)", () => {
  it("returns 0 at t=0", () => expect(eioC(0)).toBe(0));
  it("returns 1 at t=1", () => expect(eioC(1)).toBe(1));
  it("returns 0.5 at t=0.5", () => {
    const v = eioC(0.5);
    expect(v).toBeCloseTo(0.5, 10);
  });
});

describe("eIn2 (quadratic ease-in)", () => {
  it("returns 0 at t=0", () => expect(eIn2(0)).toBe(0));
  it("returns 1 at t=1", () => expect(eIn2(1)).toBe(1));
  it("returns 0.25 at t=0.5", () => expect(eIn2(0.5)).toBe(0.25));
});

describe("eOut2 (quadratic ease-out)", () => {
  it("returns 0 at t=0", () => expect(eOut2(0)).toBe(0));
  it("returns 1 at t=1", () => expect(eOut2(1)).toBe(1));
  it("returns 0.75 at t=0.5", () => expect(eOut2(0.5)).toBe(0.75));
});
