import { test } from "node:test";
import assert from "node:assert/strict";
import { createBibleClient } from "../lib/notes/youversion.ts";
import { popularVersions } from "../lib/notes/popular-versions.ts";

test("popular translations distinguish licensed, unlicensed, and unlisted versions",()=>{
  const kjv={id:1,abbreviation:"KJV",title:"King James Version"};
  const niv={id:111,abbreviation:"NIV",title:"New International Version"};
  const entries=popularVersions([kjv],[kjv,niv]);
  assert.equal(entries.find(v=>v.abbreviation==="KJV")?.status,"available");
  assert.equal(entries.find(v=>v.abbreviation==="NIV")?.status,"needs_access");
  assert.equal(entries.find(v=>v.abbreviation==="TPT")?.status,"not_listed");
  assert.equal(popularVersions([kjv]).find(v=>v.abbreviation==="TPT")?.status,"unavailable");
});
test("catalogue checks metadata without treating unlicensed translations as usable",async()=>{
  const client=createBibleClient("test-key",async input=>{
    const url=new URL(String(input));
    if(url.searchParams.get("all_available")==="true"){
      assert.deepEqual(url.searchParams.getAll("fields[]"),["id","abbreviation","title"]);
      return Response.json({data:[{id:1,abbreviation:"KJV",title:"King James Version"},{id:111,abbreviation:"NIV",title:"New International Version"}]});
    }
    return Response.json({data:[{id:1,abbreviation:"KJV",title:"King James Version"}]});
  });
  const result=await client.catalogue();
  assert.deepEqual(result.versions.map(v=>v.abbreviation),["KJV"]);
  assert.equal(result.popular.find(v=>v.abbreviation==="NIV")?.status,"needs_access");
});
test("metadata failures leave already licensed translations available",async()=>{
  const client=createBibleClient("test-key",async input=>new URL(String(input)).searchParams.has("all_available")?new Response(null,{status:503}):Response.json({data:[{id:1,abbreviation:"KJV",title:"King James Version"}]}));
  const result=await client.catalogue();
  assert.equal(result.versions[0].abbreviation,"KJV");
  assert.equal(result.popular.find(v=>v.abbreviation==="NIV")?.status,"unavailable");
});
