import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("easychurchnotes:started","1"));
  await page.route("**/api/config",route=>route.fulfill({json:{authConfigured:false,bibleConfigured:false,supabaseUrl:"",supabaseKey:""}}));
});

test("the install manifest and Apple metadata use real correctly sized app icons",async({page,request})=>{
  const response=await request.get("/manifest.webmanifest");expect(response.ok()).toBe(true);
  const manifest=await response.json();expect(manifest.name).toBe("EasyChurchNotes");expect(manifest.display).toBe("standalone");expect(manifest.scope).toBe("/");expect(manifest.id).toBe("/");
  expect(manifest.icons.some((icon:{purpose:string})=>icon.purpose==="maskable")).toBe(true);
  for(const icon of manifest.icons){const response=await request.get(icon.src);expect(response.ok()).toBe(true);const bytes=await response.body();const size=Number(icon.sizes.split("x")[0]);expect(bytes.readUInt32BE(16)).toBe(size);expect(bytes.readUInt32BE(20)).toBe(size);}
  await page.goto("/");await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href","/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href","/apple-touch-icon.png");
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content","yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content","EasyChurchNotes");
});

test("Install app opens the browser prompt and disappears after installation",async({page})=>{
  await page.goto("/");await expect(page.getByLabel("Note topic")).toBeVisible();
  await page.evaluate(()=>{
    const event=new Event("beforeinstallprompt",{cancelable:true});
    Object.defineProperties(event,{prompt:{value:async()=>{document.documentElement.dataset.installPrompt="opened";}},userChoice:{value:Promise.resolve({outcome:"accepted"})}});
    window.dispatchEvent(event);
  });
  await page.getByLabel("Note actions",{exact:true}).click();await page.getByRole("button",{name:"Install app",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Install EasyChurchNotes"});await expect(dialog).toBeVisible();
  await dialog.getByRole("button",{name:"Install app",exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt","opened");
  await page.evaluate(()=>window.dispatchEvent(new Event("appinstalled")));
  await page.getByLabel("Note actions",{exact:true}).click();await expect(page.getByRole("button",{name:"Install app",exact:true})).toHaveCount(0);
});

test("iPhone gets Add to Home Screen instructions without a browser prompt",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{get:()=>"Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1"});
    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();event.stopImmediatePropagation();},true);
  });
  await page.goto("/");await expect(page.getByLabel("Note topic")).toBeVisible();
  await page.getByLabel("Note actions",{exact:true}).click();await page.getByRole("button",{name:"Install app",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Install EasyChurchNotes"});await expect(dialog).toContainText("Add to Home Screen");await expect(dialog).toContainText("Open as Web App");
  await expect(dialog.getByRole("button",{name:"Install app",exact:true})).toHaveCount(0);
  expect(await dialog.evaluate(element=>{const bounds=element.getBoundingClientRect();return bounds.left>=0&&bounds.right<=innerWidth&&element.scrollWidth<=element.clientWidth;})).toBe(true);
  await page.getByLabel("Close install instructions").click();await expect(dialog).toHaveCount(0);
});

test("the production worker shows a reconnect page offline and never caches private API responses",async({page,context,request})=>{
  test.skip(process.env.PWA_TESTS!=="1","Service workers register only in a production build; set PWA_TESTS=1 to run this check.");
  const worker=await request.get("/sw.js");expect(worker.headers()["cache-control"]).toContain("no-store");
  await page.goto("/");const content=page.getByRole("textbox",{name:"Note content"});await content.fill("My locally saved reflection.");
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toContain("/sw.js");
  await page.evaluate(()=>fetch("/api/config").then(response=>response.json()));
  const cached=await page.evaluate(async()=>{const cacheNames=(await caches.keys()).filter(key=>key.startsWith("easychurchnotes-"));return (await Promise.all(cacheNames.map(async key=>(await(await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)))).flat();});
  expect(cached).toContain("/offline.html");expect(cached).not.toContain("/api/config");expect(cached).not.toContain("/");expect(cached.every(path=>!path.startsWith("/api/"))).toBe(true);
  await context.setOffline(true);await page.goto("/?offline-check=1");
  await expect(page.getByRole("heading",{name:"A little pause in the connection."})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem("easychurchnotes:v1:guest"))).toContain("My locally saved reflection.");
  await context.setOffline(false);await page.getByRole("link",{name:"Try again"}).click();
  await expect(page.getByRole("textbox",{name:"Note content"})).toContainText("My locally saved reflection.");
});
