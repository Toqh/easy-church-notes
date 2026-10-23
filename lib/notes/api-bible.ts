import { z } from "zod";
import { validPassageId } from "./bible-reference.ts";
import { BibleError } from "./youversion.ts";
import type { BibleVersion, Passage } from "./types.ts";

// Stable app IDs. Actual provider IDs are discovered from this key's catalogue.
const targets = [{id:-101,abbreviation:"NIV"},{id:-102,abbreviation:"NLT"},{id:-103,abbreviation:"AMP"}];
const editionSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9-]+$/),abbreviation:z.string(),abbreviationLocal:z.string().optional(),name:z.string(),copyright:z.string().nullish(),info:z.string().nullish(),language:z.object({id:z.string()})});
const catalogueSchema=z.object({data:z.array(editionSchema)});
const metaSchema=z.object({fumsToken:z.string().max(8192).optional()}).optional();
const passageSchema=z.object({data:z.object({id:z.string(),bibleId:z.string(),reference:z.string(),content:z.string(),verseCount:z.number().int().positive().optional(),copyright:z.string().nullish()}),meta:metaSchema});
const searchSchema=z.object({data:z.object({total:z.number().int().nonnegative().optional(),offset:z.number().int().nonnegative().optional(),limit:z.number().int().positive().optional(),verses:z.array(z.object({id:z.string(),bibleId:z.string(),reference:z.string(),text:z.string()})).optional(),passages:z.array(z.object({id:z.string(),bibleId:z.string(),reference:z.string(),content:z.string(),copyright:z.string().nullish()})).optional()}),meta:metaSchema});
function matchesEdition(edition:z.infer<typeof editionSchema>,abbreviation:string){
  const primary=edition.abbreviation.toUpperCase();
  if(["AMPC","NIVUK","NLTUK"].includes(primary)&&primary!==abbreviation)return false;
  if(abbreviation==="AMP"&&/classic/i.test(edition.name))return false;
  return primary===abbreviation||edition.abbreviationLocal?.toUpperCase()===abbreviation;
}

export function apiBibleBaseUrl(input="https://rest.api.bible/v1") {
  const url=new URL(input);
  if(url.origin!=="https://rest.api.bible" || url.username || url.password || url.search || url.hash || !["","/","/v1","/v1/"].includes(url.pathname)) throw new BibleError("API.Bible has an invalid server endpoint.",503);
  return `${url.origin}/v1`;
}
// Copyright/info may contain markup; it is rendered as text, never executed as HTML.
export function biblePlainText(input:string) {
  const named:Record<string,string>={amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" ",copy:"©",reg:"®",trade:"™",ndash:"–",mdash:"—",rsquo:"’",lsquo:"‘",ldquo:"“",rdquo:"”"};
  return input.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/p\s*>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(original,entity:string)=>{
    if(!entity.startsWith("#"))return named[entity.toLowerCase()]??original;
    const code=entity[1].toLowerCase()==="x"?parseInt(entity.slice(2),16):Number(entity.slice(1));
    return Number.isInteger(code)&&code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):original;
  }).trim();
}
export function apiBiblePassageId(id:string) {
  if(!validPassageId(id))throw new BibleError("Please enter a valid Bible reference.",400);
  const [start,end]=id.split("-");
  return end?`${start}-${start.split(".").slice(0,2).join(".")}.${end}`:start;
}
function appPassageId(id:string) {
  const [start,end]=id.split("-");
  if(!end)return validPassageId(start)?start:null;
  const prefix=start.split(".").slice(0,2).join(".");
  const compact=end.startsWith(`${prefix}.`)?`${start}-${end.slice(prefix.length+1)}`:id;
  return validPassageId(compact)?compact:null;
}

export function createApiBibleClient(key:string,fetcher:typeof fetch=fetch,endpoint="https://rest.api.bible/v1") {
  let editionsPromise:Promise<z.infer<typeof editionSchema>[]>|undefined;
  async function request<S extends z.ZodTypeAny>(path:string,schema:S,params?:URLSearchParams):Promise<z.output<S>> {
    if(!key)throw new BibleError("API.Bible is not connected.",503);
    const response=await fetcher(`${apiBibleBaseUrl(endpoint)}${path}${params?`?${params}`:""}`,{headers:{"api-key":key,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!response.ok){
      const message=response.status===401?"API.Bible could not authorise the app key. Check its server configuration.":response.status===403?"This translation is not enabled for this API.Bible app. Enable it in your API.Bible dashboard.":response.status===404?"This passage is unavailable in the selected translation. Check the reference.":response.status===429?"API.Bible's request limit has been reached. Please try again later.":"API.Bible could not connect. Please try again.";
      throw new BibleError(message,[400,401,403,404,429].includes(response.status)?response.status:502,response.headers.get("retry-after")??undefined);
    }
    const parsed=schema.safeParse(await response.json());
    if(!parsed.success)throw new BibleError("API.Bible returned an unexpected response. Please try again.");
    return parsed.data;
  }
  function editions(){
    if(!editionsPromise)editionsPromise=request("/bibles",catalogueSchema,new URLSearchParams({language:"eng","include-full-details":"true"})).then(result=>result.data.filter(v=>v.language.id==="eng"));
    return editionsPromise;
  }
  async function edition(id:number){
    const target=targets.find(t=>t.id===id);
    if(!target)throw new BibleError("This API.Bible translation is unavailable.",400);
    const result=(await editions()).find(v=>matchesEdition(v,target.abbreviation));
    if(!result)throw new BibleError(`${target.abbreviation} is not enabled for this API.Bible app. Enable it in your API.Bible dashboard.`,403);
    return result;
  }
  function version(data:z.infer<typeof editionSchema>,id:number,copyright?:string|null):BibleVersion {
    const target=targets.find(v=>v.id===id)!;
    return {id,abbreviation:target.abbreviation,title:data.name,provider:"api.bible",copyright:biblePlainText(copyright??data.copyright??"")||undefined,info:biblePlainText(data.info??"")||undefined};
  }
  async function versions(){
    const list=await editions();
    return targets.flatMap(target=>{const match=list.find(v=>matchesEdition(v,target.abbreviation));return match?[version(match,target.id)]:[];});
  }
  async function passage(id:number,reference:string):Promise<Passage>{
    const providerReference=apiBiblePassageId(reference);
    const selected=await edition(id);
    const result=await request(`/bibles/${selected.id}/passages/${encodeURIComponent(providerReference)}`,passageSchema,new URLSearchParams({"content-type":"text","include-notes":"false","include-titles":"false","include-chapter-numbers":"false","include-verse-numbers":"false"}));
    const returned=appPassageId(result.data.id);
    const expected=reference.split("-");
    const isWholeChapter=reference.split(".").length===2;
    if(result.data.bibleId!==selected.id||!returned||(!isWholeChapter&&returned!==reference)|| (isWholeChapter&&!returned.startsWith(`${reference}.`)))throw new BibleError("API.Bible returned a different or incomplete passage. Please try a shorter reference.");
    if(expected[1]&&result.data.verseCount!==undefined&&result.data.verseCount!==Number(expected[1])-Number(expected[0].split(".")[2])+1)throw new BibleError("API.Bible returned an incomplete passage. Please try again.");
    const content=biblePlainText(result.data.content);
    if(!content)throw new BibleError("This passage has no text in the selected translation.",404);
    return {id:reference,reference:result.data.reference,content,version:version(selected,id,result.data.copyright),fumsToken:result.meta?.fumsToken};
  }
  async function search(id:number,query:string,page=""){
    if(!query.trim()||Array.from(query).length>100||(page&&!/^\d{1,7}$/.test(page)))throw new BibleError("Enter a phrase of 1–100 characters.",400);
    const offset=Number(page||0),selected=await edition(id);
    const result=await request(`/bibles/${selected.id}/search`,searchSchema,new URLSearchParams({query:query.trim(),limit:"10",offset:String(offset),sort:"relevance",fuzziness:"0"}));
    const passages:Passage[]=[];
    for(const item of [...(result.data.verses??[]),...(result.data.passages??[])]){
      const reference=appPassageId(item.id);
      if(item.bibleId!==selected.id||!reference)throw new BibleError("API.Bible returned a search result for a different translation or an unsupported reference.");
      passages.push({id:reference,reference:item.reference,content:biblePlainText("text" in item?item.text:item.content),version:version(selected,id,"copyright" in item?item.copyright:undefined),fumsToken:result.meta?.fumsToken});
    }
    const next=offset+passages.length;
    return {passages,nextPageToken:passages.length&&result.data.total!==undefined&&next<result.data.total?String(next):null,correction:null};
  }
  return {versions,passage,search,idFor:(abbreviation:string)=>targets.find(t=>t.abbreviation===abbreviation.toUpperCase())?.id,handles:(id:number)=>targets.some(t=>t.id===id)};
}
