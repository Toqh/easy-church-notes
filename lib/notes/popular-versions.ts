import type { BibleVersion } from "./types.ts";

export const popularDefinitions = [
  { abbreviation: "KJV", title: "King James Version" },
  { abbreviation: "NIV", title: "New International Version" },
  { abbreviation: "NLT", title: "New Living Translation" },
  { abbreviation: "TPT", title: "The Passion Translation" },
  { abbreviation: "NKJV", title: "New King James Version" },
  { abbreviation: "ESV", title: "English Standard Version" },
  { abbreviation: "AMP", title: "Amplified Bible" },
  { abbreviation: "MSG", title: "The Message" },
];
export interface PopularVersion {
  abbreviation: string;
  title: string;
  id?: number;
  status: "available" | "needs_access" | "not_listed" | "unavailable";
}
export function popularVersions(licensed: BibleVersion[], catalogue?: BibleVersion[]): PopularVersion[] {
  return popularDefinitions.map(definition => {
    const matches = (v: BibleVersion) => v.abbreviation.toUpperCase() === definition.abbreviation;
    const allowed = licensed.find(matches);
    const listed = catalogue?.find(matches);
    return { ...definition, id: allowed?.id ?? listed?.id, status: allowed ? "available" : listed ? "needs_access" : catalogue ? "not_listed" : "unavailable" };
  });
}
