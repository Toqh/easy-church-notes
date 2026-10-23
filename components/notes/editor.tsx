"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, Extension, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextSelection } from "@tiptap/pm/state";
import { Bold, Italic, List, ListOrdered, Heading2, Quote, Undo2, Redo2, Type } from "lucide-react";
import { detectReference, type BibleReference } from "@/lib/notes/bible-reference";
import type { Note } from "@/lib/notes/types";
import { trackScriptureViews } from "@/lib/notes/scripture-views";

const ScriptureMetadata=Extension.create({
  name:"scriptureMetadata",
  addGlobalAttributes(){return [{types:["blockquote"],attributes:{apiBibleToken:{default:null,parseHTML:element=>element.getAttribute("data-api-bible-token"),renderHTML:attributes=>attributes.apiBibleToken?{"data-api-bible-token":attributes.apiBibleToken}:{}}}}];},
});

interface Props { note:Note; onChange:(patch:Partial<Note>)=>void; onReference:(reference:BibleReference)=>void; onEditor:(editor:Editor)=>(()=>void)|void; readonly?:boolean }
export default function NoteEditor({note,onChange,onReference,onEditor,readonly=false}:Props) {
  const [formattingOpen,setFormattingOpen]=useState(false);
  const callbacks=useRef({onChange,onReference,onEditor}); callbacks.current={onChange,onReference,onEditor};
  const editor=useEditor({
    immediatelyRender:false,
    shouldRerenderOnTransaction:true,
    extensions:[StarterKit,ScriptureMetadata,Placeholder.configure({placeholder:"Let your thoughts find their way here…"})],
    content:note.content,
    editable:!readonly,
    editorProps:{attributes:{class:"writing-surface",role:"textbox","aria-label":"Note content","aria-multiline":"true"},handleDOMEvents:{mousedown:(view,event)=>{
      const last = view.dom.lastElementChild;
      if(view.editable && event.button===0 && event.target===view.dom && last && event.clientY>last.getBoundingClientRect().bottom) {
        event.preventDefault();
        let transaction=view.state.tr;
        const tail=transaction.doc.lastChild;
        if(!tail || tail.type.name!=="paragraph" || tail.content.size>0) transaction=transaction.insert(transaction.doc.content.size,view.state.schema.nodes.paragraph.create());
        view.dispatch(transaction.setSelection(TextSelection.atEnd(transaction.doc)));view.focus();return true;
      }
      return false;
    }},handleKeyDown:(view,event)=>{
      if(!event.isComposing&&(event.key===" "||event.key==="Enter")) {
        const {from,empty}=view.state.selection;
        if(empty){const text=view.state.doc.textBetween(Math.max(0,from-120),from," "); const reference=detectReference(text);if(reference)callbacks.current.onReference(reference);}
      }
      return false;
    }},
    onUpdate:({editor:e})=>callbacks.current.onChange({content:e.getJSON(),plain_text:e.getText()}),
  });
  useEffect(()=>{editor?.setEditable(!readonly,false);},[editor,readonly]);
  useEffect(()=>{
    if(editor&&!editor.isDestroyed&&JSON.stringify(editor.getJSON())!==JSON.stringify(note.content)) editor.commands.setContent(note.content,{emitUpdate:false});
  },[editor,note.content]);
  useEffect(()=>{
    if(!editor || editor.isDestroyed)return;
    return callbacks.current.onEditor(editor);
  },[editor]);
  const viewedTokens=useRef(new Set<string>());
  useEffect(()=>{
    if(!editor||editor.isDestroyed)return;
    const observer=new IntersectionObserver(entries=>{
      const tokens=entries.filter(entry=>entry.isIntersecting).flatMap(entry=>{const token=(entry.target as HTMLElement).dataset.apiBibleToken;if(!token||viewedTokens.current.has(token))return [];viewedTokens.current.add(token);return [token];});
      trackScriptureViews(tokens);
    },{root:editor.view.dom.closest(".note-scroll")});
    editor.view.dom.querySelectorAll("blockquote[data-api-bible-token]").forEach(element=>observer.observe(element));
    return ()=>observer.disconnect();
  },[editor,note.content]);
  const tools=[
    {label:"Bold",icon:Bold,active:editor?.isActive("bold"),run:()=>editor?.chain().focus().toggleBold().run()},
    {label:"Italic",icon:Italic,active:editor?.isActive("italic"),run:()=>editor?.chain().focus().toggleItalic().run()},
    {label:"Heading",icon:Heading2,active:editor?.isActive("heading"),run:()=>editor?.chain().focus().toggleHeading({level:2}).run()},
    {label:"Bullet list",icon:List,active:editor?.isActive("bulletList"),run:()=>editor?.chain().focus().toggleBulletList().run()},
    {label:"Numbered list",icon:ListOrdered,active:editor?.isActive("orderedList"),run:()=>editor?.chain().focus().toggleOrderedList().run()},
    {label:"Quote",icon:Quote,active:editor?.isActive("blockquote"),run:()=>editor?.chain().focus().toggleBlockquote().run()},
  ];
  return <><div className={`format-toolbar ${formattingOpen?"format-open":""}`} role="toolbar" aria-label="Text formatting"><button type="button" className="icon-button format-toggle" aria-label="Formatting options" aria-expanded={formattingOpen} onMouseDown={event=>event.preventDefault()} onClick={()=>setFormattingOpen(value=>!value)} disabled={readonly}><Type size={20}/></button><div className="format-tools">{tools.map(({label,icon:Icon,active,run})=><button type="button" key={label} title={label} aria-label={label} aria-pressed={!!active} className={`icon-button format-option ${active?"is-active":""}`} onMouseDown={e=>e.preventDefault()} onClick={run} disabled={readonly}><Icon size={16}/></button>)}<span className="tool-divider"/><button className="icon-button" aria-label="Undo" title="Undo" onClick={()=>editor?.chain().focus().undo().run()} disabled={readonly}><Undo2 size={15}/></button><button className="icon-button" aria-label="Redo" title="Redo" onClick={()=>editor?.chain().focus().redo().run()} disabled={readonly}><Redo2 size={15}/></button></div></div>{!readonly&&editor?.isEmpty&&<p className="reference-tip">Type <code>John 3:16</code>, then press <kbd>Enter</kbd> to add a verse.</p>}<EditorContent editor={editor}/></>;
}
