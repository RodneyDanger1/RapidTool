// Throwaway probe 4 — engine paths with garbage artifact rows (register evidence).
import { emptyProject, applyPhaseResult } from "./src/lib/engine.ts";
import type { Project } from "./src/lib/types.ts";
const base = (): Project => emptyProject({ name: "Probe", brief: "Build a probe tool" });
try {
  const p = base();
  (p.artifacts as unknown[]).push(null);
  applyPhaseResult(p, 0);
  console.log("OK    applyPhaseResult with null artifact row");
} catch (e) {
  console.log(`THROW applyPhaseResult null artifact — ${e instanceof Error ? e.message : String(e)}`);
}
try {
  const p = base();
  p.currentPhase = 0;
  const { stampPacket } = await import("./src/lib/engine.ts");
  (p.artifacts as unknown[]).push(null);
  stampPacket(p);
  console.log("OK    stampPacket with null artifact row");
} catch (e) {
  console.log(`THROW stampPacket null artifact — ${e instanceof Error ? e.message : String(e)}`);
}
