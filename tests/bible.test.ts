import { test } from "node:test";
import assert from "node:assert/strict";
import { detectReference, validPassageId, extendPassageReference } from "../lib/notes/bible-reference.ts";
import { BibleError, createBibleClient } from "../lib/notes/youversion.ts";

test("recognises references at the caret, abbreviations, and numbered books",()=>{
  assert.deepEqual(detectReference("The message was about John 3:16"),{id:"JHN.3.16",label:"John 3:16"});
  assert.equal(detectReference("Jn 3:16 ")?.id,"JHN.3.16");
  assert.equal(detectReference("1 Cor. 13:4–7")?.id,"1CO.13.4-7");
  assert.equal(detectReference("1John 3:16")?.id,"1JN.3.16");
  assert.equal(detectReference("Let us read Psalm 119:176.")?.id,"PSA.119.176");
  assert.equal(detectReference("Song of Solomon 2:1")?.id,"SNG.2.1");
});
test("does not trigger on ordinary text, unfinished references, or invalid ranges",()=>{
  for(const text of ["John","John 3:","John 0:16","John 22:1","John 3:0","Romans 8:30–28","John 3:16 is wonderful","myJohn 3:16"])
    assert.equal(detectReference(text),null,text);
  assert.equal(validPassageId("../../secrets"),false);
  assert.equal(validPassageId("FAKE.1.1"),false);
  assert.equal(validPassageId("1CO.13.4-7"),true);
  assert.equal(validPassageId("JHN.22.1"),false);
});

test("extends a single verse or existing range without moving its starting verse",()=>{
  assert.deepEqual(extendPassageReference("JHN.3.16"),{id:"JHN.3.16-17",label:"John 3:16–17"});
  assert.deepEqual(extendPassageReference("1CO.13.4-7"),{id:"1CO.13.4-8",label:"1 Corinthians 13:4–8"});
  for(const id of ["JHN.3","PSA.119.176","JHN.22.1","../../secrets"])assert.equal(extendPassageReference(id),null);
});
test("rejects missing key without a network call",async()=>{
  let calls=0;
  const client=createBibleClient("",async()=>{calls++;return Response.json({});});
  await assert.rejects(()=>client.versions(),(e:unknown)=>e instanceof BibleError&&e.status===503);
  assert.equal(calls,0);
});
test("follows authorised catalogue pagination and keeps KJV first",async()=>{
  const calls:string[]=[];
  const client=createBibleClient("test-app-key",async(input,init)=>{
    const url=new URL(String(input));calls.push(url.toString());
    assert.equal((init?.headers as Record<string,string>)["X-YVP-App-Key"],"test-app-key");
    assert.equal(url.searchParams.get("all_available"),null);
    return Response.json(url.searchParams.has("page_token")?{data:[{id:1,abbreviation:"KJV",title:"King James Version"}]}:{data:[{id:3034,abbreviation:"BSB",title:"Berean Standard Bible"}],next_page_token:"page-two"});
  });
  const result=await client.versions();assert.equal(calls.length,2);assert.equal(result[0].abbreviation,"KJV");assert.equal(new URL(calls[1]).searchParams.get("page_token"),"page-two");
});
test("resolves phrase search references into passage text with attribution",async()=>{
  const calls:URL[]=[];
  const client=createBibleClient("test-app-key",async input=>{
    const url=new URL(String(input));calls.push(url);
    if(url.pathname.endsWith("search-verses"))return Response.json({verses:[{reference:"2CO.5.7"}],next_page_token:"more"});
    if(url.pathname.includes("passages"))return Response.json({id:"2CO.5.7",reference:"2 Corinthians 5:7",content:"(For we walk by faith, not by sight:)"});
    return Response.json({id:1,abbreviation:"KJV",title:"King James Version",copyright:"Translation attribution"});
  });
  const result=await client.search(1,"walk by faith");
  assert.equal(calls[0].searchParams.get("user_intent"),"text");assert.equal(calls[0].searchParams.get("bible_id"),"1");
  assert.equal(result.passages[0].version.copyright,"Translation attribution");assert.match(result.passages[0].content,/faith/);assert.equal(result.nextPageToken,"more");
});
test("preserves rate limit retry guidance and does not expose upstream response bodies",async()=>{
  const client=createBibleClient("test-app-key",async()=>new Response("sensitive upstream detail",{status:429,headers:{"Retry-After":"30"}}));
  await assert.rejects(()=>client.versions(),(e:unknown)=>e instanceof BibleError&&e.status===429&&e.retryAfter==="30"&&!e.message.includes("sensitive"));
});
test("does not send malformed searches or passage references upstream",async()=>{
  let calls=0;const client=createBibleClient("test-app-key",async()=>{calls++;return Response.json({});});
  await assert.rejects(()=>client.search(1," "),BibleError);
  await assert.rejects(()=>client.search(1,"x".repeat(101)),BibleError);
  await assert.rejects(()=>client.passage(1,"JHN.999.1"),BibleError);
  await assert.rejects(()=>client.passage(0,"JHN.3.16"),BibleError);
  assert.equal(calls,0);
});
