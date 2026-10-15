type Category = 'Stationery' | 'Printer' | 'Kitchen' | 'Cleaning' | 'Tech';
type Unit = 'each' | 'box' | 'ream' | 'pack';
type MovementReason = 'Issued' | 'Received' | 'Damaged' | 'Adjustment' | 'Stocktake';
type RequestStatus = 'Open' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';

interface Item {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  currentQty: number;
  reorderLevel: number;
  targetQty: number;
  location: string;
  active: boolean;
  unitCostPence?: number;
}

interface Movement {
  id: string;
  itemId: string;
  delta: number;
  reason: MovementReason;
  actor: string;
  timestamp: string;
  note?: string;
  resultingQty: number;
}

interface PurchaseRequest {
  id: string;
  itemId: string;
  requestedQty: number;
  status: RequestStatus;
  raisedBy: string;
  decisionNote?: string;
}

interface ItemQuery {
  search?: string;
  category?: Category;
  needsReorder?: boolean;
  sortBy?: 'name' | 'qty' | 'category';
}

interface StoreShape {
  items: Item[];
  movements: Movement[];
  requests: PurchaseRequest[];
  sequence: number;
}

interface InvariantResult {
  itemId: string;
  storedQty: number;
  reconstructedQty: number;
  ok: boolean;
}

interface VarianceRow {
  itemId: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
  status: string;
}

interface DashboardView {
  totalItems: number;
  belowReorder: number;
  openRequests: number;
  totalValuePence: number;
  totalValueGbp: string;
}

interface OperationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

type StocktakeOutcome = { movements: Movement[]; varianceReport: VarianceRow[]; error?: string };

const OFFICES_TOCK_CATEGORIES: Category[] = ['Stationery', 'Printer', 'Kitchen', 'Cleaning', 'Tech'];
const OFFICES_TOOCK_UNITS: Unit[] = ['each', 'box', 'ream', 'pack'];
const OFFICE_STOCK_REASONS: MovementReason[] = ['Issued', 'Received', 'Damaged', 'Adjustment', 'Stocktake'];
const OFFICE_STOCK_STATUSES: RequestStatus[] = ['Open', 'Approved', 'Ordered', 'Received', 'Cancelled'];

const officeSuppliesInventoryStore: StoreShape = {
  items: [],
  movements: [],
  requests: [],
  sequence: 0
};

/**
 * Returns the in-memory office supplies inventory tracker store.
 * // req-11
 */
function officeSuppliesInventoryTracker(): StoreShape {
  return officeSuppliesInventoryStore;
}

/**
 * Determines whether a supplied stock category name is valid.
 */
function officeSuppliesIsCategory(value: string): boolean {
  let index: number = 0;
  while (index < OFFICES_TOCK_CATEGORIES.length) {
    if (OFFICES_TOCK_CATEGORIES[index] === value) {
      return true;
    }
    index = index + 1;
  }
  return false;
}

/**
 * Validates an inventory quantity: integer and non-negative.
 */
function officeSuppliesIsQty(value: number): boolean {
  if (typeof value !== 'number') {
    return false;
  }
  if (value !== Math.floor(value)) {
    return false;
  }
  if (value < 0) {
    return false;
  }
  return true;
}

/**
 * Formats an integer pence total as a GBP string without floating point drift.
 */
function officeSuppliesGbpFromPence(pence: number): string {
  const safe: number = officeSuppliesIsQty(pence) ? pence : 0;
  const whole: number = Math.floor(safe / 100);
  const fraction: number = safe - whole * 100;
  const fractionText: string = fraction < 10 ? '0' + String(fraction) : String(fraction);
  return '£' + String(whole) + '.' + fractionText;
}

/**
 * Deterministically derives the next office supplies movement identifier.
 */
function officeSuppliesNextMovementId(store: StoreShape): string {
  store.sequence = store.sequence + 1;
  return 'MOV-' + String(store.sequence);
}

/**
 * Deterministically derives the next purchase request identifier.
 */
function officeSuppliesNextRequestId(store: StoreShape): string {
  store.sequence = store.sequence + 1;
  return 'PR-' + String(store.sequence);
}

/**
 * Computes the running sum of movements for an office supplies item.
 */
function officeSuppliesReconstructedQty(movements: Movement[], itemId: string): number {
  let total: number = 0;
  let index: number = 0;
  while (index < movements.length) {
    if (movements[index].itemId === itemId) {
      total = total + movements[index].delta;
    }
    index = index + 1;
  }
  return total;
}

/**
 * Finds an office supplies inventory item by identifier.
 */
function officeSuppliesFindItem(store: StoreShape, itemId: string): Item | undefined {
  let index: number = 0;
  while (index < store.items.length) {
    if (store.items[index].id === itemId) {
      return store.items[index];
    }
    index = index + 1;
  }
  return undefined;
}

/**
 * Reports whether a needs-reorder item sits at or below its reorder level.
 */
function officeSuppliesNeedsReorder(item: Item): boolean {
  return item.currentQty <= item.reorderLevel;
}

/**
 * Derives the colour-coded status for an office supplies inventory row.
 */
function officeSuppliesStatusLabel(item: Item): string {
  if (!item.active) {
    return 'Inactive';
  }
  if (item.currentQty <= 0) {
    return 'Out of stock';
  }
  if (item.currentQty <= item.reorderLevel) {
    return 'Reorder';
  }
  return 'OK';
}

/**
 * Sorts office supplies inventory rows by name, qty, or category.
 */
function officeSuppliesSortRows(rows: Item[], sortBy: 'name' | 'qty' | 'category'): Item[] {
  const copy: Item[] = rows.slice(0);
  copy.sort(function (a: Item, b: Item): number {
    if (sortBy === 'qty') {
      return a.currentQty - b.currentQty;
    }
    if (sortBy === 'category') {
      if (a.category < b.category) {
        return -1;
      }
      if (a.category > b.category) {
        return 1;
      }
      return 0;
    }
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });
  return copy;
}

/**
 * Lists office supplies inventory rows with search, category filter,
 * needs-reorder toggle, status/location columns and sorting.
 * // req-4
 */
async function listItems(query: ItemQuery): Promise<Item[]> {
  const store: StoreShape = officeSuppliesInventoryTracker();
  let rows: Item[] = [];
  let index: number = 0;
  while (index < store.items.length) {
    const candidate: Item = store.items[index];
    let keep: boolean = true;
    if (query.search !== undefined && query.search !== '') {
      const needle: string = query.search.toLowerCase();
      const haystack: string = candidate.name.toLowerCase() + ' ' + candidate.location.toLowerCase();
      if (haystack.indexOf(needle) < 0) {
        keep = false;
      }
    }
    if (query.category !== undefined && candidate.category !== query.category) {
      keep = false;
    }
    if (query.needsReorder === true && !officeSuppliesNeedsReorder(candidate)) {
      keep = false;
    }
    if (keep) {
      rows.push(candidate);
    }
    index = index + 1;
  }
  const sortBy: 'name' | 'qty' | 'category' = query.sortBy === undefined ? 'name' : query.sortBy;
  return officeSuppliesSortRows(rows, sortBy);
}

/**
 * Issues an office supplies item to staff, refusing when quantity exceeds stock.
 * // req-5
 */
async function issueItem(itemId: string, quantity: number, actor: string): Promise<OperationResult<Movement>> {
  if (!officeSuppliesIsQty(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive integer' };
  }
  const store: StoreShape = officeSuppliesInventoryTracker();
  const item: Item | undefined = officeSuppliesFindItem(store, itemId);
  if (item === undefined) {
    return { ok: false, error: 'Item not found: ' + itemId };
  }
  if (quantity > item.currentQty) {
    const shortfall: number = quantity - item.currentQty;
    return { ok: false, error: 'Insufficient stock, shortfall of ' + String(shortfall) + ' ' + item.unit };
  }
  const resulting: number = item.currentQty - quantity;
  if (resulting < 0) {
    return { ok: false, error: 'Stock never goes negative for ' + itemId };
  }
  const movement: Movement = {
    id: officeSuppliesNextMovementId(store),
    itemId: item.id,
    delta: -quantity,
    reason: 'Issued',
    actor: actor,
    timestamp: 'T' + String(store.sequence),
    resultingQty: resulting
  };
  item.currentQty = resulting;
  store.movements.push(movement);
  return { ok: true, value: movement };
}

/**
 * Receives a delivery for an office supplies item, marking a matching request Received.
 * // req-6
 */
async function receiveStock(itemId: string, quantity: number, actor: string, note?: string): Promise<OperationResult<Movement>> {
  if (!officeSuppliesIsQty(quantity) || quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive integer' };
  }
  const store: StoreShape = officeSuppliesInventoryTracker();
  const item: Item | undefined = officeSuppliesFindItem(store, itemId);
  if (item === undefined) {
    return { ok: false, error: 'Item not found: ' + itemId };
  }
  const resulting: number = item.currentQty + quantity;
  if (resulting < 0) {
    return { ok: false, error: 'Stock never goes negative for ' + itemId };
  }
  const movement: Movement = {
    id: officeSuppliesNextMovementId(store),
    itemId: item.id,
    delta: quantity,
    reason: 'Received',
    actor: actor,
    timestamp: 'T' + String(store.sequence),
    resultingQty: resulting
  };
  if (note !== undefined && note !== '') {
    movement.note = note;
  }
  item.currentQty = resulting;
  store.movements.push(movement);
  let index: number = 0;
  let chosenIndex: number = -1;
  while (index < store.requests.length) {
    const candidate: PurchaseRequest = store.requests[index];
    if (candidate.itemId === itemId) {
      if (candidate.status === 'Open' || candidate.status === 'Approved' || candidate.status === 'Ordered') {
        if (chosenIndex < 0 || candidate.id < store.requests[chosenIndex].id) {
          chosenIndex = index;
        }
      }
    }
    index = index + 1;
  }
  if (chosenIndex >= 0) {
    store.requests[chosenIndex].status = 'Received';
  }
  return { ok: true, value: movement };
}

/**
 * Records a Damaged or Adjustment movement for an office supplies item.
 * // req-7
 */
async function adjustItem(itemId: string, reason: MovementReason, quantity: number, actor: string, note?: string, counted?: number): Promise<OperationResult<Movement>> {
  if (reason !== 'Damaged' && reason !== 'Adjustment') {
    return { ok: false, error: 'Reason must be Damaged or Adjustment' };
  }
  const store: StoreShape = officeSuppliesInventoryTracker();
  const item: Item | undefined = officeSuppliesFindItem(store, itemId);
  if (item === undefined) {
    return { ok: false, error: 'Item not found: ' + itemId };
  }
  let delta: number = 0;
  if (reason === 'Adjustment') {
    if (note === undefined || note.trim() === '') {
      return { ok: false, error: 'Adjustment requires a non-empty note' };
    }
    if (counted === undefined || !officeSuppliesIsQty(counted)) {
      return { ok: false, error: 'Adjustment requires a counted quantity' };
    }
    delta = counted - item.currentQty;
  } else {
    if (!officeSuppliesIsQty(quantity) || quantity <= 0) {
      return { ok: false, error: 'Quantity must be a positive integer' };
    }
    delta = -quantity;
  }
  const resulting: number = item.currentQty + delta;
  if (resulting < 0) {
    return { ok: false, error: 'Refused: would drive stock negative for ' + itemId };
  }
  const movement: Movement = {
    id: officeSuppliesNextMovementId(store),
    itemId: item.id,
    delta: delta,
    reason: reason,
    actor: actor,
    timestamp: 'T' + String(store.sequence),
    resultingQty: resulting
  };
  if (note !== undefined && note !== '') {
    movement.note = note;
  }
  item.currentQty = resulting;
  store.movements.push(movement);
  return { ok: true, value: movement };
}

/**
 * Computes the suggested reorder quantity max(0, target - current).
 * // req-8
 */
function suggestedReorderQty(item: Item): number {
  const raw: number = item.targetQty - item.currentQty;
  if (raw < 0) {
    return 0;
  }
  return raw;
}

/**
 * Raises a purchase request for a below-reorder office supplies item.
 * // req-8
 */
async function raisePurchaseRequest(itemId: string, raisedBy: string): Promise<OperationResult<PurchaseRequest>> {
  const store: StoreShape = officeSuppliesInventoryTracker();
  const item: Item | undefined = officeSuppliesFindItem(store, itemId);
  if (item === undefined) {
    return { ok: false, error: 'Item not found: ' + itemId };
  }
  if (!officeSuppliesNeedsReorder(item)) {
    return { ok: false, error: 'Item is not below reorder level' };
  }
  const request: PurchaseRequest = {
    id: officeSuppliesNextRequestId(store),
    itemId: item.id,
    requestedQty: suggestedReorderQty(item),
    status: 'Open',
    raisedBy: raisedBy
  };
  store.requests.push(request);
  return { ok: true, value: request };
}

/**
 * Determines whether an office supplies request transition is permitted.
 */
function officeSuppliesTransitionAllowed(from: RequestStatus, to: RequestStatus): boolean {
  if (from === 'Received' || from === 'Cancelled') {
    return false;
  }
  if (to === 'Cancelled') {
    return from === 'Open' || from === 'Approved' || from === 'Ordered';
  }
  if (from === 'Open' && to === 'Approved') {
    return true;
  }
  if (from === 'Approved' && to === 'Ordered') {
    return true;
  }
  if (from === 'Ordered' && to === 'Received') {
    return true;
  }
  return false;
}

/**
 * Transitions a purchase request with constrained status transitions.
 * // req-8
 */
async function transitionPurchaseRequest(requestId: string, target: RequestStatus, decisionNote?: string): Promise<OperationResult<PurchaseRequest>> {
  const store: StoreShape = officeSuppliesInventoryTracker();
  let index: number = 0;
  let found: PurchaseRequest | undefined = undefined;
  while (index < store.requests.length) {
    if (store.requests[index].id === requestId) {
      found = store.requests[index];
    }
    index = index + 1;
  }
  if (found === undefined) {
    return { ok: false, error: 'Request not found: ' + requestId };
  }
  let validTarget: boolean = false;
  let k: number = 0;
  while (k < OFFICE_STOCK_STATUSES.length) {
    if (OFFICE_STOCK_STATUSES[k] === target) {
      validTarget = true;
    }
    k = k + 1;
  }
  if (!validTarget) {
    return { ok: false, error: 'Unknown request status: ' + target };
  }
  if (!officeSuppliesTransitionAllowed(found.status, target)) {
    return { ok: false, error: 'Cannot move request from ' + found.status + ' to ' + target };
  }
  if (target === 'Received') {
    const item: Item | undefined = officeSuppliesFindItem(store, found.itemId);
    if (item === undefined) {
      return { ok: false, error: 'Item not found: ' + found.itemId };
    }
    const resulting: number = item.currentQty + found.requestedQty;
    const movement: Movement = {
      id: officeSuppliesNextMovementId(store),
      itemId: item.id,
      delta: found.requestedQty,
      reason: 'Received',
      actor: found.raisedBy,
      timestamp: 'T' + String(store.sequence),
      resultingQty: resulting
    };
    item.currentQty = resulting;
    store.movements.push(movement);
  }
  found.status = target;
  if (decisionNote !== undefined && decisionNote !== '') {
    found.decisionNote = decisionNote;
  }
  return { ok: true, value: found };
}

/**
 * Runs a stocktake over a category, writing Stocktake movements and a variance report.
 * // req-9
 */
async function runStocktake(category: Category, counts: { itemId: string; countedQty: number }[], threshold: number): Promise<OperationResult<StocktakeOutcome>> {
  if (!officeSuppliesIsCategory(category)) {
    return { ok: false, error: 'Unknown category: ' + category };
  }
  const store: StoreShape = officeSuppliesInventoryTracker();
  const movements: Movement[] = [];
  const varianceReport: VarianceRow[] = [];
  let index: number = 0;
  while (index < store.items.length) {
    const item: Item = store.items[index];
    if (item.category === category && item.active) {
      let c: number = 0;
      let counted: number | undefined = undefined;
      while (c < counts.length) {
        if (counts[c].itemId === item.id) {
          counted = counts[c].countedQty;
        }
        c = c + 1;
      }
      if (counted !== undefined && officeSuppliesIsQty(counted)) {
        const delta: number = counted - item.currentQty;
        const resulting: number = item.currentQty + delta;
        if (resulting >= 0) {
          const movement: Movement = {
            id: officeSuppliesNextMovementId(store),
            itemId: item.id,
            delta: delta,
            reason: 'Stocktake',
            actor: 'stocktake',
            timestamp: 'T' + String(store.sequence),
            resultingQty: resulting
          };
          item.currentQty = resulting;
          store.movements.push(movement);
          movements.push(movement);
          if (Math.abs(delta) > threshold) {
            varianceReport.push({
              itemId: item.id,
              name: item.name,
              expectedQty: item.currentQty - delta,
              countedQty: counted,
              variance: delta,
              status: delta > 0 ? 'Over' : 'Under'
            });
          }
        }
      }
    }
    index = index + 1;
  }
  return { ok: true, value: { movements: movements, varianceReport: varianceReport } };
}

/**
 * Builds the dashboard view with item counts, open requests, and GBP value on hand.
 * // req-10
 */
async function getDashboard(): Promise<DashboardView> {
  const store: StoreShape = officeSuppliesInventoryTracker();
  let belowReorder: number = 0;
  let totalValuePence: number = 0;
  let index: number = 0;
  while (index < store.items.length) {
    const item: Item = store.items[index];
    if (officeSuppliesNeedsReorder(item)) {
      belowReorder = belowReorder + 1;
    }
    if (item.unitCostPence !== undefined) {
      totalValuePence = totalValuePence + item.currentQty * item.unitCostPence;
    }
    index = index + 1;
  }
  let openRequests: number = 0;
  let r: number = 0;
  while (r < store.requests.length) {
    if (store.requests[r].status === 'Open') {
      openRequests = openRequests + 1;
    }
    r = r + 1;
  }
  return {
    totalItems: store.items.length,
    belowReorder: belowReorder,
    openRequests: openRequests,
    totalValuePence: totalValuePence,
    totalValueGbp: officeSuppliesGbpFromPence(totalValuePence)
  };
}

/**
 * Reconstructs each office supplies item qty from movements and compares to stored qty.
 * // req-12
 */
async function checkInvariant(itemId?: string): Promise<InvariantResult[]> {
  const store: StoreShape = officeSuppliesInventoryTracker();
  const results: InvariantResult[] = [];
  let index: number = 0;
  while (index < store.items.length) {
    const item: Item = store.items[index];
    if (itemId === undefined || item.id === itemId) {
      const reconstructed: number = officeSuppliesReconstructedQty(store.movements, item.id);
      results.push({
        itemId: item.id,
        storedQty: item.currentQty,
        reconstructedQty: reconstructed,
        ok: reconstructed === item.currentQty
      });
    }
    index = index + 1;
  }
  return results;
}
export { listItems, issueItem, receiveStock, adjustItem, raisePurchaseRequest, transitionPurchaseRequest, suggestedReorderQty, runStocktake, getDashboard, checkInvariant };
