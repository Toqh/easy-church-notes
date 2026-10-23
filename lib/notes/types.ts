export type NoteKind = "sermon" | "study" | "personal";
export interface Note {
  id: string;
  topic: string;
  preacher: string;
  tags: string[];
  kind: NoteKind;
  content: Record<string, unknown>;
  plain_text: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface BibleVersion { id: number; abbreviation: string; title: string; copyright?: string; info?: string; youversion_deep_link?: string; provider?: "youversion" | "bible-api" | "api.bible" }
export interface Passage { id: string; reference: string; content: string; version: BibleVersion; fumsToken?: string }
export const emptyContent = () => ({ type: "doc", content: [{ type: "paragraph" }] });
export function makeNote(kind: NoteKind = "sermon"): Note {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), topic: "", preacher: "", tags: [], kind, content: emptyContent(), plain_text: "", pinned: false, deleted_at: null, created_at: now, updated_at: now };
}
