"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Cross, Headphones, Heart, PenLine } from "lucide-react";
import NotesApp from "./notes-app";
import { makeNote } from "@/lib/notes/types";

const startedKey = "easychurchnotes:started";
function subscribeToEntry(change: () => void) {
  window.addEventListener("storage", change);
  window.addEventListener("hashchange", change);
  return () => { window.removeEventListener("storage", change); window.removeEventListener("hashchange", change); };
}
function hasNotebook() {
  if (new URLSearchParams(location.search).has("code") || /(?:access_token=|type=recovery|error_description=)/.test(location.hash)) return true;
  try {
    return localStorage.getItem(startedKey) === "1" || Object.keys(localStorage).some(key => key.startsWith("easychurchnotes:v1:") || /^sb-.+-auth-token$/.test(key));
  } catch { return false; }
}

export default function NotebookHome() {
  const [entered, setEntered] = useState(false);
  const [startWriting, setStartWriting] = useState(false);
  const [initialAuth, setInitialAuth] = useState<"login" | null>(null);
  const returning = useSyncExternalStore(subscribeToEntry, hasNotebook, () => false);

  function enter(auth: "login" | null = null) {
    try {
      localStorage.setItem(startedKey, "1");
      if (localStorage.getItem("easychurchnotes:v1:guest") === null) {
        localStorage.setItem("easychurchnotes:v1:guest", JSON.stringify([makeNote()]));
      }
    } catch { /* The notebook reports storage errors and offers an export. */ }
    setInitialAuth(auth);
    setStartWriting(true);
    setEntered(true);
  }

  if (entered || returning) return <NotesApp initialAuth={initialAuth} startWriting={startWriting} />;

  return <div className="welcome-page">
    <header className="welcome-header">
      <Link className="brand" href="/" aria-label="EasyChurchNotes home"><span className="brand-mark"><Cross size={22} /></span><span>EasyChurch<span className="brand-second">Notes</span></span></Link>
      <button className="welcome-signin" onClick={() => enter("login")}>Sign in <ArrowRight size={16} aria-hidden="true" /></button>
    </header>
    <main className="welcome-main">
      <section className="welcome-copy" aria-labelledby="welcome-title">
        <span className="eyebrow">READ. LISTEN. REFLECT.</span>
        <h1 id="welcome-title">A little space<br />for <span>the Word.</span></h1>
        <p>For the verse that stays with you. The message you want to remember. And the thoughts along the way.</p>
        <button className="primary-button welcome-start" onClick={() => enter()}>Start taking notes <ArrowRight size={18} aria-hidden="true" /></button>
        <span className="welcome-reassurance"><Check size={15} aria-hidden="true" />No account needed. Just start writing.</span>
      </section>
      <div className="welcome-preview">
        <div className="welcome-notebook-label"><PenLine size={15} aria-hidden="true" />A thought worth keeping</div>
        <article className="welcome-note" aria-label="Example note">
          <div className="welcome-note-top"><span><Headphones size={14} aria-hidden="true" />Sermon notes</span><span className="welcome-note-tag">FAITH</span></div>
          <h2>Faith for the<br />next step.</h2>
          <p>I don’t need to see the whole path to take the next step with God.</p>
          <blockquote><span>2 CORINTHIANS 5:7 <span>KJV</span></span><p>For we walk by faith, not by sight.</p></blockquote>
          <div className="welcome-note-bottom"><span className="welcome-caret" aria-hidden="true" />Room for what comes next.</div>
        </article>
      </div>
    </main>
    <footer className="welcome-footer"><span><BookOpen size={17} aria-hidden="true" />Bible study</span><span><Headphones size={17} aria-hidden="true" />Sunday messages</span><span><Heart size={17} aria-hidden="true" />Personal reflections</span></footer>
  </div>;
}
