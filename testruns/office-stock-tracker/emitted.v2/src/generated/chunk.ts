type Category = 'Stationery' | 'Printer' | 'Kitchen' | 'Cleaning' | 'Tech';
type Unit = 'each' | 'box' | 'ream' | 'pack';
type MovementReason = 'Issued' | 'Received' | 'Damaged' | 'Adjustment' | 'Stocktake';
type PRStatus = 'Open' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';

interface Item {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  qty: number;
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
}

interface ListQuery {
  search?: string;
  category?: Category;
  needsReorderOnly?: boolean;
  sortBy?: 'name' | 'qty' | 'category';
}

interface ApproveInput {
  requestId: string;
  actor: string;
  note: string;
  requests: PurchaseRequest[];
}

interface TrackInput {
  items: Item[];
  movements: Movement[];
}

interface ShowInput {
  items: Item[];
}

interface ScanInput {
  items: Item[];
  keys: string[];
}

interface TestInput {
  items: Item[];
  movements: Movement[];
}

interface ScanRunEntry {
  key: string;
  itemId: string;
  matched: boolean;
}

interface ScanRun {
  id: string;
  keys: string[];
  entries: ScanRunEntry[];
  matchedCount: number;
}

interface OperationResult {
  ok: boolean;
  error: string;
  request: PurchaseRequest | null;
}

interface TrackRow {
  itemId: string;
  name: string;
  qty: number;
  reorderLevel: number;
  belowReorder: boolean;
  movementCount: number;
  reconstructedQty: number;
  invariantOk: boolean;
}

interface TrackResult {
  ok: boolean;
  error: string;
  rows: TrackRow[];
}

interface ShowResult {
  ok: boolean;
  error: string;
  count: number;
  items: Item[];
}

interface ScanResult {
  ok: boolean;
  error: string;
  run: ScanRun | null;
}

interface InvariantEntry {
  itemId: string;
  expected: number;
  actual: number;
  matches: boolean;
}

interface TestResult {
  ok: boolean;
  error: string;
  checks: InvariantEntry[];
  allMatch: boolean;
}

/**
 * Build a deterministic run id from a key list without randomness.
 * @param keys string keys scanned in this run
 * @returns string deterministic run identifier
 */
function runScanId(keys: string[]): string {
  let hash = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    for (let j = 0; j < k.length; j++) {
      hash = (hash * 31 + k.charCodeAt(j)) % 2147483647;
    }
    hash = (hash * 17 + 7) % 2147483647;
  }
  return 'scan-' + String(hash);
}

/**
 * Approve an Open purchase request under the constrained transition rule.
 * // req-5
 * @param input request id, actor, decision note and the request list
 * @returns whether the transition succeeded, an error message and the request
 */
function approve(input: ApproveInput): OperationResult {
  if (!input || typeof input.requestId !== 'string' || input.requestId === '') {
    return { ok: false, error: 'requestId is required', request: null };
  }
  if (typeof input.actor !== 'string' || input.actor.trim() === '') {
    return { ok: false, error: 'actor is required', request: null };
  }
  const requests = input.requests;
  let found: PurchaseRequest | null = null;
  for (let i = 0; i < requests.length; i++) {
    if (requests[i].id === input.requestId) {
      found = requests[i];
      break;
    }
  }
  if (found === null) {
    return { ok: false, error: 'purchase request not found', request: null };
  }
  if (found.status !== 'Open') {
    return {
      ok: false,
      error: 'invalid transition: ' + found.status + ' -> Approved',
      request: found
    };
  }
  found.status = 'Approved';
  found.decisionNote = typeof input.note === 'string' ? input.note : '';
  return { ok: true, error: '', request: found };
}

/**
 * Track every item, reconstructing qty from its movement log.
 * // req-8
 * @param input items and full movement log
 * @returns per-item tracking rows with reconstructed qty and invariant flag
 */
function track(input: TrackInput): TrackResult {
  if (!input || !Array.isArray(input.items) || !Array.isArray(input.movements)) {
    return { ok: false, error: 'items and movements are required', rows: [] };
  }
  const rows: TrackRow[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    let reconstructed = 0;
    let count = 0;
    for (let j = 0; j < input.movements.length; j++) {
      const mv = input.movements[j];
      if (mv.itemId === item.id) {
        reconstructed += mv.delta;
        count += 1;
      }
    }
    rows.push({
      itemId: item.id,
      name: item.name,
      qty: item.qty,
      reorderLevel: item.reorderLevel,
      belowReorder: item.qty <= item.reorderLevel,
      movementCount: count,
      reconstructedQty: reconstructed,
      invariantOk: reconstructed === item.qty
    });
  }
  return { ok: true, error: '', rows: rows };
}

/**
 * Show items in a stable, deterministic display order by name then id.
 * // req-1
 * @param input items to display
 * @returns ordered items and a count
 */
function show(input: ShowInput): ShowResult {
  if (!input || !Array.isArray(input.items)) {
    return { ok: false, error: 'items are required', count: 0, items: [] };
  }
  const sorted: Item[] = input.items.slice();
  sorted.sort(function (a: Item, b: Item): number {
    if (a.name < b.name) { return -1; }
    if (a.name > b.name) { return 1; }
    if (a.id < b.id) { return -1; }
    if (a.id > b.id) { return 1; }
    return 0;
  });
  return { ok: true, error: '', count: sorted.length, items: sorted };
}

/**
 * Scan a list of typed item keys and match them deterministically to items.
 * // req-1
 * @param input items and scanned keys
 * @returns the scan run with matched entries
 */
function runScan(input: ScanInput): ScanResult {
  if (!input || !Array.isArray(input.items) || !Array.isArray(input.keys)) {
    return { ok: false, error: 'items and keys are required', run: null };
  }
  const entries: ScanRunEntry[] = [];
  let matched = 0;
  for (let i = 0; i < input.keys.length; i++) {
    const key = input.keys[i].trim();
    if (key === '') {
      entries.push({ key: input.keys[i], itemId: '', matched: false });
      continue;
    }
    let itemId = '';
    let matchedHere = false;
    for (let j = 0; j < input.items.length; j++) {
      const item = input.items[j];
      if (item.id === key || item.name.trim().toLowerCase() === key.toLowerCase()) {
        itemId = item.id;
        matchedHere = true;
        break;
      }
    }
    if (matchedHere) {
      matched += 1;
    }
    entries.push({ key: input.keys[i], itemId: itemId, matched: matchedHere });
  }
  return {
    ok: true,
    error: '',
    run: {
      id: runScanId(input.keys),
      keys: input.keys.slice(),
      entries: entries,
      matchedCount: matched
    }
  };
}

/**
 * List persisted scan runs reconstructed deterministically from stored keys.
 * // req-12
 * @param storedRuns previously stored scan runs
 * @returns the runs unchanged, in stable order
 */
function listScanRuns(storedRuns: ScanRun[]): ScanRun[] {
  if (!Array.isArray(storedRuns)) {
    return [];
  }
  const out: ScanRun[] = [];
  for (let i = 0; i < storedRuns.length; i++) {
    const r = storedRuns[i];
    out.push({
      id: r.id,
      keys: r.keys.slice(),
      entries: r.entries.slice(),
      matchedCount: r.matchedCount
    });
  }
  return out;
}

/**
 * Test the stored state: check every quantity is a non-negative integer and
 * that each item's stored qty equals the sum of its movement deltas.
 * // req-8
 * @param input items and movement log
 * @returns per-item invariant checks and an overall match flag
 */
function test(input: TestInput): TestResult {
  if (!input || !Array.isArray(input.items) || !Array.isArray(input.movements)) {
    return { ok: false, error: 'items and movements are required', checks: [], allMatch: false };
  }
  const checks: InvariantEntry[] = [];
  let allMatch = true;
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    let reconstructed = 0;
    for (let j = 0; j < input.movements.length; j++) {
      if (input.movements[j].itemId === item.id) {
        reconstructed += input.movements[j].delta;
      }
    }
    const valid = Number.isInteger(item.qty) && item.qty >= 0 && reconstructed === item.qty;
    if (!valid) {
      allMatch = false;
    }
    checks.push({
      itemId: item.id,
      expected: reconstructed,
      actual: item.qty,
      matches: valid
    });
  }
  return { ok: true, error: '', checks: checks, allMatch: allMatch };
}
export { approve, track, show, runScan, listScanRuns, test };
