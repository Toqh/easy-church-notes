import { createBibleClient, BibleError } from "./youversion.ts";
import { createPublicBibleClient } from "./bible-api.ts";
import { popularVersions } from "./popular-versions.ts";
import { createApiBibleClient } from "./api-bible.ts";

export function createBibleService(key: string, fetcher: typeof fetch = fetch, options: {apiBibleKey?:string;apiBibleBaseUrl?:string} = {}) {
  const youversion = createBibleClient(key, fetcher);
  const fallback = createPublicBibleClient(fetcher);
  const apiBible = createApiBibleClient(options.apiBibleKey??"",fetcher,options.apiBibleBaseUrl||undefined);
  async function catalogue() {
    const [primary, secondary, api] = await Promise.allSettled([youversion.catalogue(), fallback.versions(),options.apiBibleKey?apiBible.versions():Promise.resolve([])]);
    const licensed = primary.status === "fulfilled" ? primary.value.versions : [];
    const extras = [...(api.status === "fulfilled"?api.value:[]),...(secondary.status === "fulfilled" ? secondary.value : [])];
    const versions = [...licensed, ...extras.filter(v => !licensed.some(item => item.abbreviation.toUpperCase() === v.abbreviation))]
      .sort((a,b) => a.abbreviation === "KJV" ? -1 : b.abbreviation === "KJV" ? 1 : a.abbreviation.localeCompare(b.abbreviation));
    if (!versions.length) throw primary.status === "rejected" ? primary.reason : new BibleError("No Bible versions could be loaded. Please try again.", 503);
    const available = popularVersions(versions);
    return { versions, popular: available.map(v => v.status === "available" ? v : primary.status === "fulfilled" ? primary.value.popular.find(item => item.abbreviation === v.abbreviation) ?? v : v),warnings:api.status==="rejected"&&options.apiBibleKey?[api.reason instanceof BibleError?api.reason.message:"API.Bible could not connect. Its translations will appear when the connection is restored."]:[] };
  }
  async function passage(version: number, reference: string) {
    if(apiBible.handles(version))return apiBible.passage(version,reference);
    if (version < 0) return fallback.passage(version, reference);
    try { return await youversion.passage(version, reference); }
    catch (error) {
      // Only fall back to the identical translation, never substitute a different Bible.
      if (!(error instanceof BibleError) || ![403,404].includes(error.status)) throw error;
      const metadata = await youversion.version(version);
      const apiVersion=apiBible.idFor(metadata.abbreviation);
      if(apiVersion&&options.apiBibleKey){
        const result=await apiBible.passage(apiVersion,reference);
        return {...result,version:{...result.version,id:version}};
      }
      const substitute = fallback.idFor(metadata.abbreviation);
      if (!substitute) throw error;
      const result = await fallback.passage(substitute, reference);
      return { ...result, version: { ...result.version, id: version } };
    }
  }
  async function search(version: number, query: string, token = "") {
    if(apiBible.handles(version))return apiBible.search(version,query,token);
    if(version>=0&&token.startsWith("api:")){
      const metadata=await youversion.version(version),apiVersion=apiBible.idFor(metadata.abbreviation);
      if(!apiVersion||!options.apiBibleKey)throw new BibleError("This search page is unavailable. Please search again.",400);
      const result=await apiBible.search(apiVersion,query,token.slice(4));
      return {...result,passages:result.passages.map(p=>({...p,version:{...p.version,id:version}})),nextPageToken:result.nextPageToken?`api:${result.nextPageToken}`:null};
    }
    if (version >= 0) {
      try{return await youversion.search(version, query, token);}
      catch(error){
        if(!(error instanceof BibleError)||![403,404].includes(error.status)||!options.apiBibleKey||token)throw error;
        const metadata=await youversion.version(version),apiVersion=apiBible.idFor(metadata.abbreviation);
        if(!apiVersion)throw error;
        const result=await apiBible.search(apiVersion,query);
        return {...result,passages:result.passages.map(p=>({...p,version:{...p.version,id:version}})),nextPageToken:result.nextPageToken?`api:${result.nextPageToken}`:null};
      }
    }
    const selected = (await fallback.versions()).find(v => v.id === version);
    if (!selected) throw new BibleError("This Bible version is unavailable.", 400);
    const licensed = await youversion.versions().catch(() => []);
    const match = licensed.find(v => v.abbreviation.toUpperCase() === selected.abbreviation);
    if (!match) throw new BibleError("Phrase search is unavailable for this version. Enter a passage reference or choose a version with phrase search.", 503);
    const result = await youversion.search(match.id, query, token);
    return { ...result, passages: result.passages.map(p => ({ ...p, version: { ...p.version, id: version } })) };
  }
  return { catalogue, passage, search };
}
