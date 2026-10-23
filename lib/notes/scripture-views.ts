"use client";

// API.Bible's required FUMS reports only the provider token and random identifiers.
// Account details and note text are never included.
export function trackScriptureViews(tokens:string[]) {
  const valid=Array.from(new Set(tokens.filter(t=>typeof t==="string"&&t.length>0&&t.length<=8192)));
  if(!valid.length||typeof window==="undefined")return;
  try{
    const identifier=(storage:Storage,key:string)=>{let value=storage.getItem(key);if(!value){value=crypto.randomUUID();storage.setItem(key,value);}return value;};
    const params=new URLSearchParams({dId:identifier(localStorage,"easychurchnotes:scripture-device"),sId:identifier(sessionStorage,"easychurchnotes:scripture-session")});
    valid.forEach(t=>params.append("t",t));
    void fetch(`https://fums.api.bible/f3?${params}`,{mode:"no-cors",credentials:"omit",referrerPolicy:"no-referrer",keepalive:true}).catch(()=>undefined);
  }catch{/* Storage/network restrictions must not interrupt note taking. */}
}
