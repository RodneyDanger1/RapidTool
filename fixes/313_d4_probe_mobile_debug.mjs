// fixes/313_d4_probe_mobile_debug.mjs — MOVED (E3 hygiene, W312 close): D4's mobile-viewport run
// page debug probe (console/pageerror capture + home/run readiness), rescued from the repo root
// (committed there in 54c6649; scratch probes leave root — precedent fixes/290_k1_timeline_probe.mjs).
// Writes ~/d4_probe/debug-mobile.png. Run from the repo root (needs the live dev server on :8080):
//   node fixes/313_d4_probe_mobile_debug.mjs
import { chromium } from "playwright";
import { homedir } from "node:os";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push("console: " + m.text().slice(0, 200)); });
page.on("pageerror", (e) => logs.push("pageerror: " + String(e).slice(0, 300)));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => logs.push("goto home: " + String(e).slice(0, 120)));
await page.waitForTimeout(4000);
const home = await page.evaluate(() => ({
  url: location.href, ready: document.readyState,
  blen: document.body ? document.body.innerText.length : -1,
  head: document.body ? document.body.innerText.slice(0, 200) : "(no body)",
})).catch((e) => ({ err: String(e) }));

const pid = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id; } catch { return null; }
});

await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => logs.push("goto run: " + String(e).slice(0, 120)));
await page.waitForTimeout(6000);
const run = await page.evaluate(() => ({
  url: location.href, ready: document.readyState,
  blen: document.body ? document.body.innerText.length : -1,
  head: document.body ? document.body.innerText.slice(0, 300) : "(no body)",
  navs: [...document.querySelectorAll("nav")].map((n) => n.getAttribute("aria-label")),
  sidebarBtn: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /Sidebar/i.test(t)),
})).catch((e) => ({ err: String(e) }));

await page.screenshot({ path: `${homedir()}/d4_probe/debug-mobile.png` });
console.log(JSON.stringify({ home, run, logs }, null, 2));
await browser.close();
