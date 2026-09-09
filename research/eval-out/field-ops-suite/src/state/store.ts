// ---------------------------------------------------------------------------
// src/state/store.ts — Checkpointed client/server state
// machine-generated from RapidTool packet 4cd56084-1d37-42f5-b025-b7e1304f8e31; regenerate, don't hand-edit.
// Checkpointed state stub. TODO(E-15 stub): wire hydration from
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
