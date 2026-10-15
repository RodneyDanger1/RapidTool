// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 7251ab87-21e1-4271-a724-f88294177871; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the generated entry module (the file this emitter wrote) is imported
// when P6 produced one — never a path nothing writes.
// ---------------------------------------------------------------------------

import * as generated from "../generated.ts";

export function Console() {
  const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = generated.overlaps(
      Number(data.get("startA") ?? ""),
      Number(data.get("endA") ?? ""),
      Number(data.get("startB") ?? ""),
      Number(data.get("endB") ?? ""),
    );
    const output = event.currentTarget.querySelector("output");
    if (output) output.textContent = String(JSON.stringify(result));
  };
  return (
    <main>
      <h1>{"# Shiftline — Office"}</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="rt-startA">{"startA"}</label>
        <input id="rt-startA" name="startA" defaultValue="" />
        <label htmlFor="rt-endA">{"endA"}</label>
        <input id="rt-endA" name="endA" defaultValue="" />
        <label htmlFor="rt-startB">{"startB"}</label>
        <input id="rt-startB" name="startB" defaultValue="" />
        <label htmlFor="rt-endB">{"endB"}</label>
        <input id="rt-endB" name="endB" defaultValue="" />
        <button type="submit">{"Run overlaps"}</button>
        <output />
      </form>
    </main>
  );
}

export default Console;
