import { validPassageId } from "./bible-reference.ts";
import type { BibleVersion, Passage } from "./types.ts";
import { z } from "zod";
import { popularVersions } from "./popular-versions.ts";
const versionSchema=z.object({id:z.number().int().positive(),abbreviation:z.string(),title:z.string(),copyright:z.string().nullish().transform(v=>v??undefined),youversion_deep_link:z.string().nullish().transform(v=>v??undefined)});
const catalogueSchema=z.object({data:z.array(versionSchema),next_page_token:z.string().nullish()});
const passageSchema=z.object({id:z.string().optional(),reference:z.string().optional(),content:z.string()});
const searchSchema=z.object({verses:z.array(z.object({reference:z.string()})),next_page_token:z.string().nullish(),search_instead_for:z.string().nullish()});
export class BibleError extends Error {
  status: number; retryAfter?: string;
  constructor(message: string, status = 502, retryAfter?: string) { super(message); this.status=status; this.retryAfter=retryAfter; }
}
const base = "https://api.youversion.com/v1";
export function createBibleClient(key: string, fetcher: typeof fetch = fetch) {
  async function request<S extends z.ZodTypeAny>(path: string, schema:S, params?: URLSearchParams):Promise<z.output<S>|null> {
    if (!key || key.startsWith("your_")) throw new BibleError("Bible lookup is not connected yet. Add your YouVersion app key to enable it.",503);
    const response=await fetcher(`${base}${path}${params?`?${params}`:""}`, { headers: { "X-YVP-App-Key":key, Accept:"application/json" }, signal:AbortSignal.timeout(15000), cache:"no-store" });
    if(!response.ok) {
      if(response.status===403)throw new BibleError("This Bible version or endpoint is not enabled for this app. Enable publisher access in YouVersion or choose an available version.",403);
      const message = response.status===429 ? "Bible lookup is busy. Please try again shortly." : response.status===401 || response.status===403 ? "YouVersion could not authorise this request. Check the app key and translation permissions." : response.status===404 ? "This passage or translation is unavailable. Please check the reference." : "YouVersion is temporarily unavailable. Please try again.";
      throw new BibleError(message,response.status===429?429:response.status===404?404:502,response.headers.get("retry-after")??undefined);
    }
    if(response.status===204) return null;
    const parsed=schema.safeParse(await response.json());
    if(!parsed.success)throw new BibleError("YouVersion returned an unexpected response. Please try again.");
    return parsed.data;
  }
  async function versions(): Promise<BibleVersion[]> {
    const result:BibleVersion[]=[]; let token=""; const seen=new Set<string>();
    do {
      const params=new URLSearchParams({"language_ranges[]":"en",page_size:"99"}); if(token) params.set("page_token",token);
      const data=await request("/bibles",catalogueSchema,params);
      for(const item of data?.data??[]) result.push({id:item.id,abbreviation:item.abbreviation,title:item.title,copyright:item.copyright,youversion_deep_link:item.youversion_deep_link});
      token=data?.next_page_token??"";
      if(token && seen.has(token)) throw new BibleError("YouVersion returned an invalid catalogue page.");
      if(token) seen.add(token);
    } while(token);
    return result.sort((a,b)=>(a.abbreviation==="KJV"?-1:b.abbreviation==="KJV"?1:a.abbreviation.localeCompare(b.abbreviation)));
  }
  async function passage(versionId: number,id:string, metadata?:BibleVersion): Promise<Passage> {
    if(!Number.isSafeInteger(versionId) || versionId<1 || !validPassageId(id)) throw new BibleError("Please enter a valid Bible reference.",400);
    const [data,version]=await Promise.all([request(`/bibles/${versionId}/passages/${encodeURIComponent(id)}`,passageSchema,new URLSearchParams({format:"text"})),metadata?Promise.resolve(metadata):request(`/bibles/${versionId}`,versionSchema)]);
    if(!data?.content || !version?.id) throw new BibleError("This passage is unavailable in the selected translation.",404);
    return {id:data.id??id,reference:data.reference??id,content:data.content,version:{id:version.id,abbreviation:version.abbreviation,title:version.title,copyright:version.copyright,youversion_deep_link:version.youversion_deep_link}};
  }
  async function catalogue() {
    const available = await versions();
    try {
      const params = new URLSearchParams([["language_ranges[]", "en"], ["all_available", "true"], ["page_size", "*"], ["fields[]", "id"], ["fields[]", "abbreviation"], ["fields[]", "title"]]);
      const full = await request("/bibles", catalogueSchema, params);
      return { versions: available, popular: popularVersions(available, full?.data) };
    } catch {
      // A catalogue metadata failure must not hide translations already licensed to this app.
      return { versions: available, popular: popularVersions(available) };
    }
  }
  async function search(versionId:number, query:string, token="") {
    if(!Number.isSafeInteger(versionId)||versionId<1||!query.trim()||Array.from(query).length>100||token.length>2048) throw new BibleError("Enter a phrase of 1–100 characters.",400);
    const params=new URLSearchParams({query:query.trim(),bible_id:String(versionId),user_intent:"text",page_size:"10"}); if(token) params.set("page_token",token);
    const result=await request("/search-verses",searchSchema,params); if(!result) return {passages:[],nextPageToken:null,correction:null};
    const version=await request(`/bibles/${versionId}`,versionSchema);
    if(!version)throw new BibleError("This translation is unavailable.",404);
    const matches=await Promise.all((result.verses??[]).map((v:{reference:string})=>passage(versionId,v.reference,version)));
    return {passages:matches,nextPageToken:result.next_page_token??null,correction:result.search_instead_for?"YouVersion corrected this query. Results may use different wording.":null};
  }
  async function version(id: number): Promise<BibleVersion> {
    if (!Number.isSafeInteger(id) || id < 1) throw new BibleError("This Bible version is unavailable.", 400);
    const result = await request(`/bibles/${id}`, versionSchema);
    if (!result) throw new BibleError("This Bible version is unavailable.", 404);
    return result;
  }
  return {versions,catalogue,version,passage,search};
}
