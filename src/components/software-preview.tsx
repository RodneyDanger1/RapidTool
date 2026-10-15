// ---------------------------------------------------------------------------
// software-preview.tsx — the Preview surface: see the emitted product and
// download it, entirely from browser storage.
//
// The emitter (scaffold.scaffoldProject) is pure, so the console can produce
// the exact file tree the CLI would write and render its entry document in a
// sandboxed iframe. For a webapp the emitted TSX UI is transpiled server-side
// (compilePreviewModules) and rendered with the app's own React into a static
// snapshot; every other kind shows the emitted file tree with per-file content.
// The Download button packs the tree into a real ZIP (zip.ts) — no server
// filesystem path is ever required.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, ExternalLink, FileCode2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { withheldTreeReadmeNote } from "@/lib/scaffold";
import { compilePreviewModules } from "@/lib/preview-compile";
import type { CompiledModule } from "@/lib/preview-compile.server";
import {
  buildSoftwareArchive,
  codeFilesOf,
  emitSoftware,
  previewDocumentFor,
  treeByteSize,
  type EmittedSoftware,
} from "@/lib/software-export";

const TOOL_BTN =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40";

const KIND_LABEL: Record<string, string> = {
  webapp: "web app",
  "cli-tool": "CLI tool",
  library: "library",
  game: "game",
  service: "service",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const ENCODER = new TextEncoder();
const byteSize = (body: string): number => ENCODER.encode(body).length;

// ── Sandboxed evaluation (B2-F4) ─────────────────────────────────────────────
// The emitted UI is UNTRUSTED and is evaluated with `new Function` inside a
// DedicatedWorker (preview-sandbox.worker.ts) — a realm with no `window`,
// `document` or storage, so it can never read the auth bearer token that
// auth/client.ts keeps in sessionStorage. It is NOT evaluated in this page.
type SandboxReply = { id: number; ok: boolean; html?: string; error?: string };
type SandboxOutcome = { ok: true; html: string } | { ok: false; error: string };

let previewWorker: Worker | null = null;
let previewRequestId = 0;
const previewPending = new Map<number, (reply: SandboxReply) => void>();

function settlePending(message: string): void {
  for (const [id, resolve] of previewPending) {
    previewPending.delete(id);
    resolve({ id, ok: false, error: message });
  }
}

/** Evaluate + render the emitted UI inside the sandboxed worker realm. */
function renderInSandbox(
  modules: readonly CompiledModule[],
  entryPath: string,
): Promise<SandboxOutcome> {
  if (typeof Worker === "undefined") {
    // No worker on this host — refuse honestly; never fall back to running
    // untrusted code in the page realm.
    return Promise.resolve({
      ok: false,
      error: "sandboxed preview worker is unavailable in this environment",
    });
  }
  if (previewWorker === null) {
    previewWorker = new Worker(new URL("./preview-sandbox.worker.ts", import.meta.url), {
      type: "module",
    });
    previewWorker.onmessage = (ev: { data: SandboxReply }) => {
      const resolve = previewPending.get(ev.data.id);
      if (resolve) {
        previewPending.delete(ev.data.id);
        resolve(ev.data);
      }
    };
    previewWorker.onerror = (ev: ErrorEvent) => {
      settlePending(ev.message || "sandboxed preview worker crashed");
      try {
        previewWorker?.terminate();
      } catch {
        // already gone
      }
      previewWorker = null;
    };
  }
  const worker = previewWorker;
  const id = ++previewRequestId;
  return new Promise<SandboxOutcome>((resolve) => {
    previewPending.set(id, (reply) => {
      resolve(
        reply.ok
          ? { ok: true, html: reply.html ?? "" }
          : { ok: false, error: reply.error ?? "sandboxed preview worker returned an error" },
      );
    });
    try {
      worker.postMessage({ id, modules, entryPath });
    } catch (err) {
      previewPending.delete(id);
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export function SoftwarePreview({ project }: { project: Project }) {
  const emitted = useMemo<EmittedSoftware>(() => emitSoftware(project), [project]);
  const [view, setView] = useState<"preview" | "files">("preview");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [markup, setMarkup] = useState<string | null>(null);
  const [renderNote, setRenderNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const entryPath = emitted.ok ? emitted.entryPath : null;

  // Render the emitted webapp UI to a static snapshot. Desktop-only kinds have
  // no mountable UI module, so they keep the raw entry document.
  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    setRenderNote(null);
    if (!emitted.ok || emitted.kind !== "webapp") return;
    if (emitted.uiPath === null) {
      setRenderNote(
        "No UI module in the spec graph — the emitted entry mounts an inline shell; download the ZIP and run it to see the live app.",
      );
      return;
    }
    const files = emitted.files;
    const entry = emitted.uiPath;
    (async () => {
      const compiled = await compilePreviewModules(codeFilesOf(files));
      if (cancelled) return;
      if (!compiled.ok) {
        setRenderNote(`Static snapshot unavailable — ${compiled.error}. Showing the emitted entry document as-is.`);
        return;
      }
      const rendered = await renderInSandbox(compiled.modules, entry);
      if (cancelled) return;
      if (rendered.ok) setMarkup(rendered.html);
      else
        setRenderNote(
          `Static snapshot unavailable — ${rendered.error}. Showing the emitted entry document as-is.`,
        );
    })().catch((err: unknown) => {
      if (!cancelled) {
        setRenderNote(
          `Static snapshot unavailable — ${err instanceof Error ? err.message : String(err)}. Showing the emitted entry document as-is.`,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [emitted]);

  const previewDoc = useMemo(
    () => (emitted.ok && entryPath ? previewDocumentFor(emitted.files, markup) : null),
    [emitted, entryPath, markup],
  );

  /** 351: a routed multi-page site renders its home route in the static snapshot. */
  const routedSite = emitted.ok && emitted.files.some((f) => f.path === "src/ui/router.tsx");

  /** The real run command for this kind's emitted entry (never a phantom script). */
  const runHint = !emitted.ok
    ? ""
    : emitted.kind === "webapp" || emitted.kind === "game"
      ? "npm install && npm run dev"
      : emitted.kind === "service"
        ? "npm install && npm start"
        : emitted.kind === "cli-tool"
          ? "npm install && node --experimental-strip-types src/main.ts --help"
          : "npm install && node --experimental-strip-types -e \"import('./src/main.ts')\"";

  const hasSubstance =
    Boolean(project.specGraph) ||
    Boolean(project.generatedSource && project.generatedSource.trim().length > 0) ||
    Boolean(project.generatedTree && project.generatedTree.length > 0);

  function downloadSoftware() {
    setError(null);
    setNotice(null);
    const archive = buildSoftwareArchive(project);
    if (!archive.ok) {
      setError(`${archive.code ? `${archive.code} · ` : ""}${archive.error}`);
      return;
    }
    const blob = new Blob([new Uint8Array(archive.bytes)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = archive.filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Downloaded ${archive.filename} — ${archive.fileCount} files, ${formatBytes(archive.bytes.length)}.`);
  }

  function openPreviewTab() {
    if (previewDoc === null) return;
    const blob = new Blob([previewDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (!emitted.ok) {
    return (
      <div className="px-5 py-4">
        <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-fg">The emitter refused this project</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-danger">
              {emitted.code ? `${emitted.code} · ` : ""}
              {emitted.error}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              No archive is produced for a refused emission — the coded reason above says what the
              plan is missing. Run the pipeline (or repair the plan) and re-open this tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // B2-F5 + 358 (R-10): the caution copy is driven by whatever verdict `redTree`
  // carries, not by a hard-coded code, and whether the README carries a banner is
  // read from the emitted bytes. BOTH banners the emitter writes are honoured —
  // the scaffold's below-floor one and the seam's red-tree one — because keying
  // on the `RED TREE …` literal alone told the operator of a below-floor run that
  // the archive carried no caution banner while its README led with one.
  const readmeCautionNote = withheldTreeReadmeNote(
    emitted.files.find((f) => f.path === "README.md")?.body ?? "",
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        {entryPath ? (
          <div role="group" aria-label="Preview view" className="inline-flex rounded-md border border-border p-0.5">
            {(["preview", "files"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`min-h-8 rounded-sm px-3 text-xs capitalize ${
                  view === v ? "bg-raised text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={downloadSoftware}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-4 text-sm font-medium text-accent hover:border-accent/70"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download software (.zip)
        </button>
        {previewDoc !== null ? (
          <button type="button" onClick={openPreviewTab} className={TOOL_BTN} title="Open the rendered entry document in a new browser tab">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open in new tab
          </button>
        ) : null}
        <span className="ml-auto font-mono text-2xs text-faint">
          {KIND_LABEL[emitted.kind] ?? emitted.kind} · {emitted.files.length} files ·{" "}
          {formatBytes(treeByteSize(emitted.files))}
        </span>
      </div>

      {emitted.redTree ? (
        <div
          role="alert"
          className="mx-5 mt-2 flex items-start gap-2.5 rounded-md border border-warn/40 bg-warn-soft px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-fg">Red tree — below the build's completion bar</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-warn">
              {emitted.redTree.code} · {emitted.redTree.detail}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              This is the tree the run actually produced, shown so you can inspect and download it.
              The run's own recorded verdict withheld it from a normal emit, so it has not cleared
              the build's completion bar.{" "}
              {readmeCautionNote}
            </p>
          </div>
        </div>
      ) : null}

      <p className="px-5 pt-2 text-xs leading-relaxed text-muted">
        This is the product the emitter writes to disk for this project — produced here in the
        browser, no server folder needed. Download the ZIP and run <code className="font-mono text-fg/80">{runHint}</code>{" "}
        inside it to open the real, interactive app.
      </p>

      {!hasSubstance ? (
        <p className="mx-5 mt-2 rounded-md border border-dashed border-border px-3 py-2 text-xs leading-relaxed text-faint">
          No plan recorded yet — this is the scaffold the emitter produces for a bare brief. Run the
          pipeline to P6 and the generated substance appears here.
        </p>
      ) : null}
      {renderNote ? (
        <p className="mx-5 mt-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 font-mono text-xs leading-relaxed text-warn">
          {renderNote}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mx-5 mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mx-5 mt-2 font-mono text-xs text-ok">
          {notice}
        </p>
      ) : null}

      {!entryPath ? (
        <p className="px-5 pt-3 text-sm text-muted">
          This {KIND_LABEL[emitted.kind] ?? emitted.kind} has no HTML entry document — the emitted
          file tree is shown instead.
        </p>
      ) : null}

      {entryPath && view === "preview" ? (
        <div className="px-5 pt-3 pb-5">
          <div className="term-frame">
            <div className="term-bar" role="presentation">
              <span aria-hidden="true" className="term-dot" />
              <span aria-hidden="true" className="term-dot" />
              <span aria-hidden="true" className="term-dot" />
              <span className="term-name">{entryPath}</span>
              <span className="term-meta">
                sandboxed preview{markup ? " · rendered from the emitted UI" : ""}
              </span>
            </div>
            <iframe
              title="Emitted product preview"
              sandbox=""
              srcDoc={previewDoc ?? ""}
              className="h-[64vh] w-full bg-white"
            />
          </div>
          {emitted.kind === "game" ? (
            <p className="mt-2 text-xs leading-relaxed text-faint">
              The game shell boots a canvas at runtime, so this static view is empty — download the
              ZIP and run it to play.
            </p>
          ) : null}
          {routedSite ? (
            <p className="mt-2 text-xs leading-relaxed text-faint">
              A multi-page site: this snapshot shows the home route. The header links the emitted
              pages — download the ZIP and run <code className="font-mono text-fg/80">npm run dev</code>{" "}
              to click through Menu, About, Contact and Order.
            </p>
          ) : null}
        </div>
      ) : (
        <ol className="scroll-thin mt-3 max-h-[64vh] space-y-1 overflow-y-auto px-5 pb-5">
          {emitted.files.map((f) => {
            const isOpen = openPath === f.path;
            return (
              <li key={f.path} className="rounded-md border border-border bg-surface">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenPath(isOpen ? null : f.path)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised"
                >
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{f.path}</span>
                  <span className="shrink-0 font-mono text-2xs text-faint">
                    {formatBytes(byteSize(f.body))}
                  </span>
                </button>
                {isOpen ? (
                  <pre className="scroll-thin max-h-[44vh] overflow-auto border-t border-border bg-bg px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre text-fg/90">
                    {f.body}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
