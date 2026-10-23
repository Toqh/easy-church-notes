import { test, expect } from "@playwright/test";

test("signs into an account, syncs an owned note, then returns to separate guest notes",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("easychurchnotes:started","1"));
  const user={id:"11111111-1111-4111-8111-111111111111",aud:"authenticated",role:"authenticated",email:"reader@example.com",email_confirmed_at:new Date().toISOString(),user_metadata:{full_name:"Reader"},app_metadata:{provider:"email"},created_at:new Date().toISOString()};
  const b64=(s:string)=>Buffer.from(s).toString("base64url");
  const accessToken=`${b64(JSON.stringify({alg:"HS256",typ:"JWT"}))}.${b64(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:"authenticated",role:"authenticated"}))}.testsignature`;
  const saved:Record<string,unknown>[]=[];
  await page.route("**/api/config",r=>r.fulfill({json:{authConfigured:true,bibleConfigured:false,supabaseUrl:"https://test-project.supabase.co",supabaseKey:"sb_publishable_test"}}));
  await page.route("https://test-project.supabase.co/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes("/auth/v1/token"))return route.fulfill({json:{access_token:accessToken,token_type:"bearer",expires_in:3600,refresh_token:"test-refresh",user}});
    if(url.pathname.includes("/auth/v1/user"))return route.fulfill({json:user});
    if(url.pathname.includes("/auth/v1/logout"))return route.fulfill({status:204});
    if(url.pathname.includes("/rest/v1/notes")) {
      if(route.request().method()==="POST") {const body=route.request().postDataJSON();saved.push(...(Array.isArray(body)?body:[body]));return route.fulfill({status:201,json:null});}
      return route.fulfill({json:[]});
    }
    return route.fulfill({json:{}});
  });
  await page.goto("/");await expect(page.getByLabel("Note topic")).toHaveValue("Walking by faith");
  await page.getByRole("button",{name:/Your quiet space/}).click();await page.getByLabel("Email address").fill("reader@example.com");await page.getByLabel("Password",{exact:true}).fill("test-password-123");await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByRole("button",{name:/Reader Personal account/})).toBeVisible();await expect(page.getByLabel("Note topic")).toHaveCount(0);
  await page.getByRole("button",{name:/^New note/}).click();await page.getByLabel("Note topic").fill("My private account note");await page.getByRole("textbox",{name:"Note content"}).fill("This belongs to my signed-in account.");
  await expect(page.getByText("All changes synced",{exact:true})).toBeVisible();
  expect(saved.some(n=>n.topic==="My private account note"&&n.user_id===user.id)).toBe(true);
  await page.getByRole("button",{name:/Reader Personal account/}).click();await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page.getByLabel("Note topic")).toHaveValue("Walking by faith");await expect(page.getByRole("button",{name:/My private account note/})).toHaveCount(0);
});
