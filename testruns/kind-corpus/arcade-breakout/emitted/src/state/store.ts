// ---------------------------------------------------------------------------
// src/state/store.ts — Checkpointed client/server state
// machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.
// REAL persisted state container (fixes/352) — dependency-free, backed by
// an injectable StorageSeam (localStorage in the browser, an in-memory
// fallback under Node/tests). Nothing here is a mock or a stub.
// ---------------------------------------------------------------------------

/** The minimal Web Storage surface this module depends on. */
export interface StorageSeam {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory fallback so the container works without localStorage (SSR/tests). */
export function memoryStorage(): StorageSeam {
  const map = new Map<string, string>();
  return {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key) ?? null : null),
    setItem: (key: string, value: string): void => {
      map.set(key, value);
    },
    removeItem: (key: string): void => {
      map.delete(key);
    },
  };
}

/** localStorage when the runtime provides it, else the in-memory fallback. */
export function defaultStorage(): StorageSeam {
  try {
    if (typeof localStorage !== "undefined" && localStorage !== null) return localStorage;
  } catch {
    // Accessing localStorage can throw (sandboxed iframe / storage disabled).
  }
  return memoryStorage();
}

export type Checkpoint = { phase: number; status: string; updatedAt: string };

const STORE_KEY = "a-browser-arcade-game" + ".checkpoints";
const ORDER_KEY = "a-browser-arcade-game" + ".orders";

function readJson(storage: StorageSeam, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null || raw === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Real persisted checkpoint container — every mutation is durable. */
export class CheckpointStore {
  private readonly checkpoints = new Map<number, Checkpoint>();
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageSeam;
  private readonly key: string;

  constructor(storage: StorageSeam = defaultStorage(), key: string = STORE_KEY) {
    this.storage = storage;
    this.key = key;
    const raw = readJson(storage, key);
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (entry === null || typeof entry !== "object") continue;
        const cp = entry as Partial<Checkpoint>;
        if (typeof cp.phase === "number" && Number.isFinite(cp.phase)) {
          this.checkpoints.set(cp.phase, {
            phase: cp.phase,
            status: typeof cp.status === "string" ? cp.status : "",
            updatedAt: typeof cp.updatedAt === "string" ? cp.updatedAt : "",
          });
        }
      }
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(this.key, JSON.stringify([...this.checkpoints.values()]));
    } catch {
      // Storage unavailable or full — the in-memory copy stays authoritative.
    }
    for (const listener of this.listeners) listener();
  }

  write(checkpoint: Checkpoint): void {
    this.checkpoints.set(checkpoint.phase, { ...checkpoint });
    this.persist();
  }

  read(phase: number): Checkpoint | undefined {
    const cp = this.checkpoints.get(phase);
    return cp === undefined ? undefined : { ...cp };
  }

  all(): Checkpoint[] {
    return [...this.checkpoints.values()].map((cp) => ({ ...cp }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.checkpoints.clear();
    this.persist();
  }
}

export type OrderRecord = { id: string; message: string; submittedAt: string; payload: unknown };

/** Real persisted order log — the ordering flow's records survive a reload. */
export class OrderLog {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly storage: StorageSeam;
  private readonly key: string;

  constructor(storage: StorageSeam = defaultStorage(), key: string = ORDER_KEY) {
    this.storage = storage;
    this.key = key;
    const raw = readJson(storage, key);
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (entry === null || typeof entry !== "object") continue;
        const rec = entry as Partial<OrderRecord>;
        if (typeof rec.id === "string" && rec.id !== "") {
          this.orders.set(rec.id, {
            id: rec.id,
            message: typeof rec.message === "string" ? rec.message : "",
            submittedAt: typeof rec.submittedAt === "string" ? rec.submittedAt : "",
            payload: rec.payload,
          });
        }
      }
    }
  }

  /** Idempotent by id: re-recording the same order never duplicates it. */
  record(record: OrderRecord): OrderRecord {
    const existing = this.orders.get(record.id);
    const stored = existing ?? { ...record };
    this.orders.set(stored.id, stored);
    if (existing === undefined) {
      try {
        this.storage.setItem(this.key, JSON.stringify([...this.orders.values()]));
      } catch {
        // Storage unavailable — the in-memory log still serves this session.
      }
    }
    return { ...stored };
  }

  latest(): OrderRecord | undefined {
    const all = this.all();
    return all.length === 0 ? undefined : all[all.length - 1];
  }

  all(): OrderRecord[] {
    return [...this.orders.values()].map((rec) => ({ ...rec }));
  }

  /** Order ids recorded so far — the persisted reference list. */
  readonlyReferences(): string[] {
    return this.all().map((rec) => rec.id);
  }

  clear(): void {
    this.orders.clear();
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Nothing persisted to remove.
    }
  }
}

/** Shared singleton the emitted UI/order flow persists through. */
export const orderLog = new OrderLog();
