// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 1e776d25-d838-4a5a-aabd-ad54938787b1; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the generated entry module (the file this emitter wrote) is imported
// when P6 produced one — never a path nothing writes.
// ---------------------------------------------------------------------------

import * as generated from "../jobs/search.ts";

export function Console() {
  const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = generated.listSearchRuns(
      String(data.get("id") ?? ""),
      Number(data.get("limit") ?? ""),
    );
    const output = event.currentTarget.querySelector("output");
    if (output) output.textContent = String(JSON.stringify(result));
  };
  return (
    <main>
      <h1>{"# Crumb & Bloom"}</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="rt-id">{"id"}</label>
        <input id="rt-id" name="id" defaultValue="" />
        <label htmlFor="rt-limit">{"limit"}</label>
        <input id="rt-limit" name="limit" defaultValue="" />
        <button type="submit">{"Run listSearchRuns"}</button>
        <output />
      </form>
    </main>
  );
}

export default Console;
