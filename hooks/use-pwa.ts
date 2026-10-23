"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from "react";

interface InstallEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>}
function subscribeStandalone(change:()=>void){const query=window.matchMedia("(display-mode: standalone)");query.addEventListener("change",change);return ()=>query.removeEventListener("change",change);}
function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;}
function subscribePlatform(){return ()=>{};}
function browserPlatform():"ios"|"safari"|"firefox"|"other" {
  const agent=navigator.userAgent;
  return /iPad|iPhone|iPod/.test(agent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)?"ios":/Safari/.test(agent)&&!/Chrome|Chromium|Edg/.test(agent)?"safari":/Firefox/.test(agent)?"firefox":"other";
}
export function usePwa(){
  const prompt=useRef<InstallEvent|null>(null);
  const [canPrompt,setCanPrompt]=useState(false);
  const [installed,setInstalled]=useState(false);
  const standalone=useSyncExternalStore(subscribeStandalone,isStandalone,()=>false);
  const platform=useSyncExternalStore(subscribePlatform,browserPlatform,()=>"other" as const);
  useEffect(()=>{
    const beforeInstall=(event:Event)=>{event.preventDefault();prompt.current=event as InstallEvent;setCanPrompt(true);};
    const installedHandler=()=>{prompt.current=null;setCanPrompt(false);setInstalled(true);};
    window.addEventListener("beforeinstallprompt",beforeInstall);window.addEventListener("appinstalled",installedHandler);
    if(process.env.NODE_ENV==="production"&&"serviceWorker" in navigator&&window.isSecureContext)void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>undefined);
    return ()=>{window.removeEventListener("beforeinstallprompt",beforeInstall);window.removeEventListener("appinstalled",installedHandler);};
  },[]);
  async function install(){
    const event=prompt.current;if(!event)return false;
    prompt.current=null;setCanPrompt(false);
    try{await event.prompt();return (await event.userChoice).outcome==="accepted";}catch{return false;}
  }
  return {canPrompt,installed:installed||standalone,platform,install};
}
