// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 729ce422-bcaa-4b79-9ec6-4840b61a458e; regenerate, don't hand-edit.
// Game shell (canvas). Assets are NOT engine-generated — see
// assets/manifest.json for the expected placeholder art roster.
// ---------------------------------------------------------------------------

export type GameHandle = { stop: () => void };

export function bootGame(root: HTMLElement): GameHandle {
  const canvas = document.createElement("canvas");
  root.appendChild(canvas);
  // TODO(E-15) stub: render loop + input per the lattice entities and the
  // asset roster in assets/manifest.json.
  return {
    stop: () => {
      canvas.remove();
    },
  };
}
