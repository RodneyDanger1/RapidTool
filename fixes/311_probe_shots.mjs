// fixes/311_probe_shots.mjs — MOVED (E3 hygiene, W312 close): the 311 UI-DESIGN audit's shot
// generator v5 (light-theme runtime pane, bg-black well check), rescued from the repo root
// (committed there in 54c6649; scratch probes leave root — hygiene precedent
// fixes/290_k1_timeline_probe.mjs). Regenerates fixes/311_ui_shots/17-runtime-light.png +
// 18-runtime-pane-light.png. Run from the repo root (needs the live dev server on :8080):
//   node fixes/311_probe_shots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
const OUT = "fixes/311_ui_shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("rapid.theme", "light"));
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.innerText.includes("Northwind Dispatch"), { timeout: 60000 });
const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id);
await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.innerText.includes("Deep Research"), { timeout: 60000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /More panels/ }).click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole("tab", { name: /Runtime log/ }).click().catch(() => {});
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Typed timeline/ }).click().catch(() => {});
await page.waitForTimeout(400);
// screenshot the viewport with the runtime pane + timeline visible
await page.locator("#rt-timeline-body").scrollIntoViewIfNeeded().catch(() => {});
await page.mouse.wheel(0, -220);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/17-runtime-light.png` });
// element shot of the ring list rows (the bg-black/20 wells)
const pane = page.locator('section:has-text("Runtime telemetry")').first();
await pane.screenshot({ path: `${OUT}/18-runtime-pane-light.png` }).catch(() => {});
await browser.close();
console.log("ok");
