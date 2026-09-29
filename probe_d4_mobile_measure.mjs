// D4 scratch: precise mobile layout measurements at 390px (delete after use).
import { chromium } from "playwright";
import { homedir } from "node:os";

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
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(900);

const m = await page.evaluate(() => {
  const iw = window.innerWidth;
  const de = document.documentElement;
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const w = el.scrollWidth;
    if (w > iw + 20 && el.clientWidth <= iw + 20) {
      offenders.push({ tag: el.tagName, cls: String(el.className).slice(0, 90), scrollW: w, clientW: el.clientWidth });
      if (offenders.length >= 6) break;
    }
  }
  const nav = document.querySelector('nav[aria-label="Phases"]');
  const navInner = nav ? nav.firstElementChild : null;
  const bar = document.querySelector('nav[aria-label="Phases"]');
  return {
    innerWidth: iw,
    docScrollW: de.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    nav: nav ? { rect: nav.getBoundingClientRect().toJSON(), cls: String(nav.className).slice(0, 90) } : null,
    navInner: navInner ? { scrollW: navInner.scrollWidth, clientW: navInner.clientWidth, overflowX: getComputedStyle(navInner).overflowX } : null,
    offenders,
  };
});
await page.screenshot({ path: `${homedir()}/d4_probe/mobile-top.png` });
console.log(JSON.stringify(m, null, 2));
await browser.close();
