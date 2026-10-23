import { test, expect } from "@playwright/test";

const versions=[{id:1,abbreviation:"KJV",title:"King James Version"},{id:2,abbreviation:"ASV",title:"American Standard Version"},{id:111,abbreviation:"NIV",title:"New International Version"},{id:116,abbreviation:"NLT",title:"New Living Translation"}];
const passages:Record<string,{reference:string;content:string}>={
  "JHN.3.16":{reference:"John 3:16",content:"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."},
  "JHN.3.16-17":{reference:"John 3:16–17",content:"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.\nFor God sent not his Son into the world to condemn the world; but that the world through him might be saved."},
  "JHN.3.16-18":{reference:"John 3:16–18",content:"For God so loved the world.\nFor God sent not his Son into the world to condemn the world.\nHe that believeth on him is not condemned."},
  "ROM.8.28":{reference:"Romans 8:28",content:"And we know that all things work together for good to them that love God, to them who are the called according to his purpose."},
  "ROM.8.28-30":{reference:"Romans 8:28–30",content:"And we know that all things work together for good to them that love God, to them who are the called according to his purpose.\nFor whom he did foreknow, he also did predestinate to be conformed to the image of his Son, that he might be the firstborn among many brethren.\nMoreover whom he did predestinate, them he also called: and whom he called, them he also justified: and whom he justified, them he also glorified."},
};
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("easychurchnotes:started","1"));
  await page.route("**/api/config",route=>route.fulfill({json:{authConfigured:false,bibleConfigured:true,supabaseUrl:"",supabaseKey:""}}));
  await page.route("**/api/bible?**",route=>{
    const params=new URL(route.request().url()).searchParams;
    if(params.get("action")==="versions")return route.fulfill({json:{versions}});
    const version=versions.find(v=>v.id===Number(params.get("version")))??versions[0];
    const id=params.get("reference")??"JHN.3.16";
    const passage={id,...(passages[id]??{reference:id,content:"A matching passage."}),version:{...version,copyright:"Test attribution"}};
    return route.fulfill({json:params.get("action")==="search"?{passages:[passage],nextPageToken:null}:passage});
  });
});
const modal=(page:import("@playwright/test").Page)=>page.getByRole("dialog",{name:"Bible passages"});

test("writes metadata and rich text, preserves it after reload, and restores deleted notes",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");await page.getByRole("button",{name:/Walking by faith/}).click();
  await page.getByRole("button",{name:/^New note/}).click();
  await page.getByLabel("Note topic").fill("Sunday reflections");await page.getByLabel("Preacher",{exact:true}).fill("Pastor James");
  await page.getByLabel("Add a tag",{exact:true}).fill("Hope");await page.getByLabel("Add a tag",{exact:true}).press("Enter");
  await page.getByRole("textbox",{name:"Note content"}).fill("A thought to carry into the week.");
  await page.reload();await page.getByRole("button",{name:/Sunday reflections/}).click();
  await expect(page.getByLabel("Preacher",{exact:true})).toHaveValue("Pastor James");await expect(page.getByRole("textbox",{name:"Note content"})).toContainText("A thought to carry");
  await page.getByLabel("Note actions").click();await page.getByRole("button",{name:"Move to Recently deleted"}).click();
  await page.getByRole("button",{name:/Recently deleted/}).click();await expect(page.getByLabel("Note topic")).toHaveValue("Sunday reflections");
  await page.getByRole("button",{name:"Restore note",exact:true}).click();await page.getByRole("button",{name:/All notes/}).click();await expect(page.getByRole("button",{name:/Sunday reflections/})).toBeVisible();
  expect(errors).toEqual([]);
});

for(const focus of [false,true])test(`Enter opens a full passage modal and inserts in ${focus?"focus":"normal"} mode`,async({page})=>{
  await page.goto("/");await expect(page.getByLabel("Bible version",{exact:true})).toHaveValue("1");
  if(focus)await page.getByLabel("Enter focus mode").click();
  const content=page.getByRole("textbox",{name:"Note content"});
  await content.fill("Romans 8:28-30");await content.press("Enter");
  const dialog=modal(page);await expect(dialog).toBeVisible();
  await expect(dialog.getByText("SCRIPTURE FOR YOUR NOTES",{exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("heading")).toHaveCount(0);
  await expect(dialog.getByLabel("Bible reference or text",{exact:true})).toHaveCount(0);
  await expect(dialog.locator(".verse-preview-text")).toHaveText(passages["ROM.8.28-30"].content);
  expect(await dialog.evaluate(e=>e.matches(":modal"))).toBe(true);
  expect(await dialog.evaluate(e=>getComputedStyle(e,"::backdrop").backdropFilter)).toContain("blur");
  await dialog.getByRole("button",{name:/^Insert into note/}).click();
  await expect(dialog).toHaveCount(0);await expect(content.locator("blockquote")).toContainText("Romans 8:28–30");
  await expect(content).toBeFocused();await expect(page.getByText(/Open an active note/)).toHaveCount(0);
});

test("a reference can be adjusted, invalid edits cannot insert stale text, and the version can change",async({page})=>{
  await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await expect(page.getByLabel("Bible version",{exact:true})).toHaveValue("1");
  await content.fill("John 3:16");await content.press("Space");
  const dialog=modal(page);await expect(dialog.locator(".verse-preview-text")).toContainText("For God so loved");
  await dialog.getByLabel("Reference 1",{exact:true}).fill("Romans 8:28");
  await expect(dialog.getByRole("button",{name:/^Insert into note/})).toBeDisabled();
  await dialog.getByLabel("Reference 1",{exact:true}).press("Enter");
  await expect(dialog.locator(".verse-preview-text")).toHaveText(passages["ROM.8.28"].content);
  await dialog.getByLabel("Passage Bible version").selectOption("111");
  await expect(dialog.locator(".passage-preview-label")).toContainText("NIV");
  await dialog.getByRole("button",{name:/^Insert into note/}).click();
  await expect(content.locator("blockquote")).toContainText("Romans 8:28");await expect(content.locator("blockquote")).toContainText("NIV");await expect(content.locator("blockquote")).not.toContainText("John 3:16");
});

test("more verses can be added and inserted together at the saved caret",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:/A quieter heart/}).click();
  const content=page.getByRole("textbox",{name:"Note content"});await content.fill("Before the verses.\nAfter the verses.");
  await content.locator("p").first().click();await content.press("End");
  const search=page.getByLabel("Search Bible reference or text");await search.fill("John 3:16");await search.press("Enter");
  const dialog=modal(page);await expect(dialog.locator(".verse-preview-text")).toContainText("For God so loved");
  await dialog.getByRole("button",{name:"Add another passage"}).click();
  await expect(dialog.getByLabel("Bible reference or text",{exact:true})).toBeFocused();
  await dialog.getByLabel("Bible reference or text",{exact:true}).fill("Romans 8:28");await dialog.getByLabel("Bible reference or text",{exact:true}).press("Enter");
  await expect(dialog.locator(".passage-draft")).toHaveCount(2);await expect(dialog.getByRole("button",{name:/^Insert into note/})).toBeEnabled();
  await expect(dialog.getByLabel("Bible reference or text",{exact:true})).toHaveCount(0);
  await dialog.getByRole("button",{name:/^Insert into note/}).click();await expect(content.locator("blockquote")).toHaveCount(2);
  const text=await content.innerText();expect(text.indexOf("John 3:16")).toBeLessThan(text.indexOf("After the verses."));
  await page.getByLabel("Undo",{exact:true}).click();await expect(content.locator("blockquote")).toHaveCount(0);
});

test("Cancel, outside click, and Escape dismiss without inserting",async({page})=>{
  await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await content.fill("Keep this reflection.");
  for(const action of ["button","outside","escape"]){
    const search=page.getByLabel("Search Bible reference or text");await search.fill("John 3:16");await search.press("Enter");
    const dialog=modal(page);await expect(dialog.locator(".verse-preview-text")).toContainText("For God so loved");
    if(action==="button")await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
    else if(action==="outside")await page.mouse.click(4,4);
    else await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);await expect(content.locator("blockquote")).toHaveCount(0);await expect(content).toHaveText("Keep this reflection.");
  }
});

test("top-right phrase search selects results and creates a note when none is open",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("easychurchnotes:v1:guest","[]"));
  await page.goto("/");await expect(page.getByRole("button",{name:"Write a new note"})).toBeEnabled();
  const search=page.getByLabel("Search Bible reference or text");await search.fill("God so loved");await search.press("Enter");
  const dialog=modal(page);await expect(dialog.getByLabel("Bible search results")).toContainText("John 3:16");
  await dialog.getByRole("button",{name:"Add to selection"}).click();await dialog.getByRole("button",{name:/^Insert into note/}).click();
  await expect(page.getByRole("textbox",{name:"Note content"}).locator("blockquote")).toContainText("John 3:16");
  await expect(page.getByText(/Open an active note/)).toHaveCount(0);
});

test("mobile modal and editor remain usable at 320px",async({page})=>{
  await page.setViewportSize({width:320,height:844});await page.goto("/");await page.getByRole("button",{name:/Walking by faith/}).click();
  await page.getByRole("button",{name:"Find Bible passage"}).click();
  const search=modal(page).getByLabel("Bible reference or text",{exact:true});await search.fill("John 3:16");await search.press("Enter");
  await expect(modal(page).locator(".verse-preview-text")).toContainText("For God so loved");
  const fits=await modal(page).evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth;});expect(fits).toBe(true);
  await modal(page).getByRole("button",{name:/^Insert into note/}).click();
  await expect(page.getByRole("textbox",{name:"Note content"}).locator("blockquote")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test("Add next verse extends one passage repeatedly and keeps its range when changing versions",async({page})=>{
  await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await content.fill("John 3:16");await content.press("Enter");
  const dialog=modal(page);await expect(dialog.locator(".verse-preview-text")).toHaveText(passages["JHN.3.16"].content);
  await dialog.getByRole("button",{name:"Add next verse",exact:true}).click();
  await expect(dialog.getByLabel("Reference 1",{exact:true})).toHaveValue("John 3:16–17");
  await expect(dialog.locator(".verse-preview-text")).toHaveText(passages["JHN.3.16-17"].content);await expect(dialog.locator(".passage-draft")).toHaveCount(1);
  await dialog.getByRole("button",{name:"Add next verse",exact:true}).click();
  await expect(dialog.getByLabel("Reference 1",{exact:true})).toHaveValue("John 3:16–18");
  await dialog.getByLabel("Passage Bible version").selectOption("111");
  await expect(dialog.locator(".passage-preview-label")).toContainText("NIV");
  await dialog.getByRole("button",{name:/^Insert into note/}).click();
  await expect(content.locator("blockquote")).toHaveCount(1);await expect(content.locator("blockquote")).toContainText("John 3:16–18");await expect(content.locator("blockquote")).toContainText("He that believeth on him is not condemned.");
});

test("a next-verse lookup failure preserves the current verse and it can still be inserted",async({page})=>{
  await page.route("**/api/bible?**",async route=>{
    const params=new URL(route.request().url()).searchParams;
    if(params.get("reference")==="JHN.3.16-17")return route.fulfill({status:404,json:{error:"The next verse could not be loaded."}});
    return route.fallback();
  });
  await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await content.fill("John 3:16");await content.press("Enter");
  const dialog=modal(page);await dialog.getByRole("button",{name:"Add next verse",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("The next verse could not be loaded.");await expect(dialog.locator(".verse-preview-text")).toHaveText(passages["JHN.3.16"].content);
  await expect(dialog.getByLabel("Reference 1",{exact:true})).toHaveValue("John 3:16");await dialog.getByRole("button",{name:/^Insert into note/}).click();
  await expect(content.locator("blockquote")).toContainText(passages["JHN.3.16"].content);
});

test("the mobile editor gives writing priority while details, formatting and view controls remain accessible",async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:700});await page.goto("/");await page.getByRole("button",{name:/Walking by faith/}).click();
  const content=page.getByRole("textbox",{name:"Note content"});await content.fill("A quieter space for my thoughts.");
  expect((await page.locator(".editor-ribbon").boundingBox())!.height).toBeLessThanOrEqual(72);
  expect((await content.boundingBox())!.y).toBeLessThan(350);
  await expect(page.getByLabel("Preacher",{exact:true})).toBeHidden();await expect(page.getByLabel("Bold",{exact:true})).toBeHidden();
  await expect(page.locator(".editor-footer")).not.toContainText("Saved on this device");await expect(page.locator(".list-footer")).not.toContainText("Notes saved on this device");
  await page.screenshot({path:testInfo.outputPath("mobile-note.png"),fullPage:true});
  await page.getByRole("button",{name:"Note details",exact:true}).click();await page.getByLabel("Preacher",{exact:true}).fill("Pastor Ada");
  await page.getByRole("button",{name:"Note details",exact:true}).click();
  await content.click();await content.press("ControlOrMeta+a");await page.getByLabel("Formatting options",{exact:true}).click();await page.getByLabel("Bold",{exact:true}).click();
  await expect(content.locator("strong")).toContainText("A quieter space for my thoughts.");
  await page.getByLabel("Formatting options",{exact:true}).click();
  await page.getByLabel("Note actions",{exact:true}).click();await page.locator(".more-menu").getByRole("button",{name:"Enable dark mode",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.getByLabel("Note actions",{exact:true}).click();await page.locator(".more-menu").getByRole("button",{name:"Enter focus mode",exact:true}).click();
  await expect(page.locator(".app-shell")).toHaveClass(/focus-mode/);await expect(content).toContainText("A quieter space for my thoughts.");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test("personal notes hide preacher and dark mode persists",async({page})=>{
  await page.goto("/");await page.getByLabel("Preacher",{exact:true}).fill("Pastor Ada");await page.getByLabel("Note collection",{exact:true}).selectOption("personal");
  await expect(page.getByLabel("Preacher",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Add a tag",{exact:true})).toBeVisible();
  await page.getByLabel("Note collection",{exact:true}).selectOption("sermon");await expect(page.getByLabel("Preacher",{exact:true})).toHaveValue("Pastor Ada");
  await page.getByLabel("Enable dark mode").click();await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
});

test("editable space below the last paragraph accepts another paragraph in normal mode",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await content.fill("First thought.");
  const coordinates=await content.evaluate(element=>{const last=element.lastElementChild!.getBoundingClientRect(),surface=element.getBoundingClientRect();return{x:surface.left+24,y:last.bottom+72};});
  await page.mouse.click(coordinates.x,coordinates.y);await page.keyboard.type("Next thought in the space below.");
  await expect(content.locator("p").last()).toHaveText("Next thought in the space below.");await expect(content.locator("p").first()).toHaveText("First thought.");
  expect(await page.locator(".note-scroll").evaluate(e=>e.scrollHeight-e.clientHeight)).toBeGreaterThan(200);
  await page.getByLabel("Enter focus mode").click();await expect(page.getByRole("region",{name:"Notes list"})).toBeHidden();
  const scroll=page.locator(".note-scroll");await scroll.hover();await page.mouse.wheel(0,600);await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
  await page.getByLabel("Exit focus mode").click();await expect(content).toContainText("Next thought in the space below.");
});

test("the main sidebar minimizes independently and both sidebars scroll",async({page})=>{
  await page.setViewportSize({width:1440,height:600});
  await page.addInitScript(()=>{const now=new Date().toISOString();localStorage.setItem("easychurchnotes:v1:guest",JSON.stringify(Array.from({length:35},(_,i)=>({id:crypto.randomUUID(),topic:`Reflection ${i}`,preacher:"",tags:[`Study tag ${i}`],kind:"personal",content:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"A short reflection."}]}]},plain_text:"A short reflection.",pinned:false,deleted_at:null,created_at:now,updated_at:now}))));});
  await page.goto("/");await expect(page.getByLabel("Note topic")).toBeVisible();
  await page.getByLabel("Minimize sidebar",{exact:true}).click();expect(await page.locator(".sidebar").evaluate(e=>e.getBoundingClientRect().width)).toBeLessThan(80);
  await expect(page.getByRole("region",{name:"Notes list"})).toBeVisible();await page.getByLabel("Expand sidebar",{exact:true}).click();
  const sidebar=page.locator(".sidebar");await sidebar.hover();await page.mouse.wheel(0,600);await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  const list=page.locator(".note-list");await list.hover();await page.mouse.wheel(0,600);await expect.poll(()=>list.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator(".note-scroll").evaluate(e=>e.scrollTop)).toBe(0);
});

test("popular versions are grouped and unavailable ones are labelled honestly",async({page})=>{
  await page.goto("/");const selector=page.getByLabel("Bible version",{exact:true});await expect(selector).toHaveValue("1");
  await expect(selector.locator('optgroup[label="Popular versions"]')).toContainText("KJV");await expect(selector).toContainText("NIV");await expect(selector).toContainText("NLT");
  await expect(selector.locator('option[value="unavailable-TPT"]')).toHaveAttribute("disabled", "");await selector.selectOption("116");
  const search=page.getByLabel("Search Bible reference or text");await search.fill("John 3:16");await search.press("Enter");
  await expect(modal(page).locator(".passage-preview-label")).toContainText("NLT");
});

test("public fallback versions insert into the note without a retrieval label",async({page})=>{
  const fallback={id:-1,abbreviation:"KJV",title:"King James Version",provider:"bible-api"};
  await page.route("**/api/bible?**",route=>{
    const params=new URL(route.request().url()).searchParams;
    return route.fulfill({json:params.get("action")==="versions"?{versions:[fallback]}:{id:"JHN.3.16",...passages["JHN.3.16"],version:fallback}});
  });
  await page.goto("/");await expect(page.getByLabel("Bible version",{exact:true})).toHaveValue("-1");
  await page.getByLabel("Search Bible reference or text").fill("John 3:16");await page.getByLabel("Search Bible reference or text").press("Enter");
  await expect(modal(page).locator(".verse-preview-text")).toContainText("For God so loved");
  await expect(modal(page).locator(".attribution")).toHaveCount(0);
  await modal(page).getByRole("button",{name:/^Insert into note/}).click();
  const quote=page.locator(".writing-surface blockquote");await expect(quote).toContainText("John 3:16");
  await expect(quote).not.toContainText("YouVersion");await expect(quote.locator("a")).toHaveCount(0);
});

test("the mobile navigation drawer and long main notes scroll without moving the page",async({page})=>{
  await page.setViewportSize({width:390,height:700});await page.goto("/");
  await expect(page.getByRole("button",{name:/Walking by faith/})).toBeVisible();
  await page.getByLabel("Open navigation",{exact:true}).click();
  const sidebar=page.locator(".sidebar");await expect(sidebar).toBeVisible();await sidebar.hover();await page.mouse.wheel(0,500);
  await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await page.getByLabel("Close navigation",{exact:true}).click();
  await page.getByRole("button",{name:/Walking by faith/}).click();
  const area=page.locator(".note-scroll");await area.hover();await page.mouse.wheel(0,400);
  await expect.poll(()=>area.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});

for(const width of [1440,900])test(`Your Notebook can minimize and restore at ${width}px without remounting the editor`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto("/");
  const content=page.getByRole("textbox",{name:"Note content"});await content.fill("Keep my place while the notebook is hidden.");
  await content.evaluate(element=>element.setAttribute("data-editor-check","same-editor"));
  const initialWidth=await page.locator(".editor-column").evaluate(e=>e.clientWidth);
  await page.getByLabel("Minimize notebook",{exact:true}).click();
  await expect(page.getByRole("region",{name:"Notes list"})).toBeHidden();
  await expect(content).toHaveAttribute("data-editor-check","same-editor");await expect(content).toContainText("Keep my place");
  expect(await page.locator(".editor-column").evaluate(e=>e.clientWidth)).toBeGreaterThan(initialWidth+200);
  await expect(page.getByLabel("Show notebook",{exact:true})).toBeVisible();
  await page.getByLabel("Enter focus mode").click();await page.getByLabel("Exit focus mode").click();
  await expect(page.getByRole("region",{name:"Notes list"})).toBeHidden();
  if(width===1440){await expect(page.locator(".sidebar")).toBeVisible();await page.getByLabel("Minimize sidebar",{exact:true}).click();}
  await page.getByLabel("Show notebook",{exact:true}).click();
  await expect(page.getByRole("region",{name:"Notes list"})).toBeVisible();await expect(content).toHaveAttribute("data-editor-check","same-editor");
  if(width===1440)await expect(page.getByLabel("Expand sidebar",{exact:true})).toBeVisible();
});

test("API.Bible versions insert with correct credits and report anonymous Scripture views after reload",async({page})=>{
  const providerVersions=[{id:-101,abbreviation:"NIV",title:"New International Version",provider:"api.bible",copyright:"Fixture NIV publisher copyright"},{id:-102,abbreviation:"NLT",title:"New Living Translation",provider:"api.bible",copyright:"Fixture NLT publisher copyright"},{id:-103,abbreviation:"AMP",title:"Amplified Bible",provider:"api.bible",copyright:"Fixture AMP publisher copyright"}];
  const reports:URL[]=[];
  await page.route("https://fums.api.bible/**",route=>{reports.push(new URL(route.request().url()));return route.fulfill({status:200,body:""});});
  await page.route("**/api/bible?**",route=>{
    const params=new URL(route.request().url()).searchParams;
    if(params.get("action")==="versions")return route.fulfill({json:{versions:[versions[0],...providerVersions]}});
    const version=providerVersions.find(v=>v.id===Number(params.get("version")))!;
    return route.fulfill({json:{id:"JHN.3.16",reference:"John 3:16",content:`Fixture ${version.abbreviation} verse text.`,version,fumsToken:"fixture-scripture-view"}});
  });
  await page.goto("/");await expect(page.getByLabel("Bible version",{exact:true})).toHaveValue("1");
  for(const version of providerVersions)await expect(page.getByLabel("Bible version",{exact:true}).locator(`option[value="${version.id}"]`)).not.toHaveAttribute("disabled");
  await page.getByLabel("Bible version",{exact:true}).selectOption("-102");
  const content=page.getByRole("textbox",{name:"Note content"});await content.fill("PRIVATE REFLECTION\nJohn 3:16");await content.press("Enter");
  const dialog=modal(page);await expect(dialog.locator(".verse-preview-text")).toContainText("Fixture NLT verse text");
  await expect(dialog.locator(".attribution")).toContainText("Fixture NLT publisher copyright");await expect(dialog.locator(".attribution a")).toHaveAttribute("href","https://api.bible");
  await expect.poll(()=>reports.length).toBeGreaterThan(0);
  await dialog.getByRole("button",{name:/^Insert into note/}).click();
  const quote=content.locator("blockquote");await expect(quote).toHaveAttribute("data-api-bible-token","fixture-scripture-view");
  await expect(quote).toContainText("Fixture NLT publisher copyright");await expect(quote).not.toContainText("YouVersion");
  const previousReports=reports.length;await page.reload();
  await expect(page.getByRole("textbox",{name:"Note content"}).locator("blockquote")).toHaveAttribute("data-api-bible-token","fixture-scripture-view");
  await page.locator(".note-scroll").evaluate(element=>element.scrollTop=element.scrollHeight);
  await expect.poll(()=>reports.length).toBeGreaterThan(previousReports);
  for(const report of reports){expect(report.searchParams.get("t")).toBe("fixture-scripture-view");expect(report.searchParams.get("dId")).toBeTruthy();expect(report.searchParams.get("sId")).toBeTruthy();expect(report.toString()).not.toContain("PRIVATE");expect([...report.searchParams.keys()].sort()).toEqual(["dId","sId","t"]);}
});

test("a fallback connection failure is visible without hiding working translations",async({page})=>{
  await page.route("**/api/bible?**",route=>route.fulfill({json:{versions:[versions[0]],warnings:["API.Bible could not connect. Please try again."]}}));
  await page.goto("/");await expect(page.getByLabel("Bible version",{exact:true})).toHaveValue("1");
  await expect(page.locator(".app-notice")).toContainText("API.Bible could not connect");
  await expect(page.getByLabel("Bible version",{exact:true}).locator('option[value="unavailable-NIV"]')).toHaveAttribute("disabled","");
});
