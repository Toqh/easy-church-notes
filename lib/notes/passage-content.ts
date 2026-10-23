import type { JSONContent } from "@tiptap/react";
import type { Passage } from "./types.ts";

export function passageContent(passages: Passage[]): JSONContent[] {
  return passages.flatMap(passage => [{
    type: "blockquote",
    ...(passage.fumsToken ? {attrs:{apiBibleToken:passage.fumsToken}} : {}),
    content: [
      ...passage.content.split(/\n+/).filter(Boolean).map(text => ({ type: "paragraph", content: [{ type: "text", text }] })),
      { type: "paragraph", content: [{ type: "text", text: `${passage.reference} · ${passage.version.abbreviation}`, marks: [{ type: "bold" }] }] },
      ...(passage.version.copyright ? [{ type: "paragraph", content: [{ type: "text", text: passage.version.copyright }] }] : []),
      ...(passage.version.provider === "api.bible" && passage.version.info ? [{type:"paragraph",content:[{type:"text",text:passage.version.info}]}] : []),
      ...(passage.version.provider === "bible-api" ? [] : [{ type: "paragraph", content: [{ type: "text", text: passage.version.provider === "api.bible" ? "API.Bible" : `YouVersion · ${passage.version.title}`, marks: [{ type: "link", attrs: { href: passage.version.provider === "api.bible" ? "https://api.bible" : passage.version.youversion_deep_link || `https://www.bible.com/versions/${passage.version.id}`, target: "_blank", rel: "noopener noreferrer" } }] }] }]),
    ],
  }, { type: "paragraph" }]);
}
export function contentText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown };
  if (typeof node.text === "string") return node.text;
  return Array.isArray(node.content) ? node.content.map(contentText).join("\n") : "";
}
