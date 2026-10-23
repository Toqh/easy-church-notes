"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Cloud, Cross, Download, Feather, FolderOpen, Headphones, Heart, LayoutGrid, LoaderCircle, Maximize2, Menu, Minimize2, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pin, Plus, Search, Sparkles, Sun, Tag, Trash2, UserRound, X } from "lucide-react";
import { useNotes } from "@/hooks/use-notes";
import type { BibleVersion, Note, NoteKind, Passage } from "@/lib/notes/types";
import type { BibleReference } from "@/lib/notes/bible-reference";
import NoteEditor from "./editor";
import NotesDialog, {type NotesFolder} from "./notes-dialog";
import editorStyles from "./editor-surface.module.css";
import AuthDialog from "./auth-dialog";
import InstallDialog from "./install-dialog";
import { usePwa } from "@/hooks/use-pwa";
import { bibleRequest } from "./bible-panel";
import PassageDialog from "./passage-dialog";
import VersionOptions from "./version-options";
import type { PopularVersion } from "@/lib/notes/popular-versions";
import { passageContent, contentText } from "@/lib/notes/passage-content";


const kinds:{key:NoteKind;label:string;icon:typeof BookOpen}[]=[{key:"sermon",label:"Sermon notes",icon:Headphones},{key:"study",label:"Bible study",icon:BookOpen},{key:"personal",label:"Personal reflections",icon:Heart}];
const date=(s:string,options:Intl.DateTimeFormatOptions={month:"short",day:"numeric"})=>new Date(s).toLocaleDateString(undefined,options);
function download(name:string,text:string,type="application/json") {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function NotesApp({initialAuth=null,startWriting=false}:{initialAuth?:"login"|null;startWriting?:boolean}) {
  const store=useNotes();
  const pwa=usePwa();
  const [installDialog,setInstallDialog]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [library,setLibrary]=useState<{folder:NotesFolder;tag?:string}|null>(null);
  const [auth,setAuth]=useState<"login"|"signup"|null>(initialAuth);const [help,setHelp]=useState(false);const [menu,setMenu]=useState(false);const [sidebar,setSidebar]=useState(false);
  const [signupDismissed,setSignupDismissed]=useState(false);
  const [theme,setTheme]=useState("light");const [tagInput,setTagInput]=useState("");const [toast,setToast]=useState("");
  const [focusMode,setFocusMode]=useState(false);
  const [versions,setVersions]=useState<BibleVersion[]>([]);const [version,setVersion]=useState(0);const [catalogError,setCatalogError]=useState("");
  const [bibleDialog,setBibleDialog]=useState<{key:number;query:string}|null>(null);
  const [quickBibleQuery,setQuickBibleQuery]=useState("");
  const [popular,setPopular]=useState<PopularVersion[]|undefined>();
  const [navCollapsed,setNavCollapsed]=useState(false);
  const [detailsExpanded,setDetailsExpanded]=useState(false);
  const insertTarget=useRef<{noteId:string|null;instance:Editor|null;from:number;to:number}|null>(null);
  const editorNoteId=useRef<string|null>(null);
  const pendingFocus=useRef<string|null>(null);
  const editor=useRef<Editor|null>(null);const activeNoteRef=useRef<string|null>(null);
  const active=store.notes.filter(n=>!n.deleted_at);
  const tags=Array.from(new Set(active.flatMap(n=>n.tags))).sort();
  const note=store.notes.find(n=>n.id===selected)??active.slice().sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0]??null;
  const folder=library?.folder??"all",tag=library?.tag??null;
  activeNoteRef.current=note?.id??null;
  const noteRef=useRef(note);noteRef.current=note;
  const registerEditor=useCallback((instance:Editor,noteId:string)=>{
    editor.current=instance;editorNoteId.current=noteId;
    if(pendingFocus.current===noteId){pendingFocus.current=null;queueMicrotask(()=>{if(!instance.isDestroyed)instance.commands.focus("end");});}
    return ()=>{if(editor.current===instance){editor.current=null;editorNoteId.current=null;}};
  },[]);
  const openBibleDialog=useCallback((query="")=>{
    const instance=editor.current&&!editor.current.isDestroyed&&editorNoteId.current===activeNoteRef.current?editor.current:null;
    insertTarget.current={noteId:activeNoteRef.current,instance,from:instance?.state.selection.from??0,to:instance?.state.selection.to??0};
    setBibleDialog({key:Date.now(),query});setMenu(false);
  },[]);
  const update=useCallback((patch:Partial<Note>)=>{if(activeNoteRef.current)store.update(activeNoteRef.current,patch);},[store.update]);
  useEffect(()=>{
    const preference=localStorage.getItem("easychurchnotes:theme")||"light";setTheme(preference);
    setSignupDismissed(localStorage.getItem("easychurchnotes:signup-dismissed")==="1");
  },[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("easychurchnotes:theme",theme);},[theme]);
  useEffect(()=>{if(store.recovery)setAuth("login");},[store.recovery]);
  useEffect(()=>{if(startWriting&&store.ready&&editor.current&&!editor.current.isDestroyed)editor.current.commands.focus("end");},[startWriting,store.ready,note?.id]);
  useEffect(()=>{if(toast){const id=setTimeout(()=>setToast(""),4000);return ()=>clearTimeout(id);}},[toast]);
  useEffect(()=>{setBibleDialog(null);insertTarget.current=null;setTagInput("");setMenu(false);},[note?.id]);
  useEffect(()=>{
    if(!store.config?.bibleConfigured)return;
    const controller=new AbortController();
    bibleRequest<{versions:BibleVersion[];popular?:PopularVersion[];warnings?:string[]}>({action:"versions"},controller.signal).then(data=>{
      const list: BibleVersion[]=data.versions;setVersions(list);setPopular(data.popular);setCatalogError(data.warnings?.join(" ")??"");
      const stored=Number(localStorage.getItem("easychurchnotes:version"));
      setVersion(list.find(v=>v.id===stored)?.id??list.find(v=>v.abbreviation==="KJV")?.id??list[0]?.id??0);
      if(!list.length)setCatalogError("No English translations could be loaded. Please try again.");
    }).catch(e=>{if(!controller.signal.aborted)setCatalogError(e.message);});return ()=>controller.abort();
  },[store.config?.bibleConfigured]);
  function selectVersion(id:number){setVersion(id);localStorage.setItem("easychurchnotes:version",String(id));}
  const requestReference=useCallback((reference:BibleReference)=>{
    queueMicrotask(()=>openBibleDialog(reference.label));
  },[openBibleDialog]);
  function insertPassages(passages:Passage[]) {
    if(!passages.length)return;
    const destination=insertTarget.current;
    const target=store.notes.find(n=>n.id===destination?.noteId&&!n.deleted_at)??(noteRef.current&&!noteRef.current.deleted_at?noteRef.current:null);
    const instance=editor.current;
    const nodes=passageContent(passages);
    if(target&&instance&&!instance.isDestroyed&&editorNoteId.current===target.id) {
      const maximum=instance.state.doc.content.size;
      const selection=destination?.instance===instance?{from:Math.max(0,Math.min(destination.from,maximum)),to:Math.max(0,Math.min(destination.to,maximum))}:instance.state.selection;
      instance.chain().focus().setTextSelection({from:selection.from,to:selection.to}).insertContent(nodes).run();
    } else if(target) {
      const previous=Array.isArray(target.content.content)?target.content.content:[];
      const content={type:"doc",content:[...previous,...nodes]};
      store.update(target.id,{content,plain_text:contentText(content)});
      requestAnimationFrame(()=>{if(editor.current&&!editor.current.isDestroyed)editor.current.commands.focus("end");});
    } else {
      const id=store.add("study");
      const content={type:"doc",content:nodes};
      store.update(id,{content,plain_text:contentText(content)});
      pendingFocus.current=id;setSelected(id);
    }
    setBibleDialog(null);insertTarget.current=null;
    setToast(passages.length===1?"Passage inserted into your note.":`${passages.length} passages inserted into your note.`);
  }
  function createNote(kind:NoteKind="sermon"){const id=store.add(kind);pendingFocus.current=id;setSelected(id);setLibrary(null);setSidebar(false);}
  function addNote(){createNote();}
  function selectNote(id:string){const changed=activeNoteRef.current!==id;pendingFocus.current=null;setSelected(id);setLibrary(null);setSidebar(false);if(changed)requestAnimationFrame(()=>{const area=document.querySelector<HTMLElement>(".note-scroll");if(area)area.scrollTop=0;});}
  function openNotes(){setLibrary({folder:"all"});setMenu(false);setSidebar(false);}
  function navigate(next:NotesFolder){setLibrary({folder:next});setSidebar(false);setMenu(false);}
  function addTag(){const value=tagInput.trim().replace(/^#/,"");if(value&&note&&!note.tags.includes(value))update({tags:[...note.tags,value.slice(0,40)]});setTagInput("");}
  function toggleFocus(){setFocusMode(value=>!value);setSidebar(false);setMenu(false);}
  function exportAll(){download(`EasyChurchNotes-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({app:"EasyChurchNotes",exportedAt:new Date().toISOString(),notes:store.notes},null,2));}
  const words=note?.plain_text.trim().split(/\s+/).filter(Boolean).length??0;

  return <div className={`${editorStyles.shell} app-shell show-editor ${sidebar?"show-sidebar":""} ${focusMode?"focus-mode":""} ${navCollapsed?"nav-collapsed":""}`}>
    {sidebar&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setSidebar(false)}/>}
    <aside className="sidebar"><a className="brand" href="/" aria-label="EasyChurchNotes home"><span className="brand-mark"><Cross size={22} strokeWidth={1.7}/></span><span>EasyChurch<span className="brand-second">Notes</span></span></a><button className="primary-button new-note" onClick={addNote} disabled={!store.ready}><Plus size={17}/>New note<span>Ctrl Alt N</span></button><nav aria-label="Note collections"><span className="nav-caption">YOUR SPACE</span><button className={`nav-item ${folder==="all"&&!tag?"selected":""}`} title="All notes" onClick={()=>navigate("all")}><LayoutGrid size={17}/>All notes<span>{active.length}</span></button><button className={`nav-item ${folder==="pinned"?"selected":""}`} title="Pinned notes" onClick={()=>navigate("pinned")}><Pin size={17}/>Pinned notes<span>{active.filter(n=>n.pinned).length}</span></button><span className="nav-caption collection-caption">COLLECTIONS</span>{kinds.map(k=><button key={k.key} className={`nav-item ${folder===k.key?"selected":""}`} title={k.label} onClick={()=>navigate(k.key)}><k.icon size={17}/>{k.label}<span>{active.filter(n=>n.kind===k.key).length}</span></button>)}<div className="tags-heading"><span className="nav-caption">TAGS</span><Tag size={13}/></div><div className="sidebar-tags">{tags.length?tags.map((t,i)=><button key={t} onClick={()=>{setLibrary({folder:"all",tag:t});setSidebar(false);}} className={`sidebar-tag ${tag===t?"selected":""}`}><span className={`tag-dot dot-${i%4}`}/>{t}</button>):<p className="no-tags">Add a tag to find it here.</p>}</div><button className={`nav-item trash-nav ${folder==="trash"?"selected":""}`} title="Recently deleted" onClick={()=>navigate("trash")}><Trash2 size={16}/>{"Recently deleted"}<span>{store.notes.filter(n=>n.deleted_at).length||""}</span></button></nav><div className="sidebar-bottom"><div className="quiet-card"><Feather size={19}/><p>A little space for the Word.<br/><span>A little room to grow.</span></p></div><div className="account-row"><button className="account-button" onClick={()=>setAuth("login")}><span className="avatar">{store.user?(store.user.user_metadata.full_name||store.user.email||"Y").slice(0,1).toUpperCase():<UserRound size={17}/>}</span><span><strong>{store.user?store.user.user_metadata.full_name||"Your account":"Your quiet space"}</strong><small>{store.user?"Personal account":"Sign in to sync your notes"}</small></span><ChevronRight size={14}/></button><button className="icon-button theme-toggle" onClick={()=>setTheme(theme==="light"?"dark":"light")} aria-label={`Switch to ${theme==="light"?"dark":"light"} mode`} aria-pressed={theme==="dark"} title="Change appearance">{theme==="light"?<Moon size={16}/>:<Sun size={16}/>}</button></div></div></aside>
    <main className="editor-column"><header className="editor-ribbon"><div className="ribbon-left"><button type="button" className="icon-button editor-navigation-toggle" aria-label="Open navigation" onClick={()=>setSidebar(true)}><Menu size={19}/></button><button type="button" className="icon-button sidebar-collapse-toggle" aria-label={navCollapsed?"Expand sidebar":"Minimize sidebar"} title={navCollapsed?"Expand navigation sidebar":"Minimize navigation sidebar"} aria-pressed={navCollapsed} onClick={()=>setNavCollapsed(value=>!value)}>{navCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button type="button" className="notebook-toggle" aria-label="Open notes" aria-haspopup="dialog" aria-keyshortcuts="Control+k Meta+k" title="Your notebook (Ctrl / ⌘ K)" onClick={openNotes}><FolderOpen size={17}/><span>Notes</span></button><span className="breadcrumb"><BookOpen size={15}/><span className="breadcrumb-collection">{note?kinds.find(k=>k.key===note.kind)?.label:"Your notebook"}</span><ChevronRight size={12}/><span className="breadcrumb-title">{note?.topic||"Untitled note"}</span></span></div><div className="ribbon-actions"><label className="version-picker" title={catalogError||"Bible translation"}><BookOpen size={14}/><select aria-label="Bible version" value={version||""} onChange={e=>selectVersion(Number(e.target.value))}><VersionOptions versions={versions} popular={popular} placeholder={catalogError?"Unavailable":store.config?.bibleConfigured?"Loading…":"No available versions"}/></select><ChevronDown size={12}/></label><button type="button" className="icon-button mobile-bible-search" aria-label="Find Bible passage" title="Search Bible" onClick={()=>openBibleDialog()}><Search size={20}/></button><span className="ribbon-divider"/><form className="ribbon-bible-search" role="search" aria-label="Quick Bible search" onSubmit={event=>{event.preventDefault();openBibleDialog(quickBibleQuery);}}><Search size={15}/><input aria-label="Search Bible reference or text" value={quickBibleQuery} onChange={event=>setQuickBibleQuery(event.target.value)} maxLength={100} placeholder="Bible reference or text"/><button type="submit" className="icon-button" aria-label="Search Bible" title="Search Bible"><ArrowRight size={16}/></button></form>
<button className={`icon-button focus-toggle ${focusMode?"is-active":""}`} aria-label={focusMode?"Exit focus mode":"Enter focus mode"} title={focusMode?"Exit focus mode":"Focus mode: hide sidebars"} aria-pressed={focusMode} onClick={toggleFocus}>{focusMode?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
<button className="icon-button theme-toggle ribbon-theme-toggle" aria-label={theme==="light"?"Enable dark mode":"Enable light mode"} title={theme==="light"?"Dark mode":"Light mode"} aria-pressed={theme==="dark"} onClick={()=>setTheme(theme==="light"?"dark":"light")}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button>
<div className="more-menu-wrap"><button className="icon-button" aria-label="Note actions" aria-expanded={menu} onClick={()=>setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu&&<><button className="menu-scrim" aria-label="Close note actions" onClick={()=>setMenu(false)}/><div className="more-menu">{note&&<><button onClick={()=>{update({pinned:!note.pinned});setMenu(false);}}><Pin size={14}/>{note.pinned?"Unpin note":"Pin note"}</button><button onClick={()=>{download(`${note.topic||"Untitled note"}.txt`,`${note.topic}\n${note.preacher}\n${date(note.created_at,{dateStyle:"full"})}\n${note.tags.map(t=>`#${t}`).join(" ")}\n\n${editor.current?.getText()||note.plain_text}`,"text/plain");setMenu(false);}}><Download size={14}/>Export this note</button><button className="danger" onClick={()=>{update({deleted_at:note.deleted_at?null:new Date().toISOString()});setMenu(false);setToast(note.deleted_at?"Note restored.":"Note moved to Recently deleted.");}}><Trash2 size={14}/>{note.deleted_at?"Restore note":"Move to Recently deleted"}</button></>}{!pwa.installed&&<button onClick={()=>{setInstallDialog(true);setMenu(false);}}><Download size={14}/>Install app</button>}<button className="mobile-note-action" onClick={toggleFocus}>{focusMode?<Minimize2 size={16}/>:<Maximize2 size={16}/>} {focusMode?"Exit focus mode":"Enter focus mode"}</button><button className="mobile-note-action" onClick={()=>{setTheme(theme==="light"?"dark":"light");setMenu(false);}}>{theme==="light"?<Moon size={16}/>:<Sun size={16}/>} {theme==="light"?"Enable dark mode":"Enable light mode"}</button><button onClick={()=>{setHelp(true);setMenu(false);}}><CircleHelp size={14}/>Help & shortcuts</button></div></>}</div></div></header>
      {store.error&&<div className="app-notice" role="alert"><span>{store.error}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>store.setError("")}><X size={15}/></button></div>}{catalogError&&<div className="app-notice"><BookOpen size={14}/><span>{catalogError}</span></div>}
      <div className="editor-workspace"><section className="writing-column">{note?<><div className="note-scroll"><div className="document"><div className="document-kicker"><span className="document-kind">{note.kind==="study"?<BookOpen size={13}/>:note.kind==="sermon"?<Headphones size={13}/>:<Heart size={13}/>}<select aria-label="Note collection" value={note.kind} onChange={e=>update({kind:e.target.value as NoteKind})} disabled={!!note.deleted_at}>{kinds.map(k=><option key={k.key} value={k.key}>{k.label}</option>)}</select><ChevronDown size={11}/></span><span className="document-date"><time className="full-date" dateTime={note.created_at}>{date(note.created_at,{weekday:"short",month:"long",day:"numeric",year:"numeric"})}</time><time className="compact-date" dateTime={note.created_at} title={date(note.created_at,{dateStyle:"full"})}>{date(note.created_at,{month:"short",day:"numeric",year:"numeric"})}</time>{note.pinned&&<Pin size={13}/>}</span></div><input className="topic-input" aria-label="Note topic" placeholder="Untitled note" value={note.topic} onChange={e=>update({topic:e.target.value})} readOnly={!!note.deleted_at}/><div className={`note-details ${detailsExpanded?"details-open":""}`}><button type="button" className="note-details-toggle" aria-expanded={detailsExpanded} aria-controls="note-details-fields" onClick={()=>setDetailsExpanded(value=>!value)}><Tag size={14}/>{note.preacher||note.tags.length?"Note details":"Add details"}<ChevronDown size={14}/></button><div className="document-meta" id="note-details-fields">{note.kind!=="personal"&&<><label><UserRound size={14}/><input aria-label="Preacher" placeholder="Add a preacher" value={note.preacher} onChange={e=>update({preacher:e.target.value})} readOnly={!!note.deleted_at}/></label><span className="meta-divider"/></>}<Tag size={13}/><div className="document-tags">{note.tags.map((t,i)=><span className={`document-tag tag-color-${i%4}`} key={t}>{t}{!note.deleted_at&&<button aria-label={`Remove tag ${t}`} onClick={()=>update({tags:note.tags.filter(x=>x!==t)})}><X size={10}/></button>}</span>)}{!note.deleted_at&&<input aria-label="Add a tag" value={tagInput} placeholder="+ Add tag" maxLength={40} onChange={e=>setTagInput(e.target.value)} onBlur={addTag} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag();}}}/>}</div></div></div>{note.deleted_at&&<div className="notice restore-notice">This note is in Recently deleted.<button className="text-button" onClick={()=>update({deleted_at:null})}>Restore note <ArrowRight size={13}/></button></div>}<NoteEditor key={note.id} note={note} onChange={update} onReference={requestReference} onEditor={instance=>registerEditor(instance,note.id)} readonly={!!note.deleted_at}/>{!store.user&&store.config?.authConfigured&&words>=30&&!signupDismissed&&<aside className="guest-save-prompt" aria-label="Keep your notes across devices"><Cloud size={17} aria-hidden="true"/><p>Create an account to keep your notes across devices.</p><button className="text-button" onClick={()=>setAuth("signup")}>Create account <ArrowRight size={14}/></button><button className="icon-button" aria-label="Dismiss signup suggestion" onClick={()=>{setSignupDismissed(true);try{localStorage.setItem("easychurchnotes:signup-dismissed","1");}catch{}}}><X size={15}/></button></aside>}</div></div><div className="editor-footer">{store.status!=="Saved on this device"&&<span className="saved-status">{store.status==="Syncing…"?<LoaderCircle className="spin" size={13}/>:store.status.includes("synced")?<Cloud size={14}/>:<Check size={13}/>}<span>{store.status}</span></span>}<span className="note-statistics">{words} {words===1?"word":"words"}<span className="footer-divider">·</span>Edited {new Date(note.updated_at).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</span></div></>:<div className="editor-empty"><div className="empty-art"><BookOpen size={45} strokeWidth={1}/><span className="empty-spark"><Sparkles size={18}/></span></div><span className="eyebrow">A LITTLE SPACE FOR THE WORD</span><h2>Good things begin<br/>with a little reflection.</h2><p>Capture a message. Keep a Scripture close.<br/>Make room for what God is teaching you.</p><button className="primary-button" onClick={addNote} disabled={!store.ready}><Plus size={16}/>Write a new note</button></div>}
      </section></div></main>
    {library&&<NotesDialog key={`${library.folder}:${library.tag??""}`} notes={store.notes} currentId={note?.id??null} initialFolder={library.folder} initialTag={library.tag} ready={store.ready} error={store.error} onClose={()=>setLibrary(null)} onSelect={selectNote} onNew={createNote} onExport={exportAll}/>}
    {bibleDialog&&<PassageDialog key={bibleDialog.key} initialQuery={bibleDialog.query} versions={versions} popular={popular} version={version} onVersion={selectVersion} configured={!!store.config?.bibleConfigured} onInsert={insertPassages} onClose={()=>{setBibleDialog(null);insertTarget.current=null;}}/>}
    {auth&&<AuthDialog initialMode={auth} client={store.client} user={store.user} recovery={store.recovery} onClose={()=>{setAuth(null);store.setRecovery(false);}} onImport={store.importGuest} onExport={exportAll}/>}{help&&<HelpDialog onClose={()=>setHelp(false)}/>}{toast&&<div className="toast" role="status"><Check size={15}/>{toast}</div>}
    {installDialog&&<InstallDialog canPrompt={pwa.canPrompt} platform={pwa.platform} onInstall={pwa.install} onClose={()=>setInstallDialog(false)}/>}
    <KeyboardShortcuts onNew={addNote} onNotes={openNotes} ready={store.ready} onSearch={()=>openBibleDialog()}/>
  </div>;
}
function KeyboardShortcuts({onNew,onSearch,onNotes,ready}:{onNew:()=>void;onSearch:()=>void;onNotes:()=>void;ready:boolean}) {
  const callbacks=useRef({onNew,onSearch,onNotes,ready});callbacks.current={onNew,onSearch,onNotes,ready};
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(document.querySelector("dialog[open]"))return;if(e.metaKey||e.ctrlKey){if(e.altKey&&e.key.toLowerCase()==="n"){e.preventDefault();if(callbacks.current.ready)callbacks.current.onNew();}if(e.shiftKey&&e.key.toLowerCase()==="b"){e.preventDefault();callbacks.current.onSearch();}if(e.key.toLowerCase()==="k"){e.preventDefault();callbacks.current.onNotes();}}};window.addEventListener("keydown",handler);return ()=>window.removeEventListener("keydown",handler);},[]);return null;
}
function HelpDialog({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog className="auth-dialog help-dialog" ref={ref} aria-labelledby="help-title" onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><button className="icon-button dialog-close" aria-label="Close help" onClick={onClose}><X size={18}/></button><div className="auth-mark"><Feather size={25}/></div><span className="eyebrow">A NOTE BEFORE YOU BEGIN</span><h2 id="help-title">Make yourself at home.</h2><div className="help-items"><div><BookOpen size={19}/><p><strong>Scripture, right where you are.</strong>Type John 3:16, Jn 3:16, or Romans 8:28–30, then press Space or Enter. Insert the passage or keep writing.</p></div><div><Search size={19}/><p><strong>Find the words you remember.</strong>Open Search Bible to find a phrase or passage. Choose KJV or another available version from the toolbar.</p></div><div><Cloud size={19}/><p><strong>Your thoughts, kept close.</strong>Notes save on this device as you type. Sign in to sync account notes. Use Import in your account to bring device notes with you.</p></div><div><Tag size={19}/><p><strong>A little organisation.</strong>Give notes a topic, preacher, and tags. Press Enter or comma to add a tag. Pin favourites from the note actions menu.</p></div></div><div className="shortcut-row"><span>New note</span><kbd>Ctrl / ⌘ + Alt + N</kbd></div><div className="shortcut-row"><span>Search Bible</span><kbd>Ctrl / ⌘ + Shift + B</kbd></div><p className="auth-footnote">The three starter notes are examples you can edit or delete.</p></dialog>;
}
