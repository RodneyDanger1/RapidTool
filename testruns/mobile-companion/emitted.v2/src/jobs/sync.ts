import { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence } from "../generated/render-tab-bar.ts";
import { formatGbp, quickAddCustomer, validateOrder, placeOrder, stockBadgeLevel, suggestReorderQuantity, markReordered, getPendingChanges } from "../generated/format-gbp.ts";
import { renderPendingBadge, loadLocalSnapshot } from "../generated/render-pending-badge.ts";
import { recordReceive, recordSpoilage } from "./record.ts";
type PendingChange = {
  id: string;
  entity: string;
  operation: string;
  payload: unknown;
  queuedAt: string;
};

type SyncOutcome = {
  synced: boolean;
  confirmedIds: string[];
  pendingIds: string[];
  message: string;
  retryable: boolean;
};

function normalizeChange(raw: PendingChange): PendingChange {
  return {
    id: typeof raw.id === 'string' ? raw.id : 'unknown',
    entity: typeof raw.entity === 'string' ? raw.entity : 'unknown',
    operation: typeof raw.operation === 'string' ? raw.operation : 'update',
    payload: raw.payload,
    queuedAt: typeof raw.queuedAt === 'string' ? raw.queuedAt : '',
  };
}

/**
 * Syncs all locally queued pending changes against the backend sync endpoint.
 *
 * Each change is submitted to POST /v1/sync with its entity, operation and payload.
 * A change is only confirmed when the backend response explicitly confirms its id;
 * otherwise it stays pending. If the backend is unreachable or the request fails, no
 * change is ever reported as synced and the full set remains pending with a retryable
 * outcome so the pending badge stays visible.
 *
 * // req-9
 *
 * @param changes - the list of pending local changes to synchronize
 * @returns a SyncOutcome describing which changes were confirmed and which remain pending
 */
async function syncPendingChanges(changes: PendingChange[]): Promise<SyncOutcome> {
  if (!Array.isArray(changes) || changes.length === 0) {
    return {
      synced: false,
      confirmedIds: [],
      pendingIds: [],
      message: 'No pending changes to sync.',
      retryable: false,
    };
  }

  const normalized: PendingChange[] = [];
  for (let i = 0; i < changes.length; i++) {
    normalized.push(normalizeChange(changes[i]));
  }

  const allIds: string[] = [];
  for (let i = 0; i < normalized.length; i++) {
    allIds.push(normalized[i].id);
  }

  let response: unknown;
  try {
    response = await postSync(normalized);
  } catch (err: unknown) {
    const detail: string = err instanceof Error ? err.message : 'Network request failed';
    return {
      synced: false,
      confirmedIds: [],
      pendingIds: allIds,
      message: 'Sync failed: ' + detail + '. Changes remain pending.',
      retryable: true,
    };
  }

  const confirmedIds: string[] = extractConfirmedIds(response);
  const confirmedSet: Record<string, boolean> = {};
  for (let i = 0; i < confirmedIds.length; i++) {
    confirmedSet[confirmedIds[i]] = true;
  }

  const stillPending: string[] = [];
  for (let i = 0; i < allIds.length; i++) {
    if (confirmedSet[allIds[i]] !== true) {
      stillPending.push(allIds[i]);
    }
  }

  if (confirmedIds.length === 0) {
    return {
      synced: false,
      confirmedIds: [],
      pendingIds: stillPending,
      message: 'Backend did not confirm any changes. They remain pending.',
      retryable: true,
    };
  }

  if (stillPending.length > 0) {
    return {
      synced: false,
      confirmedIds: confirmedIds,
      pendingIds: stillPending,
      message: confirmedIds.length + ' change(s) confirmed, ' + stillPending.length + ' still pending.',
      retryable: true,
    };
  }

  return {
    synced: true,
    confirmedIds: confirmedIds,
    pendingIds: [],
    message: 'All ' + confirmedIds.length + ' change(s) synced.',
    retryable: false,
  };
}

async function postSync(changes: PendingChange[]): Promise<unknown> {
  const body: string = JSON.stringify({ endpoint: '/v1/sync', changes: changes });
  const res: Response = await actualFetch('/v1/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
  });
  if (!res.ok) {
    throw new Error('Sync request failed with status ' + String(res.status));
  }
  return await res.json();
}

function extractConfirmedIds(response: unknown): string[] {
  const ids: string[] = [];
  if (response === null || typeof response !== 'object') {
    return ids;
  }
  const record: Record<string, unknown> = response as Record<string, unknown>;
  const raw: unknown = record.confirmedIds !== undefined ? record.confirmedIds : record.acceptedIds;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const candidate: unknown = raw[i];
      if (typeof candidate === 'string') {
        ids.push(candidate);
      }
    }
  }
  return ids;
}

type Response = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type FetchOptions = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

declare function actualFetch(url: string, options: FetchOptions): Promise<Response>;
export { syncPendingChanges };
