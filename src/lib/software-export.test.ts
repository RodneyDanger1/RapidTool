// ---------------------------------------------------------------------------
// software-export.test.ts — the browser emit seam (src/lib/software-export.ts).
// Run: node --experimental-strip-types --test src/lib/software-export.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";
import {
  buildSoftwareArchive,
  codeFilesOf,
  emitSoftware,
  entryDocumentOf,
  previewDocumentFor,
  softwareArchiveFilename,
  treeByteSize,
} from "./software-export.ts";

const fullRun = (over: Partial<Project> = {}) => runHeadless(seedProject(over), ALL_PHASES);

/**
 * The measured Bloedow run: cycle 1 refused `RT_E_PLAN_UNDERPRODUCED`, later
 * cycles accepted 8/8 chunks but the final verdict was a brief-fit refusal —
 * and the whole tree was withheld, so the user saw nothing. fixes/356 restored
 * `refuse` as the scaffold default; the console Preview must still surface this
 * project's real tree with its README banner and a downloadable ZIP (fixes/357).
 */
const belowFloorRun = (): Project => ({
  ...fullRun({ kind: "app" }),
  logs: [
    {
      ts: 1,
      phase: 6,
      level: "warn",
      event: "p6.synthesis.refused",
      detail:
        "RT_E_PLAN_UNDERPRODUCED · chunk 1/8 refused · accepted tree has 0 module(s) but the brief demands >= 8",
    },
    {
      ts: 2,
      phase: 6,
      level: "warn",
      event: "p6.synthesis.refused",
      detail: "RT_E_VALIDATION · tree 8/8 chunks accepted · assembled tree does not implement the brief's required vocabulary",
    },
  ],
});

/**
 * A run that is red for a reason OTHER than under-production: the brief withholds
 * a figure class and the emitted module authors a price literal, so the scaffold
 * refuses with the coded `RT_E_VALIDATION` (declare-or-strike). `generatedTree`
 * is emptied so the scaffold hosts — and therefore polices — the module body.
 */
const inventedFigureRun = (): Project => ({
  ...fullRun({ kind: "app" }),
  brief: "A bakery site. No prices are published — do not invent numbers.",
  generatedSource: "export const priceCents = 1250;\n",
  generatedTree: [],
});

const EOCD_SIG = 0x06054b50;
const LOCAL_SIG = 0x04034b50;

/** Walk the contiguous local file headers to list names + stored data. */
function readLocalEntries(bytes: Uint8Array): { name: string; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const out: { name: string; data: Uint8Array }[] = [];
  let p = 0;
  while (p + 4 <= bytes.length && view.getUint32(p, true) === LOCAL_SIG) {
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const size = view.getUint32(p + 18, true);
    const name = decoder.decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const dataStart = p + 30 + nameLen + extraLen;
    out.push({ name, data: bytes.subarray(dataStart, dataStart + size) });
    p = dataStart + size;
  }
  return out;
}

describe("emitSoftware", () => {
  it("emits the webapp tree with its HTML entry and UI module", () => {
    const emitted = emitSoftware(fullRun({ kind: "app" }));
    assert.ok(emitted.ok, "a full keyless run emits");
    assert.equal(emitted.kind, "webapp");
    assert.equal(emitted.entryPath, "index.html");
    assert.ok(emitted.uiPath !== null, "a webapp with a spec-graph ui node names its ui module");
    assert.ok(emitted.files.some((f) => f.path === "src/main.tsx"));
    assert.ok(emitted.files.some((f) => f.path === "vite.config.ts"));
  });

  it("reports no HTML entry for a library kind", () => {
    const emitted = emitSoftware(fullRun({ kind: "library" }));
    assert.ok(emitted.ok);
    assert.equal(emitted.kind, "library");
    assert.equal(emitted.entryPath, null);
    assert.equal(entryDocumentOf(emitted.files), null);
  });

  it("fixes/347: a below-floor run surfaces its real tree with the honest red banner", () => {
    const project = belowFloorRun();
    const emitted = emitSoftware(project);
    assert.ok(emitted.ok, "the tree is surfaced rather than withheld");
    // fixes/354 A2-F4 (D1) / fixes/357: this seam opts in to the banner policy,
    // so the scaffold lands the bannered below-floor partial and reports the
    // recorded refusal on the result.
    assert.equal(emitted.redTree?.code, "RT_E_PLAN_UNDERPRODUCED");
    assert.match(emitted.redTree?.detail ?? "", /RT_E_PLAN_UNDERPRODUCED/);
    const readme = emitted.files.find((f) => f.path === "README.md");
    assert.ok(readme, "the README is emitted");
    assert.match(readme.body, /^> \[!CAUTION\]/, "the caution banner leads the README");
    assert.match(readme.body, /BELOW-FLOOR PLAN/, "the banner names the below-floor state");
    assert.equal(emitted.entryPath, "index.html", "the real web entry is inspectable");
  });

  it("fixes/347-2: reports the emitted surface rows dod's kind-aware gates read", () => {
    const emitted = emitSoftware(fullRun({ kind: "app" }));
    assert.ok(emitted.ok);
    assert.ok(Array.isArray(emitted.surfaceTree), "the gate-wiring seam rides the emit envelope");
    assert.ok(emitted.surfaceTree.length > 0, "an app tree exposes its src/ui surface");
    for (const row of emitted.surfaceTree) {
      assert.ok(row.path.length > 0 && row.source.length > 0 && row.hash.length > 0, "row shape matches generatedTree");
    }
    const lib = emitSoftware(fullRun({ kind: "library" }));
    assert.ok(lib.ok);
    assert.equal(lib.surfaceTree[0]?.path, "src/main.ts", "a runnable entry leads the surface rows");
  });

  it("fixes/357: a run red for ANOTHER reason still returns the coded refusal", () => {
    // The below-floor banner opt-in is scoped to that ONE policy: a different
    // emission refusal is still refused, coded, and never presented as a tree.
    const emitted = emitSoftware(inventedFigureRun());
    assert.equal(emitted.ok, false, "an invented figure literal is still refused");
    if (emitted.ok) return;
    assert.equal(emitted.code, "RT_E_VALIDATION");
    assert.match(emitted.error, /withholds prices\/awards\/addresses/);
  });
});

describe("buildSoftwareArchive", () => {
  it("packs every emitted file at its exact relative path", () => {
    const project = fullRun({ kind: "app" });
    const emitted = emitSoftware(project);
    assert.ok(emitted.ok);
    const archive = buildSoftwareArchive(project, { date: new Date(2026, 0, 2) });
    assert.ok(archive.ok, "packing must succeed");
    assert.equal(archive.filename, "fixture-software.zip");
    assert.equal(archive.fileCount, emitted.files.length);
    assert.equal(new DataView(archive.bytes.buffer).getUint32(0, true), LOCAL_SIG);
    const eocdOffset = archive.bytes.length - 22;
    assert.equal(new DataView(archive.bytes.buffer).getUint32(eocdOffset, true), EOCD_SIG);

    const entries = readLocalEntries(archive.bytes);
    assert.equal(entries.length, emitted.files.length);
    const decoder = new TextDecoder();
    for (const file of emitted.files) {
      const zipped = entries.find((e) => e.name === file.path);
      assert.ok(zipped, `archive must contain ${file.path}`);
      assert.equal(decoder.decode(zipped.data), file.body, `${file.path} bytes must match`);
    }
  });

  it("names the archive from the project slug", () => {
    const project = fullRun({ name: "Wildstem Florist" });
    assert.equal(softwareArchiveFilename(project), "wildstem-florist-software.zip");
  });

  it("fixes/357: offers the ZIP for a below-floor run, bannered README inside", () => {
    const project = belowFloorRun();
    const archive = buildSoftwareArchive(project, { date: new Date(2026, 0, 2) });
    assert.ok(archive.ok, "a below-floor tree is downloadable, not withheld");
    const readme = readLocalEntries(archive.bytes).find((e) => e.name === "README.md");
    assert.ok(readme, "the archive carries the emitted README");
    const body = new TextDecoder().decode(readme.data);
    assert.match(body, /^> \[!CAUTION\]/, "the caution banner leads the archived README");
    assert.match(body, /BELOW-FLOOR PLAN/, "the banner names the below-floor state");
  });

  it("fixes/357: a refused run yields no archive bytes at all", () => {
    const archive = buildSoftwareArchive(inventedFigureRun());
    assert.equal(archive.ok, false);
    if (archive.ok) return;
    assert.equal(archive.code, "RT_E_VALIDATION");
    assert.equal("fileCount" in archive, false, "a refusal carries no archive shape");
    assert.equal("bytes" in archive, false, "a refusal carries no archive bytes");
  });
});

describe("codeFilesOf", () => {
  it("selects only transpilable code files", () => {
    const emitted = emitSoftware(fullRun({ kind: "app" }));
    assert.ok(emitted.ok);
    const code = codeFilesOf(emitted.files);
    assert.ok(code.length > 0);
    assert.ok(code.every((f) => /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(f.path)));
    assert.ok(!code.some((f) => f.path === "index.html"));
    assert.ok(!code.some((f) => f.path.endsWith(".css")));
  });
});

describe("previewDocumentFor", () => {
  it("inlines the emitted CSS, drops the Vite module script, and mounts the markup", () => {
    const emitted = emitSoftware(fullRun({ kind: "app" }));
    assert.ok(emitted.ok);
    const doc = previewDocumentFor(emitted.files, "<h1>Rendered product</h1>");
    assert.ok(doc !== null);
    assert.match(doc, /<div id="root"><h1>Rendered product<\/h1><\/div>/);
    assert.doesNotMatch(doc, /type="module"/, "the un-resolvable Vite entry script is removed");
    assert.doesNotMatch(doc, /@import\s+["']tailwindcss["']/, "the Tailwind import cannot resolve in an iframe");
    assert.match(doc, /<style>/, "the emitted stylesheet is inlined");
  });

  it("returns null when the tree has no HTML entry", () => {
    const emitted = emitSoftware(fullRun({ kind: "library" }));
    assert.ok(emitted.ok);
    assert.equal(previewDocumentFor(emitted.files, "<h1>x</h1>"), null);
  });
});

describe("treeByteSize", () => {
  it("counts UTF-8 bytes of every file body", () => {
    assert.equal(treeByteSize([{ path: "a", body: "abc" }, { path: "b", body: "é" }]), 5);
  });
});
