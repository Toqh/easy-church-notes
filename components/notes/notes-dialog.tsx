"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Download, FileText, Plus, Search, Tag, X } from "lucide-react";
import type { Note, NoteKind } from "@/lib/notes/types";
import styles from "./notes-dialog.module.css";

export type NotesFolder = "all" | "pinned" | "trash" | NoteKind;
const collections: {key: NotesFolder; label: string}[] = [
  {key:"all",label:"All notes"},{key:"pinned",label:"Pinned notes"},{key:"sermon",label:"Sermon notes"},
  {key:"study",label:"Bible study"},{key:"personal",label:"Personal reflections"},{key:"trash",label:"Recently deleted"},
];
const normalize=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();
interface Props {
  notes:Note[]; currentId:string|null; initialFolder:NotesFolder; initialTag?:string;
  ready:boolean; error:string; onClose:()=>void; onSelect:(id:string)=>void;
  onNew:(kind?:NoteKind)=>void; onExport:()=>void;
}
export default function NotesDialog({notes,currentId,initialFolder,initialTag,ready,error,onClose,onSelect,onNew,onExport}:Props) {
  const dialog=useRef<HTMLDialogElement>(null), results=useRef<HTMLDivElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState("");
  const [folder,setFolder]=useState<NotesFolder>(initialFolder);
  const [tag,setTag]=useState(initialTag??"");
  const [sort,setSort]=useState("updated");
  const matches=useMemo(()=>{
    const terms=normalize(query).trim().split(/\s+/).map(term=>term.replace(/^#/,"")).filter(Boolean);
    return notes.filter(note=>{
      if(folder==="trash"?!note.deleted_at:!!note.deleted_at)return false;
      if(folder==="pinned"&&!note.pinned)return false;
      if(["sermon","study","personal"].includes(folder)&&note.kind!==folder)return false;
      if(tag&&!note.tags.includes(tag))return false;
      const text=normalize(`${note.topic} ${note.preacher} ${note.tags.join(" ")} ${note.plain_text}`);
      return terms.every(term=>text.includes(term));
    }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(sort==="title"?a.topic.localeCompare(b.topic):Date.parse(b.updated_at)-Date.parse(a.updated_at)));
  },[notes,query,folder,tag,sort]);
  useEffect(()=>{const element=dialog.current;element?.showModal();searchInput.current?.focus({preventScroll:true});return ()=>element?.close();},[]);
  function close(){dialog.current?.close();onClose();}
  function select(id:string){dialog.current?.close();onSelect(id);}
  const title=collections.find(item=>item.key===folder)!.label;
  return <dialog ref={dialog} className={styles.dialog} aria-label="Your notebook" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{
    if(event.target!==dialog.current)return;
    const bounds=dialog.current.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();
  }}>
    <header className={styles.header}><div><BookOpen size={19} aria-hidden="true"/><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Close notebook" onClick={close}><X size={20}/></button></header>
    <form className={styles.search} role="search" aria-label="Search notebook" onSubmit={event=>{event.preventDefault();if(ready&&matches.length)select(matches[0].id);}}>
      <Search size={19} aria-hidden="true"/><input ref={searchInput} aria-label="Search your notes" placeholder="Search titles, tags, preachers or words…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();results.current?.querySelector("button")?.focus();}}}/>
      {query&&<button type="button" className="icon-button" aria-label="Clear note search" onClick={()=>setQuery("")}><X size={16}/></button>}
    </form>
    <div className={styles.filters}>
      <label><span className="sr-only">Note collection filter</span><select aria-label="Note collection filter" value={folder} onChange={event=>{setFolder(event.target.value as NotesFolder);setTag("");}}>{collections.map(item=><option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
      <label><span className="sr-only">Sort notes</span><select aria-label="Sort notes" value={sort} onChange={event=>setSort(event.target.value)}><option value="updated">Recent first</option><option value="title">By title</option></select></label>
    </div>
    {tag&&<div className={styles.tagFilter}><Tag size={14}/><span>{tag}</span><button type="button" className="icon-button" aria-label="Clear tag filter" onClick={()=>setTag("")}><X size={14}/></button></div>}
    <div className={styles.results} ref={results} role="region" aria-label="Notes list">
      {!ready?<p className={styles.empty}>{error||"Opening your notebook…"}</p>:matches.length?matches.map(note=><button type="button" className={`${styles.note} ${note.id===currentId?styles.selected:""}`} key={note.id} onClick={()=>select(note.id)} aria-current={note.id===currentId?"page":undefined}>
        <FileText size={19} className={styles.noteIcon} aria-hidden="true"/><span className={styles.noteContent}><span className={styles.noteTitle}>{note.topic||"Untitled note"}</span><span className={styles.preview}>{note.plain_text||"A fresh page, a new thought."}</span><span className={styles.meta}>{note.preacher&&note.kind!=="personal"&&<span>{note.preacher}</span>}{note.tags.slice(0,3).map(value=><span className={styles.noteTag} key={value}>#{value}</span>)}<time dateTime={note.updated_at}>{new Date(note.updated_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></span></span>{note.id===currentId?<Check size={17} aria-label="Current note"/>:<ArrowRight size={17} aria-hidden="true"/>}
      </button>):<div className={styles.empty}><Search size={24} aria-hidden="true"/><h3>{query||tag?"No matching notes":"No notes here yet"}</h3><p>{query||tag?"Try a different word, preacher or tag.":folder==="trash"?"Deleted notes will appear here.":"Your next thought belongs here."}</p></div>}
    </div>
    <footer className={styles.footer}><span role="status">{ready?`${matches.length} ${matches.length===1?"note":"notes"}`:"Loading…"}</span><button type="button" className="icon-button" aria-label="Export all notes" title="Export all notes" onClick={onExport}><Download size={17}/></button><button type="button" className="primary-button" disabled={!ready} onClick={()=>{dialog.current?.close();onNew(["sermon","study","personal"].includes(folder)?folder as NoteKind:undefined);}}><Plus size={16}/>New note</button></footer>
  </dialog>;
}
