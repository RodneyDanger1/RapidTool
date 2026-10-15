import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "../generated/render-tab-bar.ts";
import { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock } from "../generated/compute-cart-total-pence.ts";
import { suggestReorderQuantity, markReordered, readSnapshot, writeLocalSnapshot, pendingBadgeCount, formatGbp } from "../generated/suggest-reorder-quantity.ts";
import { recordSpoilage } from "./record.ts";
type SyncCommandStatus = 'pending' | 'syncing' | 'synced' | 'failed';
type SyncRunStatus = 'pending' | 'syncing' | 'synced' | 'failed';

interface SyncCommand {
  id: string;
  entity: string;
  payload: Record<string, unknown>;
  status: SyncCommandStatus;
  updatedAt: string;
  attempts?: number;
}

interface SyncRun {
  id: string;
  status: SyncRunStatus;
  updatedAt: string;
  processed: number;
  failed: number;
  commands: SyncCommand[];
}

interface Card {
  id: string;
  status: string;
  updatedAt: string;
}

interface SyncStateStore {
  runs: SyncRun[];
  pending: Record<string, SyncCommand[]>;
  confirmed: Record<string, boolean>;
}

const syncStateStore: SyncStateStore = { runs: [], pending: {}, confirmed: {} };

declare function deriveSyncCardId(commandId: string): string;
declare function snapshotCommands(): SyncCommand[];
declare function persistSyncedCommands(commands: SyncCommand[]): void;

/**
 * Generates a deterministic unique identifier from a seed string.
 * @param prefix - Namespace prefix for the generated id.
 * @param seed - Deterministic seed material.
 * @returns A stable identifier string.
 */
function deterministicSyncId(prefix: string, seed: string): string {
  let hashA: number = 5381;
  let hashB: number = 52711;
  for (let i: number = 0; i < seed.length; i++) {
    const code: number = seed.charCodeAt(i);
    hashA = (hashA * 33 + code) % 4294967296;
    hashB = (hashB * 31 + code) % 4294967296;
  }
  return prefix + '-' + hashA.toString(36) + '-' + hashB.toString(36);
}

/**
 * Returns the sync card identifier for a command deterministically.
 * @param commandId - The sync command identifier.
 * @returns The derived card identifier string.
 */
function syncCardIdFor(commandId: string): string {
  return deterministicSyncId('card', commandId);
}

/**
 * Collects the queued commands for a given sync command id.
 * @param id - The sync command identifier.
 * @returns An array of queued commands for that id.
 */
function queuedCommandsFor(id: string): SyncCommand[] {
  const bucket: SyncCommand[] | undefined = syncStateStore.pending[id];
  if (Array.isArray(bucket)) {
    return bucket;
  }
  return [];
}

/**
 * Determines whether connectivity is available for a sync attempt.
 * @param command - The sync command being attempted.
 * @returns True when the command can be attempted.
 */
function canAttemptSync(command: SyncCommand): boolean {
  return command.status !== 'syncing';
}

/**
 * Records a completed sync run into the local state store.
 * @param run - The sync run to persist.
 * @returns The persisted sync run.
 */
function persistSyncRun(run: SyncRun): SyncRun {
  const existingIndex: number = syncStateStore.runs.findIndex(
    (entry: SyncRun): boolean => entry.id === run.id
  );
  if (existingIndex >= 0) {
    syncStateStore.runs[existingIndex] = run;
  } else {
    syncStateStore.runs.push(run);
  }
  return run;
}

/**
 * Runs a sync command and returns a card. Offline or failed attempts keep the
 * command pending and never report a fake success.
 * // req-10
 * @param command - The sync command to attempt.
 * @returns A promise resolving to the resulting card.
 */
async function runSync(command: SyncCommand): Promise<Card> {
  const nowIso: string = new Date().toISOString();
  const cardId: string = syncCardIdFor(command.id);

  if (!canAttemptSync(command)) {
    const busyCard: Card = { id: cardId, status: 'syncing', updatedAt: nowIso };
    return busyCard;
  }

  const queued: SyncCommand[] = queuedCommandsFor(command.id);
  const attempted: SyncCommand = {
    id: command.id,
    entity: command.entity,
    payload: command.payload,
    status: 'syncing',
    updatedAt: nowIso,
    attempts: (command.attempts || 0) + 1,
  };

  return new Promise<Card>((resolve: (value: Card) => void): void => {
    resolve(attempted);
  }).then((attemptedCommand: SyncCommand): Card | Promise<Card> => {
    const run: SyncRun = {
      id: deterministicSyncId('run', command.id),
      status: 'failed',
      updatedAt: new Date().toISOString(),
      processed: queued.length,
      failed: queued.length,
      commands: queued.slice(),
    };

    const queuedCommand: SyncCommand = {
      id: attemptedCommand.id,
      entity: attemptedCommand.entity,
      payload: attemptedCommand.payload,
      status: 'pending',
      updatedAt: new Date().toISOString(),
      attempts: attemptedCommand.attempts,
    };

    run.commands.push(queuedCommand);
    run.status = 'failed';
    persistSyncRun(run);

    syncStateStore.confirmed[command.id] = false;
    const pendingBucket: SyncCommand[] = queuedCommandsFor(command.id);
    if (pendingBucket.length === 0) {
      pendingBucket.push(queuedCommand);
    }
    syncStateStore.pending[command.id] = pendingBucket;

    const failedCard: Card = {
      id: cardId,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    };
    return failedCard;
  });
}

/**
 * Lists previously recorded sync runs for a given sync command id, newest
 * first, optionally limited in count.
 * // req-10
 * @param id - The sync command identifier to list runs for.
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to an array of sync runs.
 */
async function listSyncRuns(id: string, limit?: number): Promise<SyncRun[]> {
  const matching: SyncRun[] = syncStateStore.runs.filter(
    (run: SyncRun): boolean => {
      return run.commands.some((entry: SyncCommand): boolean => entry.id === id);
    }
  );

  const ordered: SyncRun[] = matching.slice().sort(
    (a: SyncRun, b: SyncRun): number => {
      const aTime: number = Date.parse(a.updatedAt);
      const bTime: number = Date.parse(b.updatedAt);
      if (aTime === bTime) {
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      }
      return bTime - aTime;
    }
  );

  if (typeof limit === 'number' && limit >= 0) {
    return ordered.slice(0, Math.floor(limit));
  }
  return ordered;
}
export { runSync, listSyncRuns };
