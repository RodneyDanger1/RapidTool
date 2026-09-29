// fixes/313_d4_probe_verify.mjs — MOVED (E3 hygiene, W312 close): D4's verification probe,
// rescued from the repo root (committed there in 54c6649; scratch probes leave root — hygiene
// precedent fixes/290_k1_timeline_probe.mjs / fixes/299_u1_probe.mjs). Kept as durable evidence
// for the D4/E3 before/after records. Probes: rail section label, now-line live-region attrs,
// a11y counts, sub-12px recount, runtime-timeline well colors (light theme), mobile sidebar
// drawer — playwright vs the already-running dev server :8080; report + shots → ~/d4_probe/.
// Run from the repo root:  node fixes/313_d4_probe_verify.mjs before|after
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const PHASE = process.argv[2] ?? "before";
const BASE = "http://127.0.0.1:8080";
const OUT = `${homedir()}/d4_probe`;
mkdirSync(OUT, { recursive: true });
const report = { base: BASE, phase: PHASE, shots: [], errors: [], probes: {} };

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("rapid.theme", "light"));
const page = await ctx.newPage();

try {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Northwind Dispatch"), null, { timeout: 90000 });
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id);
  report.probes.projectId = pid;

  await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Execute P0"), null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  // --- 1. section landmark inventory + rail-section label ---
  report.probes.sectionLabels = await page.evaluate(() =>
    [...document.querySelectorAll("section[aria-label]")].map((s) => s.getAttribute("aria-label")),
  );

  // --- 2. now-line live region attrs ---
  report.probes.nowline = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Newest pipeline event"]');
    if (!el) return null;
    const row = el.firstElementChild;
    return {
      role: el.getAttribute("role"),
      ariaLive: el.getAttribute("aria-live"),
      ariaAtomic: el.getAttribute("aria-atomic"),
      label: el.getAttribute("aria-label"),
      keyedRowClass: row ? row.className : null,
    };
  });

  // --- 3. a11y counts on the run screen (311 method) ---
  report.probes.a11y = await page.evaluate(() => ({
    ariaLiveCount: document.querySelectorAll("[aria-live]").length,
    roleLogCount: document.querySelectorAll('[role="log"]').length,
    roleStatusCount: document.querySelectorAll('[role="status"]').length,
  }));
  report.probes.autopilotNamed = await page.getByRole("checkbox", { name: /Autopilot/ }).count();
  report.probes.fileInputName = await page
    .locator('input[type="file"]')
    .getAttribute("aria-label");
  report.probes.legendVisible = await page.getByText("Execute current phase", { exact: false }).count();

  // --- 4. sub-12px leaf recount (311 method) ---
  report.probes.sub12pxLeafCount = await page.evaluate(() => {
    let count = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      if (!t.nodeValue || !t.nodeValue.trim()) continue;
      const el = t.parentElement;
      if (!el) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 12) count++;
    }
    return count;
  });

  // --- 5. runtime-timeline wells (light theme) — computed background colors ---
  await page.getByRole("button", { name: /More panels/ }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: /Runtime log/ }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Typed timeline/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  report.probes.timelineWells = await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, cls: el.className };
    };
    return {
      body: g("#rt-timeline-body"),
      row: g("#rt-timeline-body ol li"),
      rawPre: g("#rt-timeline-body details pre"),
    };
  });
  const pane = page.locator("#rt-timeline-body");
  await pane.scrollIntoViewIfNeeded().catch(() => {});
  // a11y recount with the runtime tab now visited (the ring feed's live region
  // is mounted by then — run-screen counts before the visit measure 1).
  report.probes.a11yAfterRuntime = await page.evaluate(() => ({
    ariaLiveCount: document.querySelectorAll("[aria-live]").length,
    roleLogCount: document.querySelectorAll('[role="log"]').length,
    logLabels: [...document.querySelectorAll('[role="log"]')].map((el) => el.getAttribute("aria-label")),
  }));
  await page.screenshot({ path: `${OUT}/${PHASE}-timeline-light.png` });
  report.shots.push(`${PHASE}-timeline-light.png`);

  // --- 6. mobile pass: same hydrated page, resized (localStorage must carry the
  // demo project — a fresh context would hit /run/<pid> with an empty store) ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const sideBtn = page.getByRole("button", { name: /^Sidebar$|^Hide sidebar$/ });
  report.probes.mobileSidebarBtnVisible = await sideBtn.isVisible().catch(() => false);
  report.probes.mobileRailStrip = await page.evaluate(() => {
    const scroller = document.querySelector('nav[aria-label="Phases"] > div');
    return {
      docScrollW: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      navW: document.querySelector('nav[aria-label="Phases"]')?.getBoundingClientRect().width ?? null,
      innerScrollW: scroller ? scroller.scrollWidth : null,
      innerClientW: scroller ? scroller.clientWidth : null,
    };
  });
  await page.screenshot({ path: `${OUT}/${PHASE}-mobile-closed.png` });
  report.shots.push(`${PHASE}-mobile-closed.png`);
  await sideBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  report.probes.mobileDrawer = await page.evaluate(() => {
    const aside = document.querySelector("#run-sidebar");
    const btn = [...document.querySelectorAll("button")].find((b) => /Sidebar/i.test(b.textContent));
    return {
      asideVisible: aside ? !!(aside.offsetWidth || aside.offsetHeight) : null,
      asideCls: aside ? aside.className.slice(0, 60) : null,
      btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
    };
  });
  await page.screenshot({ path: `${OUT}/${PHASE}-mobile-drawer.png` });
  report.shots.push(`${PHASE}-mobile-drawer.png`);
  await page.setViewportSize({ width: 1440, height: 900 });
} catch (e) {
  report.errors.push(String(e && e.message ? e.message : e));
}

await browser.close();
writeFileSync(`${OUT}/report-${PHASE}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
