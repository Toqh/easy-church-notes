import {test} from "node:test";
import assert from "node:assert/strict";
import {createApiBibleClient,apiBiblePassageId,apiBibleBaseUrl} from "../lib/notes/api-bible.ts";
import {createBibleService} from "../lib/notes/bible-service.ts";
import {passageContent} from "../lib/notes/passage-content.ts";
import {BibleError} from "../lib/notes/youversion.ts";

const editions=[
  {id:"niv-fixture-01",abbreviation:"NIV",name:"New International Version",language:{id:"eng"},copyright:"NIV publisher notice",info:"Publisher information"},
  {id:"nlt-fixture-01",abbreviation:"NLT",name:"New Living Translation",language:{id:"eng"},copyright:"NLT publisher notice"},
  {id:"amp-fixture-01",abbreviation:"AMP",name:"Amplified Bible",language:{id:"eng"},copyright:"AMP publisher notice"},
];
function providerResponse(url:URL){
  if(url.pathname==="/v1/bibles")return Response.json({data:editions});
  const selected=editions.find(v=>url.pathname.includes(`/${v.id}/`))!;
  if(url.pathname.endsWith("/search"))return Response.json({data:{total:2,limit:1,offset:Number(url.searchParams.get("offset")??0),verses:[{id:"JHN.3.16",bibleId:selected.id,reference:"John 3:16",text:`${selected.abbreviation} matching text.`}]},meta:{fumsToken:"search-view-token"}});
  const id=decodeURIComponent(url.pathname.split("/").at(-1)!);
  return Response.json({data:{id,bibleId:selected.id,reference:"John 3:16–17",content:`${selected.abbreviation} verse text.`,verseCount:id.includes("-")?2:1,copyright:selected.copyright},meta:{fumsToken:"passage-view-token"}});
}
test("API.Bible discovers accessible NIV/NLT/AMP IDs and never enables a different translation",async()=>{
  const client=createApiBibleClient("test-key",async(input,init)=>{
    const url=new URL(String(input));assert.equal(url.hostname,"rest.api.bible");assert.equal(new Headers(init?.headers).get("api-key"),"test-key");
    assert.equal(url.searchParams.get("include-full-details"),"true");
    return Response.json({data:[...editions.filter(v=>v.abbreviation!=="AMP"),{id:"classic-fixture-01",abbreviation:"AMPC",abbreviationLocal:"AMP",name:"Amplified Classic",language:{id:"eng"}},{id:"foreign-fixture-01",abbreviation:"AMP",name:"Foreign translation",language:{id:"spa"}}]});
  });
  assert.deepEqual((await client.versions()).map(v=>[v.id,v.abbreviation]),[[-101,"NIV"],[-102,"NLT"]]);
  await assert.rejects(()=>client.passage(-103,"JHN.3.16"),/AMP is not enabled/);
});
test("API.Bible expands range IDs, retains copyright and reporting tokens, and inserts no YouVersion label",async()=>{
  const client=createApiBibleClient("test-key",async input=>{const url=new URL(String(input));if(url.pathname.includes("/passages/")){assert.equal(url.pathname.split("/").at(-1),"JHN.3.16-JHN.3.17");assert.equal(url.searchParams.get("content-type"),"text");assert.equal(url.searchParams.get("include-verse-numbers"),"false");}return providerResponse(url);});
  const result=await client.passage(-101,"JHN.3.16-17");
  assert.equal(result.id,"JHN.3.16-17");assert.equal(result.version.provider,"api.bible");assert.equal(result.fumsToken,"passage-view-token");
  const content=passageContent([result]);assert.equal(content[0].attrs?.apiBibleToken,"passage-view-token");
  assert.match(JSON.stringify(content),/NIV publisher notice/);assert.match(JSON.stringify(content),/https:\/\/api.bible/);assert.doesNotMatch(JSON.stringify(content),/YouVersion/);
});
test("API.Bible search paginates without a passage fetch for every result",async()=>{
  const calls:URL[]=[];const client=createApiBibleClient("test-key",async input=>{const url=new URL(String(input));calls.push(url);return providerResponse(url);});
  const first=await client.search(-102,"love");assert.equal(first.nextPageToken,"1");assert.equal(first.passages[0].version.abbreviation,"NLT");assert.equal(first.passages[0].fumsToken,"search-view-token");
  const second=await client.search(-102,"love",first.nextPageToken!);assert.equal(second.nextPageToken,null);
  assert.equal(calls.length,3);assert.equal(calls[2].searchParams.get("offset"),"1");assert.equal(calls[1].searchParams.get("fuzziness"),"0");
});
test("API.Bible rejects invalid endpoints, references and pagination before sending a key",async()=>{
  let calls=0;const client=createApiBibleClient("test-key",async()=>{calls++;return Response.json({});});
  assert.equal(apiBibleBaseUrl("https://rest.api.bible"),"https://rest.api.bible/v1");
  for(const url of ["http://rest.api.bible","https://example.com/v1","https://rest.api.bible/redirect","https://user@rest.api.bible/v1"])assert.throws(()=>apiBibleBaseUrl(url));
  assert.equal(apiBiblePassageId("ROM.8.28-30"),"ROM.8.28-ROM.8.30");
  await assert.rejects(()=>client.passage(-101,"../../secrets"));await assert.rejects(()=>client.search(-101,"love","api:10"));await assert.rejects(()=>client.search(-101,"x".repeat(101)));
  const invalid=createApiBibleClient("test-key",async()=>{calls++;return Response.json({});},"https://example.com");await assert.rejects(()=>invalid.versions());assert.equal(calls,0);
});
test("API.Bible reports permission and quota errors without exposing the response body",async()=>{
  for(const status of [401,403,429]){
    const client=createApiBibleClient("test-key",async()=>new Response("sensitive upstream details",{status,headers:{"Retry-After":"60"}}));
    await assert.rejects(()=>client.versions(),(error:unknown)=>error instanceof BibleError&&error.status===status&&error.retryAfter==="60"&&!error.message.includes("sensitive"));
  }
});
test("API.Bible rejects mismatched translations and truncated requested ranges",async()=>{
  for(const mismatch of ["translation","range"]){
    const client=createApiBibleClient("test-key",async input=>{const url=new URL(String(input));return url.pathname.endsWith("/bibles")?providerResponse(url):Response.json({data:{id:mismatch==="range"?"JHN.3.16":"JHN.3.16-JHN.3.17",bibleId:mismatch==="translation"?"nlt-fixture-01":"niv-fixture-01",reference:"John 3:16",content:"Content from an unexpected response.",verseCount:1}});});
    await assert.rejects(()=>client.passage(-101,"JHN.3.16-17"),/different or incomplete/);
  }
});
test("the combined catalogue adds licensed API.Bible fallbacks while preferring existing YouVersion versions",async()=>{
  const service=createBibleService("yv-key",async(input,init)=>{
    const url=new URL(String(input));
    if(url.hostname==="rest.api.bible"){assert.equal(new Headers(init?.headers).get("api-key"),"api-key");return providerResponse(url);}
    assert.equal(new Headers(init?.headers).has("api-key"),false);
    if(url.hostname==="cdn.jsdelivr.net")return new Response(null,{status:503});
    return Response.json({data:[{id:1,abbreviation:"KJV",title:"King James Version"},{id:111,abbreviation:"NIV",title:"New International Version"}]});
  },{apiBibleKey:"api-key"});
  const result=await service.catalogue();
  assert.equal(result.versions.filter(v=>v.abbreviation==="NIV").length,1);assert.equal(result.versions.find(v=>v.abbreviation==="NIV")?.id,111);assert.equal(result.versions.find(v=>v.abbreviation==="NLT")?.id,-102);assert.equal(result.popular.find(v=>v.abbreviation==="AMP")?.status,"available");
});
test("YouVersion permission failures fall back to the identical API.Bible version, including search pagination",async()=>{
  const service=createBibleService("yv-key",async input=>{
    const url=new URL(String(input));if(url.hostname==="rest.api.bible")return providerResponse(url);
    if(url.pathname==="/v1/bibles/111")return Response.json({id:111,abbreviation:"NIV",title:"New International Version"});
    return new Response(null,{status:403});
  },{apiBibleKey:"api-key"});
  const result=await service.passage(111,"JHN.3.16");assert.equal(result.version.provider,"api.bible");assert.equal(result.version.id,111);
  const first=await service.search(111,"love");assert.equal(first.nextPageToken,"api:1");assert.equal(first.passages[0].version.id,111);
  const second=await service.search(111,"love",first.nextPageToken!);assert.equal(second.nextPageToken,null);assert.equal(second.passages[0].version.abbreviation,"NIV");
});
