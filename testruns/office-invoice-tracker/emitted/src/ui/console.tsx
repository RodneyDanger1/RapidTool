// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet a1fbe978-6a4f-44c2-9956-d1b4f85a75b7; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the generated entry module (the file this emitter wrote) is imported
// when P6 produced one — never a path nothing writes.
// ---------------------------------------------------------------------------

import * as generated from "../generated.ts";

export function Console() {
  const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = generated.computeDueDate(
      String(data.get("issueDate") ?? ""),
      Number(data.get("termsDays") ?? ""),
    );
    const output = event.currentTarget.querySelector("output");
    if (output) output.textContent = String(JSON.stringify(result));
  };
  return (
    <main>
      <h1>{"# Ledgeline — Office"}</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="rt-issueDate">{"issueDate"}</label>
        <input id="rt-issueDate" name="issueDate" defaultValue="" />
        <label htmlFor="rt-termsDays">{"termsDays"}</label>
        <input id="rt-termsDays" name="termsDays" defaultValue="" />
        <button type="submit">{"Run computeDueDate"}</button>
        <output />
      </form>
    </main>
  );
}

export default Console;
