import type { BibleVersion } from "@/lib/notes/types";
import { popularVersions, type PopularVersion } from "@/lib/notes/popular-versions";

export default function VersionOptions({ versions, popular, placeholder = "Loading…", fullNames = false }: {
  versions: BibleVersion[]; popular?: PopularVersion[]; placeholder?: string; fullNames?: boolean;
}) {
  const entries = popular ?? popularVersions(versions);
  const grouped = new Set(entries.filter(v => v.status === "available").map(v => v.id));
  const other = versions.filter(v => !grouped.has(v.id));
  return <>
    {!versions.length && <option value="">{placeholder}</option>}
    <optgroup label="Popular versions">
      {entries.map(v => <option key={v.abbreviation} value={v.status === "available" ? v.id : `unavailable-${v.abbreviation}`} disabled={v.status !== "available"}>
        {v.abbreviation}{fullNames ? ` — ${v.title}` : ""}{v.status === "needs_access" ? " — Enable publisher access" : v.status === "not_listed" ? " — Unavailable" : v.status === "unavailable" ? " — Not enabled for this app" : ""}
      </option>)}
    </optgroup>
    {!!other.length && <optgroup label="More available versions">{other.map(v => <option key={v.id} value={v.id}>{v.abbreviation}{fullNames ? ` — ${v.title}` : ""}</option>)}</optgroup>}
  </>;
}
