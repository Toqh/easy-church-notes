"use client";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { X, ArrowRight, BookOpen, LogOut, Download, Upload, LoaderCircle } from "lucide-react";

interface Props { client:SupabaseClient|null; user:User|null; recovery:boolean; onClose:()=>void; onImport:()=>number; onExport:()=>void }
export default function AuthDialog({client,user,recovery,onClose,onImport,onExport}:Props) {
  const [mode,setMode]=useState<"login"|"signup"|"reset"|"password">(recovery?"password":"login");
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function submit(e:React.FormEvent) {
    e.preventDefault();if(!client)return;
    setBusy(true);setError("");setMessage("");
    try {
      if(mode==="signup") {
        const {data,error:err}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin}});if(err)throw err;
        if(data.session)onClose();else setMessage("Check your email to confirm your account. Then come back to sign in.");
      } else if(mode==="login") {const {error:err}=await client.auth.signInWithPassword({email,password});if(err)throw err;onClose();}
      else if(mode==="reset") {const {error:err}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(err)throw err;setMessage("If there’s an account for that email, a password reset link is on its way.");}
      else {const {error:err}=await client.auth.updateUser({password});if(err)throw err;setMessage("Your password has been updated.");}
    } catch(e){setError(e instanceof Error?e.message:"Something went wrong. Please try again.");}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="auth-dialog" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}} aria-labelledby="auth-title"><button className="icon-button dialog-close" aria-label="Close account" onClick={onClose}><X size={19}/></button><div className="auth-mark"><BookOpen size={25}/></div>
    {user&&mode!=="password"?<><span className="eyebrow">YOUR OWN QUIET SPACE</span><h2 id="auth-title">Hello, {user.user_metadata.full_name?.split(" ")[0]||"friend"}.</h2><p className="muted">{user.email}</p><div className="account-actions"><button className="secondary-button" onClick={()=>{setMessage(`${onImport()} device notes added to your account.`);}}><Upload size={16}/>Import notes from this device</button><button className="secondary-button" onClick={onExport}><Download size={16}/>Export all notes</button><button className="text-button" onClick={async()=>{setBusy(true);const r=await client?.auth.signOut();setBusy(false);if(r?.error)setError(r.error.message);else onClose();}} disabled={busy}><LogOut size={16}/>Sign out</button></div></>:<><span className="eyebrow">EASYCHURCHNOTES</span><h2 id="auth-title">{mode==="signup"?"A space of your own.":mode==="reset"?"Let’s get you back in.":mode==="password"?"A fresh start.":"Welcome back."}</h2><p className="muted">{mode==="signup"?"Keep your notes close, wherever you are.":mode==="reset"?"We’ll email you a link to reset your password.":mode==="password"?"Choose a new password for your account.":"Pick up where your last reflection left off."}</p>
    {!client&&<div className="notice">Account connection is being set up. You can keep taking notes on this device in the meantime.</div>}
    <form onSubmit={submit}>{mode==="signup"&&<label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="What should we call you?" required/></label>}{mode!=="password"&&<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></label>}{mode!=="reset"&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"} minLength={mode==="login"?1:8} placeholder={mode==="login"?"Your password":"At least 8 characters"} required/></label>}{mode==="login"&&<button type="button" className="text-button forgot" onClick={()=>{setMode("reset");setError("");setMessage("");}}>Forgot password?</button>}<button className="primary-button auth-submit" disabled={!client||busy}>{busy?<LoaderCircle className="spin" size={17}/>:<>{mode==="signup"?"Create account":mode==="reset"?"Send reset link":mode==="password"?"Update password":"Sign in"}<ArrowRight size={17}/></>}</button></form>
    {mode!=="password"&&<p className="auth-switch">{mode==="login"?"New here? ":"Already have an account? "}<button className="text-button" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("");}}>{mode==="login"?"Create an account":"Sign in"}</button></p>}</>}
    {message&&<p className="success-message" role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}<p className="auth-footnote">A little space for the Word. A little room to grow.</p></dialog>;
}
