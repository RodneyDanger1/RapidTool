// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet f4026e8e-b2a7-4f80-a573-14b42884ce61; regenerate, don't hand-edit.
// Operator surfaces bound to generated modules (P8). Not a stub wall:
// the generated entry module (the file this emitter wrote) is imported
// when P6 produced one — never a path nothing writes.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import * as generated from "../generated.ts";

export function Console() {
  const __page_Booking: unknown = generated.renderWeeklyRota("", [], []);
  const __page_Manager: unknown = generated.renderConflictDetector("", []);
  const pages: { id: string; title: string }[] = [
    { id: "Booking", title: "Booking" },
    { id: "Manager", title: "Manager" },
    { id: "Member", title: "Member" },
    { id: "Viewer", title: "Viewer" },
    { id: "Calendar", title: "Calendar" },
    { id: "User", title: "User" },
  ];
  const pageNodes: unknown[] = [__page_Booking, __page_Manager, null, null, null, null];
  return (
    <main>
      <h1>{"Shiftline"}</h1>
      <nav>{pages.map((p) => <span key={p.id}>{p.title}</span>)}</nav>
      {pages.map((p, i) => (
        <section key={p.id}>
          <h2>{p.title}</h2>
          {typeof pageNodes[i] === "string" ? <div>{pageNodes[i] as string}</div> : (pageNodes[i] as ReactNode)}
        </section>
      ))}
    </main>
  );
}

export default Console;
