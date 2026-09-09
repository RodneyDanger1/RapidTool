// ---------------------------------------------------------------------------
// src/state/store.ts — Checkpointed client/server state
// machine-generated from RapidTool packet 16692201-777b-4cf6-b02b-a85f02e9c6a3; regenerate, don't hand-edit.
// Checkpointed state stub. TODO(E-15) stub: wire hydration from
// .rapidtool/project.json and keep every control bound to a named field.
// ---------------------------------------------------------------------------

export type Checkpoint = { phase: number; status: string; updatedAt: string };

export class CheckpointStore {
  private readonly checkpoints = new Map<number, Checkpoint>();

  write(checkpoint: Checkpoint): void {
    this.checkpoints.set(checkpoint.phase, { ...checkpoint });
  }

  read(phase: number): Checkpoint | undefined {
    return this.checkpoints.get(phase);
  }
}
