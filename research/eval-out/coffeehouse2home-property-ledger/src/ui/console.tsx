// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 6007f9af-f6d5-4b2e-9eaa-ede6f800cb6e; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the generated entry module (the file this emitter wrote) is imported
// when P6 produced one — never a path nothing writes.
// ---------------------------------------------------------------------------

import * as generated from "../generated/get-property.ts";

export function Console() {
  const exported = Object.keys(generated);
  return (
    <main>
      <h1>{"Coffeehouse2Home Property Ledger"}</h1>
      <p>generated exports ({exported.length}): {exported.join(", ") || "(none)"}</p>
    </main>
  );
}

export default Console;
