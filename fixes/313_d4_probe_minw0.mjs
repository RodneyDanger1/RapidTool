// fixes/313_d4_probe_minw0.mjs — MOVED (E3 hygiene, W312 close): D4's min-w-0 grid-blowout
// hypothesis probe, rescued from the repo root (committed there in 54c6649; scratch probes leave
// root — precedent fixes/290_k1_timeline_probe.mjs). Kept as durable evidence for the D4 mobile
// overflow fix (2955px → 390px real bug). Run from the repo root (needs the live dev server
// on :8080):  node fixes/313_d4_probe_minw0.mjs
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Northwind Dispatch"), null, { timeout: 90000 });
const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id);
await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Execute P0"), null, { timeout: 90000 });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);

const before = await page.evaluate(() => ({
  docScrollW: document.documentElement.scrollWidth,
  navW: document.querySelector('nav[aria-label="Phases"]')?.getBoundingClientRect().width ?? null,
  sectionW: document.querySelector('nav[aria-label="Phases"]')?.nextElementSibling?.getBoundingClientRect().width ?? null,
}));

// hypothesis: nav's automatic minimum size keeps the grid track at the strip's
// min-content width; min-width:0 should let the overflow-x-auto scroller work.
await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Phases"]');
  nav.style.minWidth = "0";
  return null;
});
await page.waitForTimeout(300);
const post = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Phases"]');
  const inner = nav.firstElementChild;
  return {
    docScrollW: document.documentElement.scrollWidth,
    navW: nav.getBoundingClientRect().width,
    innerScrollW: inner.scrollWidth,
    innerClientW: inner.clientWidth,
  };
});
console.log(JSON.stringify({ before, post }, null, 2));
await browser.close();
