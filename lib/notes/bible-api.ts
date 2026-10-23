import { z } from "zod";
import { books, validPassageId } from "./bible-reference.ts";
import { BibleError } from "./youversion.ts";
import type { BibleVersion, Passage } from "./types.ts";

// Negative IDs are internal to EasyChurchNotes; they are never sent to YouVersion.
const definitions = [
  { id: -1, slug: "en-kjv", abbreviation: "KJV", title: "King James Version" },
  { id: -2, slug: "en-asv", abbreviation: "ASV", title: "American Standard Version" },
  { id: -3, slug: "en-web", abbreviation: "WEB", title: "World English Bible" },
];
const base = "https://cdn.jsdelivr.net/gh/wldeh/bible-api@main/bibles";
const metadata = z.object({ id: z.string(), localVersionAbbreviation: z.string(), copyright: z.string().optional() });
const chapterSchema = z.object({ data: z.array(z.object({ book: z.string(), chapter: z.coerce.number().int().positive(), verse: z.coerce.number().int().positive(), text: z.string() })) });

export function createPublicBibleClient(fetcher: typeof fetch = fetch) {
  const metadataCache = new Map<string, Promise<z.infer<typeof metadata>>>();
  async function request(path: string) {
    const response = await fetcher(`${base}/${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new BibleError(response.status === 404 ? "This passage is unavailable in the selected version. Check the reference." : "Bible lookup is temporarily unavailable. Please try again.", response.status === 404 ? 404 : 502);
    return response.json();
  }
  function getMetadata(slug: string) {
    let result = metadataCache.get(slug);
    if (!result) {
      result = request(`${slug}/${slug}.json`).then(value => metadata.parse(value));
      metadataCache.set(slug, result);
      void result.catch(() => metadataCache.delete(slug));
    }
    return result;
  }
  async function version(id: number): Promise<BibleVersion> {
    const definition = definitions.find(v => v.id === id);
    if (!definition) throw new BibleError("This Bible version is unavailable.", 400);
    const info = await getMetadata(definition.slug);
    if (info.id !== definition.slug || info.localVersionAbbreviation.toUpperCase() !== definition.abbreviation) throw new BibleError("The Bible version metadata did not match the selected translation.");
    return { id: definition.id, abbreviation: definition.abbreviation, title: definition.title, provider: "bible-api", ...(info.copyright && !/^public domain$/i.test(info.copyright.trim()) ? { copyright: info.copyright } : {}) };
  }
  async function versions() {
    const results = await Promise.allSettled(definitions.map(v => version(v.id)));
    return results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  }
  async function passage(versionId: number, id: string): Promise<Passage> {
    if (!validPassageId(id)) throw new BibleError("Please enter a valid Bible reference.", 400);
    const definition = definitions.find(v => v.id === versionId);
    if (!definition) throw new BibleError("This Bible version is unavailable.", 400);
    const [code, chapter, verses] = id.split(".");
    const book = books.find(b => b[0] === code)!;
    const slug = book[2][0].toLowerCase().replaceAll(" ", "");
    const [info, raw] = await Promise.all([version(versionId), request(`${definition.slug}/books/${slug}/chapters/${chapter}.json`)]);
    const parsed = chapterSchema.safeParse(raw);
    if (!parsed.success) throw new BibleError("The Bible service returned an unexpected passage. Please try again.");
    const [start, finish] = (verses ?? "").split("-").map(Number);
    // The repository contains duplicate chapter rows in some files. Insert each verse once.
    const unique = new Map(parsed.data.data.filter(row => row.chapter === Number(chapter)).map(row => [row.verse, row.text]));
    const selected = [...unique].filter(([number]) => !verses || (number >= start && number <= (finish || start))).sort((a, b) => a[0] - b[0]);
    if (!selected.length || (verses && selected.length !== (finish || start) - start + 1)) throw new BibleError("This passage is unavailable in the selected version. Check the verse numbers.", 404);
    return { id, reference: `${book[2][0]} ${chapter}${verses ? `:${verses.replace("-", "–")}` : ""}`, content: selected.map(([, text]) => text).join("\n"), version: info };
  }
  return { versions, passage, idFor: (abbreviation: string) => definitions.find(v => v.abbreviation === abbreviation.toUpperCase())?.id };
}
