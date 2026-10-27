import { createHash } from "node:crypto";

/**
 * Produce a stable, globally unique, URL-safe slug for a city set.
 *
 * City names are not guaranteed to be ASCII (e.g. 南京), and the old slugger
 * removed all non-ASCII characters, yielding an empty string and violating the
 * unique constraint on `city_sets.slug`. Including a deterministic hash of the
 * country/code/city tuple also prevents collisions such as Paris in two countries.
 *
 * Existing city sets retain their stored slug during upsert; this helper only
 * supplies a slug when the (country, city) pair is first created.
 */
export function buildCitySlug(
  countryCode: string,
  country: string,
  city: string,
): string {
  const base = city
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/g, "");

  const hash = createHash("sha256")
    .update(`${countryCode.trim().toUpperCase()}|${country.trim().toLowerCase()}|${city.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);

  return `${base || "city"}-${countryCode.trim().toLowerCase() || "xx"}-${hash}`;
}
