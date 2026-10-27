import { describe, expect, it } from "vitest";
import { buildCitySlug } from "../city-slug";

describe("buildCitySlug", () => {
  it("returns a stable ASCII slug for non-Latin city names", () => {
    const slug = buildCitySlug("CN", "China", "南京");

    expect(slug).toMatch(/^city-cn-[a-f0-9]{12}$/);
    expect(buildCitySlug("CN", "China", "南京")).toBe(slug);
  });

  it("keeps slugs unique for same-named cities in different countries", () => {
    const parisFrance = buildCitySlug("FR", "France", "Paris");
    const parisTexas = buildCitySlug("US", "United States", "Paris");

    expect(parisFrance).toMatch(/^paris-fr-[a-f0-9]{12}$/);
    expect(parisTexas).toMatch(/^paris-us-[a-f0-9]{12}$/);
    expect(parisFrance).not.toBe(parisTexas);
  });

  it("normalizes diacritics and punctuation in ASCII city names", () => {
    expect(buildCitySlug("FR", "France", "Île-de-France")).toMatch(
      /^ile-de-france-fr-[a-f0-9]{12}$/,
    );
  });
});
