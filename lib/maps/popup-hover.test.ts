import { describe, expect, it } from "vitest";
import { movingToPopup } from "./popup-hover";
const rect = { left: 80, right: 280, top: 0, bottom: 100 };
describe("popup pointer corridor", () => {
  it("keeps small-project popups reachable across the gap", () => {
    expect(movingToPopup({x:180,y:130},{x:180,y:130},{x:180,y:115},rect)).toBe(true);
  });
  it("supports a diagonal approach from a project edge", () => {
    expect(movingToPopup({x:10,y:200},{x:10,y:200},{x:50,y:150},rect)).toBe(true);
  });
  it("closes immediately when moving away or sideways outside the corridor", () => {
    expect(movingToPopup({x:180,y:130},{x:180,y:120},{x:180,y:145},rect)).toBe(false);
    expect(movingToPopup({x:180,y:130},{x:180,y:130},{x:300,y:120},rect)).toBe(false);
  });
});
