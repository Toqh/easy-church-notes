"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X, Plus, LoaderCircle, Check, ArrowRight, ChevronDown } from "lucide-react";
import { detectReference } from "@/lib/notes/bible-reference";
import type { BibleVersion, Passage } from "@/lib/notes/types";
import type { PopularVersion } from "@/lib/notes/popular-versions";
import { Attribution, bibleRequest, type SearchResponse } from "./bible-panel";
import VersionOptions from "./version-options";

interface Draft { key: string; input: string; passage?: Passage; status: "idle" | "loading" | "ready" | "error"; error?: string }
interface Props {
  initialQuery: string; versions: BibleVersion[]; popular?: PopularVersion[]; version: number;
  configured: boolean; onVersion: (id: number) => void; onInsert: (passages: Passage[]) => void; onClose: () => void;
}

export default function PassageDialog({ initialQuery, versions, popular, version, configured, onVersion, onInsert, onClose }: Props) {
  const initialReference = detectReference(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [drafts, setDrafts] = useState<Draft[]>(() => initialReference ? [{ key: "initial", input: initialReference.label, status: "loading" }] : []);
  const [composing, setComposing] = useState(!initialReference);
  const [results, setResults] = useState<Passage[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [correction, setCorrection] = useState("");
  const [nextPage, setNextPage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const searchController = useRef<AbortController | null>(null);
  const draftControllers = useRef(new Map<string, AbortController>());
  const draftsRef = useRef(drafts); draftsRef.current = drafts;
  const lastQuery = useRef("");
  const alive = useRef(true);

  function dismiss() { dialog.current?.close(); onClose(); }
  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts(previous => previous.map(draft => draft.key === key ? { ...draft, ...patch } : draft));
  }
  async function loadDraft(key: string, text: string, selectedVersion = version) {
    draftControllers.current.get(key)?.abort();
    const controller = new AbortController(); draftControllers.current.set(key, controller);
    const reference = detectReference(text.trim());
    if (!reference) { patchDraft(key, { passage: undefined, status: "error", error: "Enter a reference such as John 3:16 or Romans 8:28–30." }); return; }
    if (!selectedVersion) { patchDraft(key, { passage: undefined, status: "error", error: "Choose an available Bible version before loading this passage." }); return; }
    patchDraft(key, { passage: undefined, status: "loading", error: undefined });
    try {
      const passage = await bibleRequest<Passage>({ action: "passage", version: String(selectedVersion), reference: reference.id }, controller.signal);
      if (alive.current && !controller.signal.aborted) patchDraft(key, { input: passage.reference, passage, status: "ready" });
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) patchDraft(key, { status: "error", error: failure instanceof Error ? failure.message : "Could not load this passage." });
    }
  }
  async function addReference(text: string, selectedVersion = version) {
    const reference = detectReference(text);
    if (!reference) return;
    const duplicate = draftsRef.current.find(d => d.passage?.id === reference.id && d.passage.version.id === selectedVersion);
    if (duplicate) { setMessage("That passage is already in your selection."); return; }
    const key = crypto.randomUUID();
    setDrafts(previous => [...previous, { key, input: reference.label, status: "loading" }]);
    await loadDraft(key, text, selectedVersion);
  }
  async function runSearch(text = query, page = "", selectedVersion = version) {
    const value = (page ? lastQuery.current : text).trim();
    if (!value) { setError("Enter a Bible reference or some words to search for."); return; }
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller;
    setError(""); setMessage(""); setBusy(false);
    if (!selectedVersion) { setError("Choose an available Bible version before searching."); return; }
    if (detectReference(value) && !page) {
      setResults([]); setNextPage(null); setCorrection(""); setSearched(false);
      setComposing(false);
      await addReference(value, selectedVersion); return;
    }
    setBusy(true); setSearched(true);
    if (!page) { setResults([]); setNextPage(null); setCorrection(""); lastQuery.current = value; }
    try {
      const data = await bibleRequest<SearchResponse>({ action: "search", version: String(selectedVersion), query: value, page }, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setResults(previous => page ? [...previous, ...data.passages] : data.passages);
      setNextPage(data.nextPageToken); setCorrection(data.correction ?? "");
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Bible search could not complete.");
    } finally { if (alive.current && !controller.signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    element?.showModal();
    if (initialReference) void loadDraft("initial", initialReference.label, version);
    else if (initialQuery.trim()) void runSearch(initialQuery, "", version);
    return () => {
      alive.current = false; searchController.current?.abort();
      for (const controller of draftControllers.current.values()) controller.abort();
      draftControllers.current.clear(); element?.close();
    };
    // A new dialog key starts a new lookup; editing/version changes are handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (composing) queryInput.current?.focus(); }, [composing]);

  function changeVersion(id: number) {
    searchController.current?.abort(); setBusy(false); setResults([]); setSearched(false); setNextPage(null); setError(""); setCorrection("");
    onVersion(id);
    for (const draft of draftsRef.current) void loadDraft(draft.key, draft.input, id);
  }
  function addResult(passage: Passage) {
    if (draftsRef.current.some(d => d.passage?.id === passage.id && d.passage.version.id === passage.version.id)) return;
    setDrafts(previous => [...previous, { key: crypto.randomUUID(), input: passage.reference, passage, status: "ready" }]);
    setComposing(false); setResults([]); setSearched(false);
    setMessage(`${passage.reference} added to your selection.`);
  }
  const ready = drafts.length > 0 && drafts.every(d => d.status === "ready" && d.passage);
  function insert() {
    if (!ready) return;
    dialog.current?.close();
    onInsert(drafts.map(d => d.passage!));
  }
  return <dialog ref={dialog} className="passage-dialog" aria-label="Bible passages"
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onPointerDown={event => { if (event.target === dialog.current) { const box = dialog.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss(); } }}>
    <header className="passage-dialog-header"><label className="passage-version-label"><span className="sr-only">Bible version</span><select aria-label="Passage Bible version" value={version || ""} onChange={event => changeVersion(Number(event.target.value))}><VersionOptions versions={versions} popular={popular} placeholder="Choose version"/></select><ChevronDown size={13}/></label><button type="button" className="icon-button" aria-label="Close Bible passages" title="Cancel" onClick={dismiss}><X size={19}/></button></header>
    <div className="passage-dialog-body">
      <section className="passage-selection" aria-label="Passages to insert">
        {drafts.map((draft, index) => <article className="passage-draft" key={draft.key}>
          <form className="passage-reference-form" onSubmit={event => { event.preventDefault(); void loadDraft(draft.key, draft.input); }}>
            <label><span className="sr-only">Reference {index + 1}</span><input aria-label={`Reference ${index + 1}`} autoFocus={index === 0 && !composing} title="Edit this reference and press Enter" value={draft.input} onChange={event => { draftControllers.current.get(draft.key)?.abort(); patchDraft(draft.key, { input: event.target.value, passage: undefined, status: "idle", error: undefined }); }}/></label>
            {(draft.status === "idle" || draft.status === "error") && <button className="passage-update" type="submit" aria-label={`Update reference ${index + 1}`}><span>Update</span><ArrowRight size={15}/></button>}
            {drafts.length > 1 && <button type="button" className="icon-button" aria-label={`Remove reference ${index + 1}`} onClick={() => { draftControllers.current.get(draft.key)?.abort(); setDrafts(previous => previous.filter(d => d.key !== draft.key)); }}><X size={17}/></button>}
          </form>
          {draft.status === "loading" && <p className="search-loading" role="status"><LoaderCircle size={16} className="spin"/>Loading passage…</p>}
          {draft.status === "idle" && <p className="passage-edit-hint">Press Enter to preview this reference.</p>}
          {draft.error && <p className="error-message" role="alert">{draft.error}</p>}
          {draft.passage && <><div className="passage-preview-label sr-only" aria-live="polite">{draft.passage.reference} · {draft.passage.version.abbreviation}</div><p className="verse-preview-text">{draft.passage.content}</p><Attribution version={draft.passage.version} fumsToken={draft.passage.fumsToken}/></>}
        </article>)}
      </section>
      {composing ? <div className="passage-composer">
      <form className="passage-search-form" onSubmit={event => { event.preventDefault(); void runSearch(); }}>
        <label className="sr-only" htmlFor="passage-query">Bible reference or text</label>
        <div className="passage-query-row"><div className="passage-query-field"><Search size={17}/><input id="passage-query" ref={queryInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Reference or words you remember" maxLength={100}/></div><button className="passage-search-submit" type="submit" aria-label="Search passages" disabled={busy || !version}>{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={18}/>}</button>{drafts.length > 0 && <button type="button" className="icon-button" aria-label="Close additional search" onClick={() => { searchController.current?.abort(); setBusy(false); setComposing(false); }}><X size={17}/></button>}</div>
      </form>
      {error && <p className="error-message" role="alert">{error}</p>}
      {correction && <p className="notice">{correction}</p>}
      {busy && <p className="search-loading" role="status"><LoaderCircle size={17} className="spin"/>Searching Scripture…</p>}
      {searched && <section className="passage-search-results" aria-label="Bible search results">{!busy && !error && !results.length && <p className="muted">No matches found. Try a shorter phrase or another version.</p>}{results.map((passage, index) => {
        const selected = drafts.some(d => d.passage?.id === passage.id && d.passage.version.id === passage.version.id);
        return <article className="verse-result" key={`${passage.id}-${index}`}><div className="verse-reference">{passage.reference}<span>{passage.version.abbreviation}</span></div><p>{passage.content}</p><button type="button" className="insert-button" disabled={selected} onClick={() => addResult(passage)}>{selected ? <Check size={15}/> : <Plus size={15}/>} {selected ? "Selected" : "Add to selection"}</button><Attribution version={passage.version} fumsToken={passage.fumsToken}/></article>;
      })}{nextPage && <button type="button" className="secondary-button load-more" disabled={busy} onClick={() => void runSearch(lastQuery.current, nextPage)}>More results</button>}</section>}
      </div> : <button type="button" className="passage-add" onClick={() => { setComposing(true); setQuery(""); setResults([]); setSearched(false); setError(""); setMessage(""); }}><Plus size={15}/>Add another passage</button>}
      {!configured && <p className="notice">Bible lookup is unavailable. You can keep writing your note.</p>}
      <div className="sr-only" role="status">{message}</div>
    </div>
    <footer className="passage-dialog-footer"><button type="button" className="passage-cancel" onClick={dismiss}>Cancel</button><button type="button" className="primary-button" disabled={!ready} onClick={insert}>Insert into note{drafts.length > 1 && <span className="passage-insert-count">{drafts.length}</span>}</button></footer>
  </dialog>;
}
