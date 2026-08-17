import { describe, expect, it } from "vitest";
import {
  type Registry,
  renderAmbientDts,
  renderDts,
  renderModule,
} from "./registry";

const registry: Registry = {
  "product-workers": { body: "<path/>", viewBox: "0 0 24 24", variant: "mono" },
  x: { body: "<path/>", viewBox: "0 0 24 24", variant: "duo" },
};

describe("renderDts", () => {
  const dts = renderDts(registry);

  it("lists all names in IconName", () => {
    expect(dts).toMatch(/export type IconName = "product-workers" \| "x";/);
  });
  it("lists only duo names in DuoIconName", () => {
    expect(dts).toMatch(/export type DuoIconName = "x";/);
  });
  it("does not put the virtual-module declaration in the types file", () => {
    expect(dts).not.toMatch(/declare module/);
  });
  it("uses never for an empty duo set", () => {
    expect(renderDts({})).toMatch(/export type DuoIconName = never;/);
  });
});

describe("renderAmbientDts", () => {
  const ambient = renderAmbientDts();

  it("declares the virtual:icons module", () => {
    expect(ambient).toMatch(/declare module "virtual:icons"/);
    expect(ambient).toMatch(/export const ICONS: Record<string, IconEntry>;/);
  });
});

describe("renderModule", () => {
  it("emits an ICONS export with the serialized registry", () => {
    const mod = renderModule(registry);
    expect(mod).toMatch(/export const ICONS = /);
    expect(mod).toContain('"product-workers"');
    expect(
      JSON.parse(mod.replace(/^export const ICONS = /, "").replace(/;\s*$/, ""))
    ).toHaveProperty("x.variant", "duo");
  });
});
