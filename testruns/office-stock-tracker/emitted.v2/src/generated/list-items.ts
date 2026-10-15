import { approve, track, show, runScan, listScanRuns, test } from "./chunk.ts";
type ItemCategory = 'Stationery' | 'Printer' | 'Kitchen' | 'Cleaning' | 'Tech';
type ItemUnit = 'each' | 'box' | 'ream' | 'pack';
type ItemStatus = 'ok' | 'low' | 'out';
type MovementReason = 'Issued' | 'Received' | 'Damaged' | 'Adjustment' | 'Stocktake';
type PRStatus = 'Open' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';

interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  unit: ItemUnit;
  qty: number;
  reorderLevel: number;
  targetQty: number;
  location: string;
  active: boolean;
  unitCost?: number;
  updatedAt?: string;
}

interface Movement {
  id: string;
  itemId: string;
  delta: number;
  reason: MovementReason;
  actor: string;
  timestamp: string;
  note: string;
  resultingQty: number;
}

interface PurchaseRequest {
  id: string;
  itemId: string;
  requestedQty: number;
  status: PRStatus;
  raisedBy: string;
  decisionNote: string;
  updatedAt?: string;
}

interface InventoryState {
  items: Item[];
  movements: Movement[];
  purchaseRequests: PurchaseRequest[];
}

interface ListQuery {
  search?: string;
  category?: ItemCategory | null;
  needsReorder?: boolean;
  sortBy?: 'name' | 'qty' | 'category';
}

interface ResultOk<T> {
  ok: true;
  value: T;
}

interface ResultErr {
  ok: false;
  error: string;
}

type Result<T> = ResultOk<T> | ResultErr;

/**
 * Internal simulated persistence slot for local state so reload restores exact state.
 * @returns stored state or null when nothing has been persisted yet
 */
let persistedState: InventoryState | null = null;

/**
 * Persist the full inventory state locally (no external service calls).
 * @param state - the state to persist
 * @returns the persisted state
 */
function persistState(state: InventoryState): InventoryState {
  persistedState = state;
  return state;
}

/**
 * Clone a state deeply so failures never leave a partially applied write.
 * @param state - the source state
 * @returns a deep copy of the state
 */
function cloneState(state: InventoryState): InventoryState {
  const items: Item[] = [];
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    items.push({
      id: it.id,
      name: it.name,
      category: it.category,
      unit: it.unit,
      qty: it.qty,
      reorderLevel: it.reorderLevel,
      targetQty: it.targetQty,
      location: it.location,
      active: it.active,
      unitCost: it.unitCost,
      updatedAt: it.updatedAt
    });
  }
  const movements: Movement[] = [];
  for (let i = 0; i < state.movements.length; i++) {
    const m = state.movements[i];
    movements.push({
      id: m.id,
      itemId: m.itemId,
      delta: m.delta,
      reason: m.reason,
      actor: m.actor,
      timestamp: m.timestamp,
      note: m.note,
      resultingQty: m.resultingQty
    });
  }
  const purchaseRequests: PurchaseRequest[] = [];
  for (let i = 0; i < state.purchaseRequests.length; i++) {
    const p = state.purchaseRequests[i];
    purchaseRequests.push({
      id: p.id,
      itemId: p.itemId,
      requestedQty: p.requestedQty,
      status: p.status,
      raisedBy: p.raisedBy,
      decisionNote: p.decisionNote,
      updatedAt: p.updatedAt
    });
  }
  return { items: items, movements: movements, purchaseRequests: purchaseRequests };
}

/**
 * Validate that a quantity is a non-negative integer.
 * @param q - candidate quantity
 * @returns true when the value is a finite non-negative integer
 */
function isNonNegativeInteger(q: number): boolean {
  return typeof q === 'number' && isFinite(q) && Math.floor(q) === q && q >= 0;
}

/**
 * Determine the deterministic id for a new movement.
 * @param state - current state
 * @param itemId - affected item id
 * @param reason - movement reason
 * @returns a deterministic movement id
 */
function nextMovementId(state: InventoryState, itemId: string, reason: MovementReason): string {
  return 'mov-' + itemId + '-' + reason + '-' + String(state.movements.length + 1);
}

/**
 * Determine the deterministic id for a new purchase request.
 * @param state - current state
 * @param itemId - affected item id
 * @returns a deterministic purchase request id
 */
function nextRequestId(state: InventoryState, itemId: string): string {
  return 'pr-' + itemId + '-' + String(state.purchaseRequests.length + 1);
}

/**
 * Compute the colour-coded stock status for an item.
 * @param item - the item to classify
 * @returns 'out' at zero qty, 'low' at or below reorder level, otherwise 'ok'
 */
function itemStatus(item: Item): ItemStatus {
  if (item.qty <= 0) {
    return 'out';
  }
  if (item.qty <= item.reorderLevel) {
    return 'low';
  }
  return 'ok';
}

/**
 * // req-1
 * List items with text search over name, category filter, needs-reorder toggle
 * (current qty <= reorder level) and sorting by name, qty or category. Each
 * returned item carries its colour-coded status through itemStatus.
 * @param items - the item collection
 * @param query - search / filter / sort options
 * @returns the filtered and sorted item list
 */
function listItems(items: Item[], query: ListQuery): Item[] {
  const q: ListQuery = query || {};
  const term: string = typeof q.search === 'string' ? q.search.trim().toLowerCase() : '';
  const filtered: Item[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (term.length > 0 && it.name.toLowerCase().indexOf(term) === -1) {
      continue;
    }
    if (q.category !== undefined && q.category !== null && it.category !== q.category) {
      continue;
    }
    if (q.needsReorder === true && it.qty > it.reorderLevel) {
      continue;
    }
    filtered.push(it);
  }
  const sortBy: string = q.sortBy === undefined ? 'name' : q.sortBy;
  filtered.sort(function (a: Item, b: Item): number {
    if (sortBy === 'qty') {
      if (a.qty !== b.qty) {
        return a.qty - b.qty;
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    }
    if (sortBy === 'category') {
      if (a.category !== b.category) {
        return a.category < b.category ? -1 : 1;
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  return filtered;
}

/**
 * // req-2
 * Issue stock from an item: refuses when quantity exceeds current stock with an
 * error naming the shortfall, otherwise writes an Issued movement with negative
 * delta and decrements stored qty atomically.
 * @param state - current inventory state
 * @param itemId - item to issue from
 * @param quantity - number of units to issue
 * @param actor - role-based actor performing the issue
 * @returns updated state or a refusal naming the shortfall
 */
function issueItem(state: InventoryState, itemId: string, quantity: number, actor: string): Result<InventoryState> {
  if (typeof actor !== 'string' || actor.trim().length === 0) {
    return { ok: false, error: 'Actor is required.' };
  }
  if (!isNonNegativeInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive integer; received ' + String(quantity) + '.' };
  }
  const draft = cloneState(state);
  let found: Item | null = null;
  for (let i = 0; i < draft.items.length; i++) {
    if (draft.items[i].id === itemId) {
      found = draft.items[i];
    }
  }
  if (found === null) {
    return { ok: false, error: 'Item ' + itemId + ' not found.' };
  }
  if (quantity > found.qty) {
    const shortfall: number = quantity - found.qty;
    return { ok: false, error: 'Insufficient stock: short by ' + String(shortfall) + '.' };
  }
  found.qty = found.qty - quantity;
  draft.movements.push({
    id: nextMovementId(draft, itemId, 'Issued'),
    itemId: itemId,
    delta: -quantity,
    reason: 'Issued',
    actor: actor,
    timestamp: '',
    note: '',
    resultingQty: found.qty
  });
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-3
 * Receive stock: increases qty, writes a Received movement with positive delta,
 * and auto-marks one qualifying Open/Approved/Ordered purchase request for the
 * item as Received in the same atomic write.
 * @param state - current inventory state
 * @param itemId - item to receive into
 * @param quantity - number of units received
 * @param actor - role-based actor performing the receipt
 * @param note - optional receipt note
 * @returns updated state or a validation failure
 */
function receiveStock(state: InventoryState, itemId: string, quantity: number, actor: string, note?: string): Result<InventoryState> {
  if (typeof actor !== 'string' || actor.trim().length === 0) {
    return { ok: false, error: 'Actor is required.' };
  }
  if (!isNonNegativeInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive integer; received ' + String(quantity) + '.' };
  }
  const draft = cloneState(state);
  let found: Item | null = null;
  for (let i = 0; i < draft.items.length; i++) {
    if (draft.items[i].id === itemId) {
      found = draft.items[i];
    }
  }
  if (found === null) {
    return { ok: false, error: 'Item ' + itemId + ' not found.' };
  }
  found.qty = found.qty + quantity;
  draft.movements.push({
    id: nextMovementId(draft, itemId, 'Received'),
    itemId: itemId,
    delta: quantity,
    reason: 'Received',
    actor: actor,
    timestamp: '',
    note: typeof note === 'string' ? note : '',
    resultingQty: found.qty
  });
  for (let i = 0; i < draft.purchaseRequests.length; i++) {
    const p = draft.purchaseRequests[i];
    if (p.itemId === itemId && (p.status === 'Open' || p.status === 'Approved' || p.status === 'Ordered')) {
      p.status = 'Received';
      break;
    }
  }
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-4
 * Adjust or damage stock. Adjustment requires a non-empty note; when a counted
 * quantity is given the delta is computed as countedQty - current (documented
 * precedence: countedQty wins over delta), never silently without a movement.
 * @param state - current inventory state
 * @param itemId - item being adjusted or damaged
 * @param input - reason, optional delta, optional counted quantity, note, actor
 * @returns updated state or a validation/refusal error
 */
function adjustStock(state: InventoryState, itemId: string, input: { reason: 'Damaged' | 'Adjustment'; delta?: number; countedQty?: number; note: string; actor: string }): Result<InventoryState> {
  const reason = input.reason;
  if (reason !== 'Damaged' && reason !== 'Adjustment') {
    return { ok: false, error: 'Reason must be Damaged or Adjustment.' };
  }
  if (typeof input.actor !== 'string' || input.actor.trim().length === 0) {
    return { ok: false, error: 'Actor is required.' };
  }
  if (reason === 'Adjustment' && (typeof input.note !== 'string' || input.note.trim().length === 0)) {
    return { ok: false, error: 'An adjustment requires a non-empty note.' };
  }
  const draft = cloneState(state);
  let found: Item | null = null;
  for (let i = 0; i < draft.items.length; i++) {
    if (draft.items[i].id === itemId) {
      found = draft.items[i];
    }
  }
  if (found === null) {
    return { ok: false, error: 'Item ' + itemId + ' not found.' };
  }
  let delta: number;
  if (input.countedQty !== undefined) {
    if (!isNonNegativeInteger(input.countedQty)) {
      return { ok: false, error: 'Counted quantity must be a non-negative integer.' };
    }
    delta = input.countedQty - found.qty;
  } else {
    if (input.delta === undefined) {
      return { ok: false, error: 'Either delta or countedQty must be provided.' };
    }
    if (typeof input.delta !== 'number' || isFinite(input.delta) === false || Math.floor(input.delta) !== input.delta) {
      return { ok: false, error: 'Delta must be an integer.' };
    }
    delta = input.delta;
  }
  const resulting = found.qty + delta;
  if (resulting < 0) {
    return { ok: false, error: 'Insufficient stock: short by ' + String(-resulting) + '.' };
  }
  found.qty = resulting;
  draft.movements.push({
    id: nextMovementId(draft, itemId, reason),
    itemId: itemId,
    delta: delta,
    reason: reason,
    actor: input.actor,
    timestamp: '',
    note: typeof input.note === 'string' ? input.note : '',
    resultingQty: resulting
  });
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-5
 * Raise a purchase request for an item: suggestedReorderQty = max(0, target - current).
 * Creates an Open request and persists it. Items at or above reorder level may
 * still be requested (documented rule) without inventing approval flows.
 * @param state - current inventory state
 * @param itemId - item to request
 * @param raisedBy - role-based actor raising the request
 * @returns updated state or a validation failure
 */
function raisePurchaseRequest(state: InventoryState, itemId: string, raisedBy: string): Result<InventoryState> {
  if (typeof raisedBy !== 'string' || raisedBy.trim().length === 0) {
    return { ok: false, error: 'Raised-by actor is required.' };
  }
  const draft = cloneState(state);
  let found: Item | null = null;
  for (let i = 0; i < draft.items.length; i++) {
    if (draft.items[i].id === itemId) {
      found = draft.items[i];
    }
  }
  if (found === null) {
    return { ok: false, error: 'Item ' + itemId + ' not found.' };
  }
  const suggested: number = suggestedReorderQty(found);
  draft.purchaseRequests.push({
    id: nextRequestId(draft, itemId),
    itemId: itemId,
    requestedQty: suggested,
    status: 'Open',
    raisedBy: raisedBy,
    decisionNote: ''
  });
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-5
 * Constrained purchase-request transition: Open->Approved->Ordered->Received,
 * Cancelled from Open/Approved/Ordered, Received terminal. Any other transition
 * is refused with an explicit status-constraint message and leaves status unchanged.
 * @param state - current inventory state
 * @param requestId - purchase request to transition
 * @param next - target status
 * @param decisionNote - optional decision note
 * @returns updated state or a status-constraint refusal
 */
function transitionPurchaseRequest(state: InventoryState, requestId: string, next: PRStatus, decisionNote?: string): Result<InventoryState> {
  const draft = cloneState(state);
  let found: PurchaseRequest | null = null;
  for (let i = 0; i < draft.purchaseRequests.length; i++) {
    if (draft.purchaseRequests[i].id === requestId) {
      found = draft.purchaseRequests[i];
    }
  }
  if (found === null) {
    return { ok: false, error: 'Purchase request ' + requestId + ' not found.' };
  }
  const current: PRStatus = found.status;
  let allowed: boolean = false;
  if (current === 'Open' && (next === 'Approved' || next === 'Cancelled')) {
    allowed = true;
  } else if (current === 'Approved' && (next === 'Ordered' || next === 'Cancelled')) {
    allowed = true;
  } else if (current === 'Ordered' && (next === 'Received' || next === 'Cancelled')) {
    allowed = true;
  }
  if (!allowed) {
    return { ok: false, error: 'Invalid status transition from ' + current + ' to ' + next + '.' };
  }
  found.status = next;
  if (typeof decisionNote === 'string') {
    found.decisionNote = decisionNote;
  }
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-5
 * Receive a purchase request: sets status to Received, writes a Received movement
 * for the requestedQty, increments item qty and persists all three atomically.
 * @param state - current inventory state
 * @param requestId - purchase request to receive
 * @param actor - role-based actor performing the receipt
 * @returns updated state or a status-constraint/validation failure
 */
function receivePurchaseRequest(state: InventoryState, requestId: string, actor: string): Result<InventoryState> {
  if (typeof actor !== 'string' || actor.trim().length === 0) {
    return { ok: false, error: 'Actor is required.' };
  }
  const draft = cloneState(state);
  let request: PurchaseRequest | null = null;
  for (let i = 0; i < draft.purchaseRequests.length; i++) {
    if (draft.purchaseRequests[i].id === requestId) {
      request = draft.purchaseRequests[i];
    }
  }
  if (request === null) {
    return { ok: false, error: 'Purchase request ' + requestId + ' not found.' };
  }
  if (request.status !== 'Ordered') {
    return { ok: false, error: 'Invalid status transition from ' + request.status + ' to Received.' };
  }
  let item: Item | null = null;
  for (let i = 0; i < draft.items.length; i++) {
    if (draft.items[i].id === request.itemId) {
      item = draft.items[i];
    }
  }
  if (item === null) {
    return { ok: false, error: 'Item ' + request.itemId + ' not found.' };
  }
  if (!isNonNegativeInteger(request.requestedQty)) {
    return { ok: false, error: 'Requested quantity is invalid.' };
  }
  item.qty = item.qty + request.requestedQty;
  draft.movements.push({
    id: nextMovementId(draft, item.id, 'Received'),
    itemId: item.id,
    delta: request.requestedQty,
    reason: 'Received',
    actor: actor,
    timestamp: '',
    note: 'Received purchase request ' + requestId,
    resultingQty: item.qty
  });
  request.status = 'Received';
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-5
 * Compute the suggested reorder quantity for an item as max(0, target - current).
 * @param item - the item to compute for
 * @returns the clamped suggested quantity
 */
function suggestedReorderQty(item: Item): number {
  const diff: number = item.targetQty - item.qty;
  if (diff < 0) {
    return 0;
  }
  return diff;
}

/**
 * Reconstruct each item's quantity by summing movement deltas and return any
 * mismatch descriptions without auto-correcting anything (req-8).
 * @param state - the inventory state to check
 * @returns descriptions of stored-vs-reconstructed mismatches
 */
function reconstructQtyInvariant(state: InventoryState): string[] {
  const problems: string[] = [];
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    let sum = 0;
    for (let m = 0; m < state.movements.length; m++) {
      if (state.movements[m].itemId === it.id) {
        sum = sum + state.movements[m].delta;
      }
    }
    if (sum !== it.qty) {
      problems.push('Item ' + it.id + ' stored qty ' + String(it.qty) + ' but movement log reconstructs ' + String(sum) + '.');
    }
  }
  return problems;
}

/**
 * // req-7
 * Format an integer-pence amount as GBP with no floating point arithmetic.
 * @param pence - integer pence amount
 * @returns GBP display string
 */
function formatGbp(pence: number): string {
  const negative: boolean = pence < 0;
  const abs: number = negative ? -pence : pence;
  const pounds: number = Math.floor(abs / 100);
  const rem: number = abs - pounds * 100;
  const remStr: string = rem < 10 ? '0' + String(rem) : String(rem);
  return (negative ? '-£' : '£') + String(pounds) + '.' + remStr;
}

/**
 * // req-7
 * Build the dashboard summary: total items, items below reorder level, open
 * purchase requests and total value on hand in integer pence (omitting items
 * with no unit cost) rendered as GBP.
 * @param state - the inventory state
 * @returns dashboard summary with counts and GBP value
 */
function dashboardSummary(state: InventoryState): { totalItems: number; belowReorder: number; openRequests: number; valueOnHandPence: number; valueOnHandGbp: string } {
  let totalItems = 0;
  let belowReorder = 0;
  let openRequests = 0;
  let valueOnHandPence = 0;
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    totalItems = totalItems + 1;
    if (it.qty <= it.reorderLevel) {
      belowReorder = belowReorder + 1;
    }
    if (typeof it.unitCost === 'number' && isFinite(it.unitCost)) {
      valueOnHandPence = valueOnHandPence + it.qty * it.unitCost;
    }
  }
  for (let i = 0; i < state.purchaseRequests.length; i++) {
    if (state.purchaseRequests[i].status === 'Open') {
      openRequests = openRequests + 1;
    }
  }
  return {
    totalItems: totalItems,
    belowReorder: belowReorder,
    openRequests: openRequests,
    valueOnHandPence: valueOnHandPence,
    valueOnHandGbp: formatGbp(valueOnHandPence)
  };
}

/**
 * // req-6
 * Run a stocktake for a category: write a Stocktake movement per counted item
 * with delta = counted - current; omitted counts write nothing.
 * @param state - current inventory state
 * @param category - category being counted
 * @param counts - map of itemId to counted quantity
 * @param actor - role-based actor performing the stocktake
 * @returns updated state or a validation failure
 */
function runCategoryStocktake(state: InventoryState, category: ItemCategory, counts: { itemId: string; countedQty: number }[], actor: string): Result<InventoryState> {
  if (typeof actor !== 'string' || actor.trim().length === 0) {
    return { ok: false, error: 'Actor is required.' };
  }
  const draft = cloneState(state);
  let written = 0;
  for (let c = 0; c < counts.length; c++) {
    const entry = counts[c];
    if (!isNonNegativeInteger(entry.countedQty)) {
      return { ok: false, error: 'Counted quantity must be a non-negative integer.' };
    }
    for (let i = 0; i < draft.items.length; i++) {
      const it = draft.items[i];
      if (it.id === entry.itemId && it.category === category) {
        const delta = entry.countedQty - it.qty;
        it.qty = entry.countedQty;
        draft.movements.push({
          id: nextMovementId(draft, it.id, 'Stocktake'),
          itemId: it.id,
          delta: delta,
          reason: 'Stocktake',
          actor: actor,
          timestamp: '',
          note: 'Stocktake of ' + category,
          resultingQty: entry.countedQty
        });
        written = written + 1;
      }
    }
  }
  if (written === 0) {
    return { ok: true, value: persistState(draft) };
  }
  return { ok: true, value: persistState(draft) };
}

/**
 * // req-6
 * Filter stocktake deltas to those strictly exceeding the configured variance
 * threshold, returning over/under rows for display.
 * @param deltas - deltas produced by a stocktake
 * @param threshold - variance threshold
 * @returns rows whose absolute delta strictly exceeds the threshold
 */
function varianceReport(deltas: { itemId: string; delta: number }[], threshold: number): { itemId: string; delta: number; direction: 'over' | 'under' }[] {
  const rows: { itemId: string; delta: number; direction: 'over' | 'under' }[] = [];
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i].delta;
    const abs = d < 0 ? -d : d;
    if (abs > threshold) {
      rows.push({ itemId: deltas[i].itemId, delta: d, direction: d > 0 ? 'over' : 'under' });
    }
  }
  return rows;
}

/**
 * // req-12
 * Load locally persisted inventory state, or initialize empty state if none exists.
 * @returns the restored inventory state
 */
function loadState(): InventoryState {
  if (persistedState === null) {
    return { items: [], movements: [], purchaseRequests: [] };
  }
  return cloneState(persistedState);
}

/**
 * // req-1
 * Render rows for the item list view, each showing qty, reorder level,
 * colour-coded status and location, with labelled table headers.
 * @param rows - the filtered/sorted items from listItems
 * @returns plain row descriptors for display
 */
function itemListRows(rows: Item[]): { id: string; name: string; qty: number; reorderLevel: number; status: ItemStatus; location: string }[] {
  const out: { id: string; name: string; qty: number; reorderLevel: number; status: ItemStatus; location: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const it = rows[i];
    out.push({ id: it.id, name: it.name, qty: it.qty, reorderLevel: it.reorderLevel, status: itemStatus(it), location: it.location });
  }
  return out;
}
export { listItems, issueItem, receiveStock, adjustStock, raisePurchaseRequest, transitionPurchaseRequest, receivePurchaseRequest, suggestedReorderQty };
