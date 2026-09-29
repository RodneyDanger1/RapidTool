// ---------------------------------------------------------------------------
// cmd-palette.tsx — cmdk command palette over the run screen's actions
// (216m · 111 TASK-10, landed W4 · L4).
//
// Why: the 34-verb surface was recall-only (documented in a 57 KB file, no
// in-app way to find an action by a plain word). Recognition-over-recall
// (source #2 of 111) says put the choice in front of the user: type "approve",
// "copy", "export" and get the matching action, its one-line plain description,
// and — where a real one exists — the canonical CLI verb chip.
//
// NO ACTION LOGIC LIVES HERE. Every entry arrives as a `CmdPaletteEntry` whose
// `run` is the SAME handler the existing action bar / dock / shortcut calls
// (111 TASK-02's rule: never a second path to run/approve). This component
// renders, filters (cmdk's default command-score filter over label + keywords)
// and dispatches — nothing else.
//
// Collision safety (111 TASK-10's stated keyboard risk): the dialog is
// CONTROLLED from console.tsx, which also suspends its global single-key
// shortcut handler while `open` is true (paletteOpenRef gate) — a bare
// "e"/"g"/"a" press inside the palette can never reach run()/onApprove()
// behind it. Radix supplies the ARIA wiring, Escape-to-close (so the focus
// containment is escapable — WCAG 2.1.2) and focus restore to the trigger.
//
// cmdk 1.1.1 and @radix-ui/react-dialog 1.1.15 are existing dependencies
// (package.json); `Command.Dialog` embeds the Radix dialog — no new
// dependency, no install.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { Command } from "cmdk";

/**
 * One palette entry: a plain-language action wired to an EXISTING handler.
 * `run` is a thunk the caller owns — the palette never re-implements an action.
 */
export type CmdPaletteEntry = {
  /** Stable id — React key only (labels are what the user searches). */
  id: string;
  /** Section heading, rendered in first-seen order. */
  group: string;
  /** Plain-language label (what it does, not what it is called). */
  label: string;
  /** One-line plain description (111 TASK-10 done-when). */
  description: string;
  /**
   * Canonical CLI verb when this action maps to one in `scripts/rapidtool-cli.mjs`;
   * null for console-only actions — the chip then says "console only" instead of
   * inventing a verb (honesty contract).
   */
  verb: string | null;
  /** Extra search words for the cmdk filter (plain-language synonyms). */
  keywords: string[];
  /** The EXISTING handler to invoke on select. */
  run: () => void;
};

/**
 * Controlled command palette. Mount once per screen that owns the entries;
 * open/close state lives with the caller (console.tsx gates its global
 * keyboard handler on the same state).
 */
export function CmdPalette({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly CmdPaletteEntry[];
}) {
  // Order-preserving grouping: Map iteration keeps first-seen section order,
  // so the caller's array order is the render order.
  const groups = useMemo(() => {
    const byGroup = new Map<string, CmdPaletteEntry[]>();
    for (const e of entries) {
      const list = byGroup.get(e.group);
      if (list) list.push(e);
      else byGroup.set(e.group, [e]);
    }
    return [...byGroup.entries()];
  }, [entries]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-50 bg-bg/80"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[92vw] max-w-[34rem] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl outline-none"
    >
      <Command.Input
        autoFocus
        aria-label="Search actions"
        placeholder="Type an action — approve, copy, export, settings…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-fg outline-none placeholder:text-faint"
      />
      {/* `scroll-thin` = the shared treatment for capped lists (styles.css
          names it "every capped list"); the console applies it to its 13
          capped lists, so the palette's list joins them. */}
      <Command.List className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          No action matches that word. Try “approve”, “copy”, “export” or “settings”.
        </Command.Empty>
        {groups.map(([group, items]) => (
          <Command.Group
            key={group}
            heading={group}
            className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
          >
            {items.map((e) => (
              <Command.Item
                key={e.id}
                value={`${e.label} ${e.verb ?? ""}`.trim()}
                keywords={e.keywords}
                onSelect={() => {
                  // Close first: an action may itself open another surface.
                  onOpenChange(false);
                  e.run();
                }}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-md px-2.5 py-2 data-[selected=true]:bg-raised"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-fg">{e.label}</span>
                  <span className="text-xs text-muted">{e.description}</span>
                </span>
                {e.verb !== null ? (
                  <code className="mt-0.5 shrink-0 rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-xs text-accent">
                    rapidtool {e.verb}
                  </code>
                ) : (
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-faint">console only</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
      <p className="border-t border-line px-4 py-2 font-mono text-xs text-faint">
        Esc closes · single-key shortcuts are paused while this is open
      </p>
    </Command.Dialog>
  );
}
