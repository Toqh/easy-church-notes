// Checks existing configuration without printing keys or creating accounts.
import { readFileSync } from "node:fs";
const values=Object.fromEntries(readFileSync(".dev.vars","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i),l.slice(i+1)];}));
const checks=[
  ["Public Bible fallback", "https://cdn.jsdelivr.net/gh/wldeh/bible-api@main/bibles/en-kjv/books/john/chapters/3/verses/16.json", {}],
  ["YouVersion catalogue",`${"https://api.youversion.com/v1/bibles"}?language_ranges%5B%5D=en&page_size=99`,{"X-YVP-App-Key":values.YOUVERSION_APP_KEY}],
  ["Supabase connection",`${values.SUPABASE_URL}/auth/v1/settings`,{apikey:values.SUPABASE_PUBLISHABLE_KEY}],
  ["Supabase anonymous notes access",`${values.SUPABASE_URL}/rest/v1/notes?select=id&limit=1`,{apikey:values.SUPABASE_PUBLISHABLE_KEY}],
];
for(const [label,url,headers] of checks){try{const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});let details={};if(label==="YouVersion catalogue"&&r.ok){const data=await r.json();details={translationCount:data.data?.length,kjvAvailable:data.data?.some(b=>b.abbreviation==="KJV")};}console.log(JSON.stringify({check:label,status:r.status,...details}));}catch(e){console.log(JSON.stringify({check:label,error:e.cause?.code||e.name}));}}
