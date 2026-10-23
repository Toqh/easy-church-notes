import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicBibleClient } from "../lib/notes/bible-api.ts";
import { createBibleService } from "../lib/notes/bible-service.ts";
import { passageContent } from "../lib/notes/passage-content.ts";

const definitions = { "en-kjv": "KJV", "en-asv": "ASV", "en-web": "WEB" };
const chapter = { data: [
  { book: "John", chapter: "3", verse: "16", text: "For God so loved the world." },
  { book: "John", chapter: "3", verse: "17", text: "For God sent not his Son into the world to condemn the world." },
  { book: "John", chapter: "3", verse: "16", text: "For God so loved the world." },
] };
function publicResponse(url: URL) {
  const slug = Object.keys(definitions).find(id => url.pathname.includes(`/${id}/`))!;
  return Response.json(url.pathname.includes("/chapters/") ? chapter : { id: slug, localVersionAbbreviation: definitions[slug as keyof typeof definitions], copyright: "PUBLIC DOMAIN" });
}
test("public Bible fallback validates metadata and resolves ranges without duplicate chapter verses", async () => {
  const urls: URL[] = [];
  const bible = createPublicBibleClient(async (input, init) => {
    const url = new URL(String(input)); urls.push(url);
    assert.equal(new Headers(init?.headers).get("X-YVP-App-Key"), null);
    return publicResponse(url);
  });
  const result = await bible.passage(-1, "JHN.3.16-17");
  assert.equal(result.reference, "John 3:16–17");
  assert.equal(result.content.split("\n").length, 2);
  assert.equal(result.version.provider, "bible-api");
  assert.equal(result.version.copyright, undefined);
  assert.match(urls[1].pathname, /en-kjv\/books\/john\/chapters\/3\.json$/);
  assert.doesNotMatch(JSON.stringify(passageContent([result])), /YouVersion|bible-api|jsdelivr/);
  await assert.rejects(() => bible.passage(-1, "JHN.3.16-18"), /verse numbers/);
  const count = urls.length;
  await assert.rejects(() => bible.passage(-1, "..\/secrets"));
  await assert.rejects(() => bible.passage(-99, "JHN.3.16"));
  assert.equal(urls.length, count);
});
test("fallback catalogue works without a YouVersion key and never invents unavailable popular versions", async () => {
  const bible = createBibleService("", async input => {
    const url = new URL(String(input)); assert.equal(url.hostname, "cdn.jsdelivr.net");
    return publicResponse(url);
  });
  const result = await bible.catalogue();
  assert.deepEqual(result.versions.map(v => v.abbreviation), ["KJV", "ASV", "WEB"]);
  assert.equal(result.popular.find(v => v.abbreviation === "KJV")?.status, "available");
  assert.notEqual(result.popular.find(v => v.abbreviation === "NIV")?.status, "available");
  await assert.rejects(() => bible.search(-1, "loved the world"), /Phrase search is unavailable/);
});
test("licensed translations are preferred, missing public translations are added, and an inaccessible KJV passage falls back", async () => {
  const bible = createBibleService("test-secret", async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "cdn.jsdelivr.net") { assert.equal(new Headers(init?.headers).has("X-YVP-App-Key"), false); return publicResponse(url); }
    if (url.pathname.includes("/passages/")) return new Response(null, { status: 403 });
    if (/\/bibles\/\d+$/.test(url.pathname)) return Response.json({id: 1, abbreviation: "KJV", title: "King James Version"});
    return Response.json({data: [{id: 1, abbreviation: "KJV", title: "King James Version"}, {id: 111, abbreviation: "NIV", title: "New International Version"}]});
  });
  const result = await bible.catalogue();
  assert.equal(result.versions.filter(v => v.abbreviation === "KJV").length, 1);
  assert.equal(result.versions.find(v => v.abbreviation === "KJV")?.id, 1);
  assert.equal(result.versions.find(v => v.abbreviation === "NIV")?.id, 111);
  assert.equal(result.versions.find(v => v.abbreviation === "WEB")?.id, -3);
  const passage = await bible.passage(1, "JHN.3.16");
  assert.equal(passage.version.abbreviation, "KJV");
  assert.equal(passage.version.id, 1);
  assert.equal(passage.version.provider, "bible-api");
});
test("a failed fallback never enables a translation and cannot substitute KJV text for NIV", async () => {
  const bible = createBibleService("test-key", async input => {
    const url = new URL(String(input));
    if (url.hostname === "cdn.jsdelivr.net") return new Response(null, {status: 503});
    if (url.pathname.includes("/passages/")) return new Response(null, {status: 403});
    if (/\/bibles\/\d+$/.test(url.pathname)) return Response.json({id:111,abbreviation:"NIV",title:"New International Version"});
    return Response.json({data:[{id:111,abbreviation:"NIV",title:"New International Version"}]});
  });
  assert.equal((await bible.catalogue()).versions.length, 1);
  await assert.rejects(() => bible.passage(111, "JHN.3.16"), /not enabled/);
});
