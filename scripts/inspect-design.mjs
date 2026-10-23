// Visual QA uses service fixtures; screenshots are design previews, not live API verification.
import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/api/config", route => route.fulfill({ json: { authConfigured: false, bibleConfigured: true, supabaseUrl: "", supabaseKey: "" } }));
const version={ id: 1, abbreviation: "KJV", title: "King James Version" };
await page.route("**/api/bible?**", route => route.fulfill({ json: new URL(route.request().url()).searchParams.get("action")==="versions" ? { versions: [version, { id: -2, abbreviation: "ASV", title: "American Standard Version", provider:"bible-api" }] } : {id:"JHN.3.16",reference:"John 3:16",content:"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",version} }));
await page.goto(process.env.TEST_BASE_URL||"http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.getByLabel("Note topic").waitFor({ timeout: 45000 });
await page.getByRole("button", { name: /Walking by faith/ }).click();
await page.evaluate(() => document.fonts.ready);
mkdirSync("outputs/design", { recursive: true });
await page.screenshot({ path: "outputs/design/desktop.png" });
if (process.argv.includes("--focus-only")) {
  await page.getByLabel("Enter focus mode").click();
  await page.screenshot({ path: "outputs/design/focus.png" });
  await page.getByLabel("Note collection", { exact: true }).selectOption("personal");
  await page.screenshot({ path: "outputs/design/personal-focus.png" });
  const preacherHidden = await page.getByLabel("Preacher", { exact: true }).count() === 0;
  await browser.close();
  console.log(JSON.stringify({ errors, preacherHidden }));
  process.exit(errors.length || !preacherHidden ? 1 : 0);
}
await page.getByLabel("Search Bible reference or text").fill("John 3:16");
await page.getByRole("button", { name: "Search Bible", exact: true }).click();
await page.locator(".verse-preview-text").waitFor();
await expect(page.getByRole("button", { name: "Insert into note", exact: true })).toBeEnabled();
await page.screenshot({ path: "outputs/design/bible-search.png" });
await page.evaluate(()=>document.documentElement.dataset.theme="dark");
await page.screenshot({ path: "outputs/design/passage-dark.png" });
await page.evaluate(()=>document.documentElement.dataset.theme="light");
await page.setViewportSize({width:320,height:844});
await page.screenshot({ path: "outputs/design/passage-mobile.png" });
await page.setViewportSize({width:1440,height:1000});
await page.getByLabel("Close Bible passages").click();
await page.getByLabel("Minimize sidebar", {exact:true}).click();
await page.screenshot({ path: "outputs/design/sidebar-minimized.png" });
await page.getByLabel("Expand sidebar", {exact:true}).click();
await page.getByLabel("Minimize notebook", {exact:true}).click();
await page.screenshot({ path: "outputs/design/notebook-minimized.png" });
await page.getByLabel("Show notebook", {exact:true}).click();
await page.getByRole("button", { name: /Your quiet space/ }).click();
await page.screenshot({ path: "outputs/design/account.png" });
await page.getByLabel("Close account").click();
await page.getByLabel("Switch to dark mode").click();
await page.screenshot({ path: "outputs/design/dark.png" });
await page.getByLabel("Switch to light mode").click();

const checks = [];
for (const width of [320, 390, 760, 820, 1024, 1280, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  if (width <= 760) {
    if (await page.getByLabel("Back to notes").isVisible()) await page.getByLabel("Back to notes").click();
    await page.getByRole("button", { name: /Walking by faith/ }).click();
  }
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    editorOverflow: document.querySelector(".editor-column").scrollWidth > document.querySelector(".editor-column").clientWidth,
    toolbarTarget: document.querySelector('.format-tools button').getBoundingClientRect().height,
  }));
  checks.push({ width, ...result });
  if (width === 390) {
    await page.screenshot({ path: "outputs/design/mobile-editor.png" });
    await page.getByLabel("Back to notes").click();
    await page.screenshot({ path: "outputs/design/mobile-notes.png" });
  } else if (width <= 760) await page.getByLabel("Back to notes").click();
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: /^New note/ }).focus();
await page.keyboard.press("Tab");
const focus = await page.evaluate(() => ({ width: getComputedStyle(document.activeElement).outlineWidth, style: getComputedStyle(document.activeElement).outlineStyle }));
await browser.close();
console.log(JSON.stringify({ errors, checks, keyboardFocus: focus }, null, 2));
if (errors.length || checks.some(c => c.overflow || c.editorOverflow || c.toolbarTarget < 24) || focus.style === "none") process.exitCode = 1;
