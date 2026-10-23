// A read-only connection check. Never prints credentials or Scripture content.
import {readFileSync} from "node:fs";
import {createApiBibleClient} from "../lib/notes/api-bible.ts";
const values=Object.fromEntries(readFileSync(".dev.vars","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const position=line.indexOf("=");return [line.slice(0,position),line.slice(position+1).trim()];}));
const client=createApiBibleClient(values.API_BIBLE_KEY??"",fetch,values.API_BIBLE_BASE_URL||undefined);
try{
  const versions=await client.versions();
  console.log(JSON.stringify({check:"API.Bible authorised translations",available:versions.map(v=>({id:v.id,abbreviation:v.abbreviation,title:v.title})),missing:["NIV","NLT","AMP"].filter(abbreviation=>!versions.some(v=>v.abbreviation===abbreviation))}));
  for(const version of versions){
    try{const passage=await client.passage(version.id,"JHN.3.16");const search=await client.search(version.id,"love");console.log(JSON.stringify({version:version.abbreviation,passage:passage.reference,hasText:!!passage.content,hasCopyright:!!passage.version.copyright,searchResultCount:search.passages.length}));}
    catch(error){console.log(JSON.stringify({version:version.abbreviation,status:error.status??null,error:error.cause?.code??error.message}));process.exitCode=1;}
  }
}catch(error){console.log(JSON.stringify({check:"API.Bible connection",status:error.status??null,error:error.cause?.code??error.message}));process.exitCode=1;}
