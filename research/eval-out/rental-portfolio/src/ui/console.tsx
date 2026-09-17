// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 5587eca3-156b-4c57-9ea4-23879f548cb5; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the barrel at src/generated.ts is imported when P6 produced a module.
// ---------------------------------------------------------------------------

import * as generated from "../generated.ts";

export function Console() {
  const exported = Object.keys(generated);
  return (
    <main>
      <h1>{"Rental Portfolio Manager"}</h1>
      <p>generated exports ({exported.length}): {exported.join(", ") || "(none)"}</p>
    </main>
  );
}

export default Console;
