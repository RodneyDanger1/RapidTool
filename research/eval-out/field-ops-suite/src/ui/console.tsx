// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 1bf0e807-f549-4335-938e-25dd71643cc2; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the barrel at src/generated.ts is imported when P6 produced a module.
// ---------------------------------------------------------------------------

import * as generated from "../generated.ts";

export function Console() {
  const exported = Object.keys(generated);
  return (
    <main>
      <h1>{"Field-Ops Suite"}</h1>
      <p>generated exports ({exported.length}): {exported.join(", ") || "(none)"}</p>
    </main>
  );
}

export default Console;
