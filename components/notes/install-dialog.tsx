"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import {Download,Share,X} from "lucide-react";

export default function InstallDialog({canPrompt,platform,onInstall,onClose}:{canPrompt:boolean;platform:"ios"|"safari"|"firefox"|"other";onInstall:()=>Promise<boolean>;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const element=dialog.current;element?.showModal();return ()=>element?.close();},[]);
  const close=()=>{dialog.current?.close();onClose();};
  return <dialog className="auth-dialog install-dialog" ref={dialog} aria-labelledby="install-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current){const box=dialog.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}}}>
    <button type="button" className="icon-button dialog-close" aria-label="Close install instructions" onClick={close}><X size={18}/></button>
    <Image src="/icons/icon-192.png" width={64} height={64} alt="" className="install-app-icon" unoptimized/>
    <h2 id="install-title">Install EasyChurchNotes</h2>
    <p className="install-description">Keep your notebook one tap away, in its own app window.</p>
    {canPrompt?<button type="button" className="primary-button install-primary" disabled={busy} onClick={async()=>{setBusy(true);const accepted=await onInstall();if(accepted)close();else setBusy(false);}}><Download size={17}/>{busy?"Opening…":"Install app"}</button>:platform==="ios"?<ol className="install-steps"><li>Tap <strong>Share</strong> <Share size={15} aria-hidden="true"/> in your browser.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol>:platform==="safari"?<p className="install-steps">In Safari, choose <strong>File → Add to Dock</strong>, then <strong>Add</strong>.</p>:platform==="firefox"?<p className="install-steps">On Android, open the browser menu and choose <strong>Install</strong>. On a computer, open this site in Chrome, Edge or Safari to install it.</p>:<p className="install-steps">Open your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>. You can also use the install icon in the address bar when available.</p>}
    <p className="auth-footnote">Bible lookup and account syncing need an internet connection.</p>
  </dialog>;
}
