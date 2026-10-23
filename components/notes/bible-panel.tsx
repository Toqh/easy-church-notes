"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X, BookOpen, ArrowDownLeft, LoaderCircle, ArrowRight, ChevronDown } from "lucide-react";
import type { BibleVersion, Passage } from "@/lib/notes/types";
import { detectReference } from "@/lib/notes/bible-reference";
import { trackScriptureViews } from "@/lib/notes/scripture-views";

export interface SearchResponse { passages:Passage[]; nextPageToken:string|null; correction?:string|null }
export async function bibleRequest<T>(params:Record<string,string>,signal?:AbortSignal):Promise<T> {
  const response=await fetch(`/api/bible?${new URLSearchParams(params)}`,{signal});
  const data=await response.json() as T & {error?:string};
  if(!response.ok)throw new Error(data.error??"Bible lookup could not complete.");return data;
}
export function Attribution({version,fumsToken}:{version:BibleVersion;fumsToken?:string}) {
  useEffect(()=>{if(fumsToken)trackScriptureViews([fumsToken]);},[fumsToken]);
  if(version.provider==="bible-api")return version.copyright?<div className="attribution"><p>{version.copyright}</p></div>:null;
  if(version.provider==="api.bible")return <div className="attribution">{version.copyright&&<p>{version.copyright}</p>}{version.info&&<details><summary>Translation details</summary><p>{version.info}</p></details>}<a href="https://api.bible" target="_blank" rel="noopener noreferrer">API.Bible <ArrowRight size={11}/></a></div>;
  return <div className="attribution">{version.copyright&&<p>{version.copyright}</p>}<a href={version.youversion_deep_link||`https://www.bible.com/versions/${version.id}`} target="_blank" rel="noopener noreferrer">{version.title} · YouVersion <ArrowRight size={11}/></a></div>;
}
export default function BiblePanel({versions,version,onVersion,onInsert,onClose,configured}:{versions:BibleVersion[];version:number;onVersion:(id:number)=>void;onInsert:(p:Passage)=>void;onClose:()=>void;configured:boolean}) {
  const [query,setQuery]=useState("");const [passages,setPassages]=useState<Passage[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [searched,setSearched]=useState(false);const [nextPage,setNextPage]=useState<string|null>(null);const [correction,setCorrection]=useState("");
  const controller=useRef<AbortController|null>(null);const lastQuery=useRef("");
  const selected=versions.find(v=>v.id===version);
  useEffect(()=>{controller.current?.abort();setPassages([]);setSearched(false);setNextPage(null);setError("");setBusy(false);},[version]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function run(page="",override?:string) {
    const text=page?lastQuery.current:(override??query).trim();if(!text)return;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setBusy(true);setError("");if(!page){setPassages([]);setNextPage(null);setCorrection("");setSearched(true);lastQuery.current=text;}
    try {
      const ref=detectReference(text);
      const result:SearchResponse=ref&&!page?{passages:[await bibleRequest<Passage>({action:"passage",version:String(version),reference:ref.id},abort.signal)],nextPageToken:null}:await bibleRequest<SearchResponse>({action:"search",version:String(version),query:text,page},abort.signal);
      if(abort.signal.aborted)return;
      setPassages(old=>page?[...old,...result.passages]:result.passages);setNextPage(result.nextPageToken);setCorrection(result.correction??"");
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Search could not complete.");}finally{if(!abort.signal.aborted)setBusy(false);}
  }
  return <aside className="bible-panel" aria-label="Bible search"><div className="bible-heading"><div className="bible-heading-title"><BookOpen size={18}/><h2>Find it in the Word</h2></div><button className="icon-button" aria-label="Close Bible search" onClick={onClose}><X size={18}/></button></div><p className="bible-subtitle">A verse, a phrase, a little direction.</p><form className="bible-search" onSubmit={e=>{e.preventDefault();void run();}}><Search size={16}/><input aria-label="Bible search phrase or reference" value={query} onChange={e=>setQuery(e.target.value)} placeholder="A phrase or John 3:16" maxLength={100}/><button type="submit" className="icon-button" aria-label="Search Bible" disabled={busy||!version}>{busy?<LoaderCircle size={16} className="spin"/>:<ArrowRight size={17}/>}</button></form><label className="bible-version">Searching in <span className="select-wrap"><select aria-label="Bible search version" value={version||""} onChange={e=>onVersion(Number(e.target.value))}>{!versions.length&&<option value="">KJV · connect to load</option>}{versions.map(v=><option key={v.id} value={v.id}>{v.abbreviation} — {v.title}</option>)}</select><ChevronDown size={12}/></span></label><div className="bible-results" aria-live="polite">{!configured&&<div className="notice">Bible lookup will be available once YouVersion is connected.</div>}{error&&<p className="error-message" role="alert">{error}</p>}{correction&&<p className="notice">{correction}</p>}{!searched?<div className="bible-empty"><div className="bible-empty-icon"><BookOpen size={29} strokeWidth={1.3}/></div><h3>The words you’re looking for.</h3><p>Search Scripture and bring a verse straight into your notes.</p><span className="eyebrow">TRY A SEARCH</span>{["Be still","Walk by faith","Psalm 23:1"].map(s=><button key={s} className="suggestion" onClick={()=>{setQuery(s);void run("",s);}} disabled={!version}><Search size={13}/>{s}<ArrowRight size={13}/></button>)}</div>:<>{!busy&&!error&&!passages.length&&<div className="bible-empty"><BookOpen size={26}/><h3>No verses found.</h3><p>Try a shorter phrase or a different translation.</p></div>}{passages.map((p,i)=><article className="verse-result" key={`${p.id}-${i}`}><div className="verse-reference">{p.reference}<span>{p.version.abbreviation}</span></div><p>{p.content}</p><button className="insert-button" onClick={()=>onInsert(p)}><ArrowDownLeft size={14}/>Add to note</button><Attribution version={p.version}/></article>)}{nextPage&&<button className="secondary-button load-more" onClick={()=>void run(nextPage)} disabled={busy}>{busy?"Loading…":"More verses"}</button>}{busy&&<p className="search-loading"><LoaderCircle className="spin" size={15}/>Searching Scripture…</p>}</>}</div><div className="bible-bottom"><BookOpen size={13}/>Scripture provided by YouVersion{selected&&<span>{selected.abbreviation}</span>}</div></aside>;
}
