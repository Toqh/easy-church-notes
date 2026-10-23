import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const values=Object.fromEntries(readFileSync(".dev.vars","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i),l.slice(i+1)];}));
const sensitive=["YOUVERSION_APP_KEY","API_BIBLE_KEY"].map(key=>({key,value:values[key]})).filter(x=>x.value);
const found=[];
function inspect(directory) {for(const entry of readdirSync(directory,{withFileTypes:true})){const name=path.join(directory,entry.name);if(entry.isDirectory())inspect(name);else {const bytes=readFileSync(name);for(const item of sensitive)if(bytes.includes(Buffer.from(item.value)))found.push({file:name,key:item.key});}}}
for(const directory of process.argv.slice(2).length?process.argv.slice(2):["dist"])inspect(directory);
if(found.length){console.error(JSON.stringify({error:"A server secret was included in build output",matches:found}));process.exitCode=1;}
else console.log("Release check passed: Bible API secrets are absent from all build output.");
