import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", route => route.fulfill({ json: { authConfigured: false, bibleConfigured: false, supabaseUrl: "", supabaseKey: "" } }));
});

for (const width of [320, 390, 1440]) test(`a new visitor can start a blank note without an account at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A little space for the Word." })).toBeVisible();
  await expect(page.getByRole("link", { name: "EasyChurchNotes home" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("easychurchnotes:v1:guest"))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`welcome-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Start taking notes", exact: true }).click();
  const content = page.getByRole("textbox", { name: "Note content" });
  await expect(content).toBeVisible();
  await expect(page.getByLabel("Note topic")).toHaveValue("");
  await expect(content).toHaveText("");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Note topic").fill("My first reflection");
  await content.fill("A thought I want to remember.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "A little space for the Word." })).toHaveCount(0);
  if (width <= 760) await page.getByRole("button", { name: /My first reflection/ }).click();
  await expect(page.getByLabel("Note topic")).toHaveValue("My first reflection");
  await expect(content).toContainText("A thought I want to remember.");
});

test("an existing notebook bypasses the welcome page without changing its notes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easychurchnotes:v1:guest", JSON.stringify([{
    id: "legacy-note", topic: "Already here", preacher: "", tags: [], kind: "personal", pinned: false, deleted_at: null,
    created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", plain_text: "Keep this reflection.",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Keep this reflection." }] }] }
  }])));
  await page.goto("/");
  await expect(page.getByLabel("Note topic")).toHaveValue("Already here");
  await expect(page.getByRole("textbox", { name: "Note content" })).toContainText("Keep this reflection.");
  await expect(page.getByRole("button", { name: "Start taking notes" })).toHaveCount(0);
});

test("Sign in on the welcome page opens the existing account form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Welcome back." })).toBeVisible();
  await page.getByLabel("Close account").click();
  await expect(page.getByRole("textbox", { name: "Note content" })).toBeVisible();
});

for (const confirmation of [false, true]) test(`a later signup keeps guest notes and syncs them${confirmation ? " after email confirmation and sign in" : " immediately"}`, async ({ page }) => {
  const user = { id: "22222222-2222-4222-8222-222222222222", aud: "authenticated", role: "authenticated", email: "new-reader@example.com", email_confirmed_at: new Date().toISOString(), user_metadata: { full_name: "New Reader" }, app_metadata: { provider: "email" }, created_at: new Date().toISOString() };
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated", role: "authenticated" })}.testsignature`;
  const session = { access_token: token, token_type: "bearer", expires_in: 3600, refresh_token: "test-refresh", user };
  const saved: Record<string, unknown>[] = [];
  await page.route("**/api/config", route => route.fulfill({ json: { authConfigured: true, bibleConfigured: false, supabaseUrl: "https://new-project.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.route("https://new-project.supabase.co/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/auth/v1/signup")) return route.fulfill({ json: confirmation ? { user } : session });
    if (url.pathname.includes("/auth/v1/token")) return route.fulfill({ json: session });
    if (url.pathname.includes("/auth/v1/user")) return route.fulfill({ json: user });
    if (url.pathname.includes("/rest/v1/notes")) {
      if (route.request().method() === "POST") { const body = route.request().postDataJSON(); saved.push(...(Array.isArray(body) ? body : [body])); return route.fulfill({ status: 201, json: null }); }
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start taking notes", exact: true }).click();
  const prompt = page.getByRole("complementary", { name: "Keep your notes across devices" });
  await page.getByRole("textbox", { name: "Note content" }).fill("A small beginning.");
  await expect(prompt).toHaveCount(0);
  const reflection = "God is teaching me to listen carefully, trust his timing, and remember the ways he has already been faithful. I want to carry these words into the coming week and keep making space for prayer.";
  await page.getByLabel("Note topic").fill("My guest reflection");
  await page.getByRole("textbox", { name: "Note content" }).fill(reflection);
  await expect(prompt).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await prompt.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("dialog", { name: "A space of your own." })).toBeVisible();
  await page.getByLabel("Your name").fill("New Reader");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("dialog").getByRole("button", { name: "Create account", exact: true }).click();
  if (confirmation) {
    await expect(page.getByRole("status")).toContainText("Check your email");
    await page.reload();
    await expect(page.getByLabel("Note topic")).toHaveValue("My guest reflection");
    await page.getByRole("button", { name: /Your quiet space/ }).click();
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("test-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /New Reader Personal account/ })).toBeVisible();
  await expect(page.getByLabel("Note topic")).toHaveValue("My guest reflection");
  await expect(page.getByRole("textbox", { name: "Note content" })).toContainText(reflection);
  await expect(page.getByText("All changes synced", { exact: true })).toBeVisible();
  expect(saved.some(note => note.topic === "My guest reflection" && note.user_id === user.id)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("easychurchnotes:v1:guest"))).toContain(reflection);
});

test("the signup suggestion can be dismissed without interrupting writing", async ({ page }) => {
  await page.route("**/api/config", route => route.fulfill({ json: { authConfigured: true, bibleConfigured: false, supabaseUrl: "https://new-project.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.goto("/"); await page.getByRole("button", { name: "Start taking notes", exact: true }).click();
  const content = page.getByRole("textbox", { name: "Note content" });
  await content.fill(Array.from({ length: 35 }, () => "reflection").join(" "));
  await page.getByLabel("Dismiss signup suggestion").click();
  await content.press("End"); await content.press("Space"); await content.press("t");
  await expect(content).toBeFocused(); await expect(content).toContainText("t");
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Keep your notes across devices" })).toHaveCount(0);
});
