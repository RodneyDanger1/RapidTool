// fixes/313_e3_probe.mjs — E3 UI-FINISHER final screenshot pass (W312 close; HEAD 54c6649).
// Purpose: before/after evidence for the E3 type-ramp sweep + the final surface shots into
// fixes/313_ui_shots/. Method = the 311/D4 probes' (playwright vs the already-running dev
// server :8080). Run from the repo root (needs the live dev server on :8080):
//   node fixes/313_e3_probe.mjs before ~/e3_probe/before
//   node fixes/313_e3_probe.mjs after  fixes/313_ui_shots
// Writes <outdir>/<phase>-*.png + <outdir>/report-<phase>.json; prints the report JSON on stdout.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const PHASE = process.argv[2] ?? "before";
const OUT = process.argv[3] ?? `fixes/313_ui_shots/${PHASE}`;
mkdirSync(OUT, { recursive: true });

const BASE = "http://127.0.0.1:8080";
const report = { base: BASE, phase: PHASE, out: OUT, shots: [], errors: [], probes: {} };

const probePage = async (page) => ({
  // Typographic samples: chrome must stay on the 2xs floor; swept reading-meta must be 12px.
  chromeBadgePx: await page
    .evaluate(() => {
      const el = document.querySelector(".rt-badge");
      return el ? getComputedStyle(el).fontSize : null;
    })
    .catch(() => null),
  eyebrowPx: await page
    .evaluate(() => {
      const el = document.querySelector('section[aria-label*="telemetry"] p.uppercase, section[aria-label*="telemetry"] h3');
      return el ? getComputedStyle(el).fontSize : null;
    })
    .catch(() => null),
  railMetaPx: await page
    .evaluate(() => {
      const sec = document.querySelector('section[aria-label="Pipeline telemetry and phase detail"]');
      if (!sec) return null;
      const p = [...sec.querySelectorAll("p.font-mono")].find((n) => !/uppercase/.test(n.className) && n.textContent.trim().length > 3);
      return p ? getComputedStyle(p).fontSize : null;
    })
    .catch(() => null),
  // The 311 audit's headline metric (same walker as D4's probe).
  sub12pxLeafCount: await page
    .evaluate(() => {
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
    })
    .catch(() => null),
  sectionLabels: await page
    .evaluate(() => [...document.querySelectorAll("section[aria-label]")].map((s) => s.getAttribute("aria-label")))
    .catch(() => null),
  nowline: await page
    .evaluate(() => {
      const el = document.querySelector('[aria-label="Newest pipeline event"]');
      return el ? { role: el.getAttribute("role"), ariaLive: el.getAttribute("aria-live"), ariaAtomic: el.getAttribute("aria-atomic") } : null;
    })
    .catch(() => null),
  a11y: await page
    .evaluate(() => ({
      ariaLiveCount: document.querySelectorAll("[aria-live]").length,
      roleLogCount: document.querySelectorAll('[role="log"]').length,
    }))
    .catch(() => null),
});

const openRuntimeTimeline = async (page) => {
  await page.getByRole("button", { name: /More panels/ }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: /Runtime log/ }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Typed timeline/ }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("#rt-timeline-body").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
};

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${PHASE}-${name}.png` });
  report.shots.push(`${PHASE}-${name}.png`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

// ---- Pass A: dark theme (default) ----
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Northwind Dispatch"), null, { timeout: 90000 });
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id);
  report.probes.projectId = pid;
  await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Execute P0"), null, { timeout: 90000 });
  await page.waitForTimeout(1200);

  await shot(page, "01-run-top");
  const railSec = page.locator('section[aria-label="Pipeline telemetry and phase detail"]').first();
  await railSec.scrollIntoViewIfNeeded().catch(() => {});
  await railSec.screenshot({ path: `${OUT}/${PHASE}-02-rail-detail.png` }).catch(() => {});
  report.shots.push(`${PHASE}-02-rail-detail.png`);
  Object.assign(report.probes, await probePage(page));

  await openRuntimeTimeline(page);
  await shot(page, "03-runtime-timeline-dark");
  await ctx.close();
} catch (e) {
  report.errors.push("passA: " + String(e && e.message ? e.message : e));
}

// ---- Pass B: light theme + mobile ----
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("rapid.theme", "light"));
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Northwind Dispatch"), null, { timeout: 90000 });
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem("rapidtool.v4")).state.projects[0].id);
  await page.goto(`${BASE}/run/${pid}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes("Execute P0"), null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await openRuntimeTimeline(page);
  await shot(page, "04-runtime-timeline-light");
  report.probes.timelineWells = await page
    .evaluate(() => {
      const g = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      return { body: g("#rt-timeline-body"), row: g("#rt-timeline-body ol li") };
    })
    .catch(() => null);

  // Mobile pass (same hydrated page — localStorage must carry the demo project).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  report.probes.mobileRailStrip = await page
    .evaluate(() => ({
      docScrollW: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      navW: document.querySelector('nav[aria-label="Phases"]')?.getBoundingClientRect().width ?? null,
    }))
    .catch(() => null);
  await shot(page, "05-mobile-closed");
  const sideBtn = page.getByRole("button", { name: /^Sidebar$/ });
  await sideBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "06-mobile-drawer");
  await ctx.close();
} catch (e) {
  report.errors.push("passB: " + String(e && e.message ? e.message : e));
}

await browser.close();
writeFileSync(`${OUT}/report-${PHASE}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
