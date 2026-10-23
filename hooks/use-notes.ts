"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { guestImportKey, makeNote, type Note, type NoteKind } from "@/lib/notes/types";
import { starterNotes } from "@/lib/notes/seed";

export interface AppConfig { authConfigured:boolean; bibleConfigured:boolean; supabaseUrl:string; supabaseKey:string }
const storageKey=(owner:string)=>`easychurchnotes:v1:${owner}`;
function readCache(owner:string):Note[]|null {
  const value=localStorage.getItem(storageKey(owner));
  if(!value) return null;
  const parsed=JSON.parse(value);
  if(!Array.isArray(parsed)||!parsed.every(n=>typeof n.id==="string"&&typeof n.topic==="string"&&typeof n.updated_at==="string"&&Array.isArray(n.tags)&&n.content?.type==="doc")) throw new Error("Your saved notes could not be read. Export or restore the browser data before continuing.");
  return parsed;
}
export function useNotes() {
  const [config,setConfig]=useState<AppConfig|null>(null);
  const [client,setClient]=useState<SupabaseClient|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [notes,setNotes]=useState<Note[]>([]);
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState("Loading your notes…");
  const [error,setError]=useState("");
  const [recovery,setRecovery]=useState(false);
  const ownerRef=useRef("guest");
  const notesRef=useRef<Note[]>([]);
  const pending=useRef(new Map<string,Note>());
  const generation=useRef(0);
  const readyRef=useRef(false);
  const syncing=useRef(false);
  useEffect(()=>{
    let active=true;
    fetch("/api/config").then(async r=>{if(!r.ok)throw new Error();return await r.json() as AppConfig;}).then((cfg)=>{
      if(!active)return;
      setConfig(cfg);
      if(cfg.authConfigured) {
        const db=createClient(cfg.supabaseUrl,cfg.supabaseKey);
        setClient(db);
      }
    }).catch(()=>{if(active){setConfig({authConfigured:false,bibleConfigured:false,supabaseUrl:"",supabaseKey:""});setError("Could not check the connection. Your notes are available on this device.");}});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!config || (config.authConfigured&&!client))return;
    let alive=true;
    const load=async(next:User|null)=>{
      const owner=next?.id??"guest";
      if(readyRef.current && ownerRef.current===owner)return;
      const run=++generation.current;
      readyRef.current=false; setReady(false); setUser(next); ownerRef.current=owner; pending.current.clear();
      try {
        let cached=readCache(owner);
        if(!cached&&!next) {cached=starterNotes();localStorage.setItem(storageKey(owner),JSON.stringify(cached));}
        if(next&&client) {
          const response=await client.from("notes").select("*").eq("user_id",next.id).order("updated_at",{ascending:false});
          if(run!==generation.current||!alive)return;
          if(response.error) {setError("Could not load account notes. Check your connection and run the Supabase setup SQL. Any edits are kept on this device.");}
          else {
            const server=response.data as Note[];
            const merged=new Map(server.map(n=>[n.id,n]));
            for(const note of cached??[]) {
              const remote=merged.get(note.id);
              if(!remote || note.updated_at>remote.updated_at){merged.set(note.id,note);pending.current.set(note.id,note);}
            }
            cached=Array.from(merged.values());
          }
        }
        if(run!==generation.current||!alive)return;
        if(next?.email&&localStorage.getItem(guestImportKey)===next.email.toLowerCase()) {
          const merged=new Map((cached??[]).map(n=>[n.id,n]));
          for(const guest of readCache("guest")??[]) {
            const existing=merged.get(guest.id);
            if(!existing||guest.updated_at>existing.updated_at){merged.set(guest.id,guest);pending.current.set(guest.id,guest);}
          }
          cached=Array.from(merged.values());
          // Keep an account copy before clearing the request. Guest originals stay
          // on the device, and pending imports retry through the normal sync loop.
          localStorage.setItem(storageKey(owner),JSON.stringify(cached));
          localStorage.removeItem(guestImportKey);
        }
        notesRef.current=cached??[];setNotes(notesRef.current);
        setStatus(next?"Saved on this device":"Saved on this device");
        readyRef.current=true;setReady(true);
      } catch(e) {if(alive&&run===generation.current){setError(e instanceof Error?e.message:"Could not open saved notes.");setStatus("Storage unavailable");}}
    };
    if(!client) {void load(null);return ()=>{alive=false;};}
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY")setRecovery(true);
      // Database calls must run after the auth callback releases its lock.
      setTimeout(()=>{if(alive)void load(session?.user??null);},0);
    });
    client.auth.getSession().then(({data,error:sessionError})=>{if(sessionError&&alive)setError(sessionError.message);if(alive)void load(data.session?.user??null);});
    return ()=>{alive=false;subscription.unsubscribe();};
  },[client,config]);
  const persist=useCallback((next:Note[],changed?:Note[])=>{
    if(!readyRef.current)return;
    notesRef.current=next;setNotes(next);
    try {localStorage.setItem(storageKey(ownerRef.current),JSON.stringify(next));setStatus("Saved on this device");}
    catch {setError("Device storage is full or unavailable. Export your notes to keep a copy.");setStatus("Could not save on device");}
    if(ownerRef.current!=="guest")for(const n of changed??[])pending.current.set(n.id,n);
  },[]);
  const update=useCallback((id:string,patch:Partial<Note>)=>{
    const original=notesRef.current.find(n=>n.id===id);if(!original)return;
    const next={...original,...patch,id:original.id,created_at:original.created_at,updated_at:new Date().toISOString()};
    persist(notesRef.current.map(n=>n.id===id?next:n),[next]);
  },[persist]);
  const add=useCallback((kind:NoteKind="sermon")=>{const note=makeNote(kind);persist([note,...notesRef.current],[note]);return note.id;},[persist]);
  useEffect(()=>{
    if(!client||!user||!ready)return;
    let cancelled=false;
    const sync=async()=>{
      if(syncing.current||!pending.current.size)return;
      const run=generation.current;
      const batch=Array.from(pending.current.values());
      syncing.current=true;setStatus("Syncing…");
      try {
        const rows=batch.map(n=>({id:n.id,user_id:user.id,topic:n.topic,preacher:n.preacher,tags:n.tags,kind:n.kind,content:n.content,plain_text:n.plain_text,pinned:n.pinned,deleted_at:n.deleted_at,created_at:n.created_at,updated_at:n.updated_at}));
        const response=await client.from("notes").upsert(rows,{onConflict:"id"});
        if(cancelled||run!==generation.current)return;
        if(response.error) {setStatus("Saved on device · sync paused");setError("Account sync failed. Your edits remain on this device. Check your connection and database setup.");}
        else {
          for(const n of batch)if(pending.current.get(n.id)===n)pending.current.delete(n.id);
          setStatus(pending.current.size?"Syncing…":"All changes synced");setError("");
        }
      } finally {syncing.current=false;}
    };
    const interval=setInterval(()=>{void sync().catch(()=>{if(!cancelled){setStatus("Saved on device · sync paused");setError("Account sync is unavailable. Your edits remain on this device.");}});},1200);
    return ()=>{cancelled=true;clearInterval(interval);};
  },[client,user,ready]);
  const importGuest=useCallback(()=>{
    if(!user)return 0;
    const guests=readCache("guest")??[];
    const existing=new Set(notesRef.current.map(n=>n.id));
    const additions=guests.filter(n=>!existing.has(n.id));
    persist([...additions,...notesRef.current],additions);return additions.length;
  },[user,persist]);
  return {config,client,user,notes,ready,status,error,setError,update,add,importGuest,recovery,setRecovery};
}
