type InvoiceStatus = 'Draft' | 'Submitted' | 'Approved' | 'Paid' | 'Overdue' | 'Cancelled';
type ExpenseClaimStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Reimbursed';
type ExpenseCategory = 'Travel' | 'Meals' | 'Equipment' | 'Software' | 'Other';

interface Invoice {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  tax: number;
  status: InvoiceStatus;
  notes: string;
}

interface ExpenseClaimInput {
  id: string;
  employeeName: string;
  dateIncurred: string;
  category: ExpenseCategory;
  amount: number;
  receiptReference: string;
  status?: ExpenseClaimStatus;
  decisionNote?: string;
}

interface ExpenseClaim {
  id: string;
  employeeName: string;
  dateIncurred: string;
  category: ExpenseCategory;
  amount: number;
  receiptReference: string;
  status: ExpenseClaimStatus;
  decisionNote: string;
}

interface DashboardTotals {
  totalOutstanding: number;
  totalOverdue: number;
  countByStatus: Record<string, number>;
  expensesAwaitingApproval: number;
  topSupplierBars: SupplierBar[];
}

interface SupplierBar {
  supplierId: string;
  supplierName: string;
  outstanding: number;
}

interface ClaimStore {
  claims: ExpenseClaim[];
}

const claimStore: ClaimStore = { claims: [] };

function parseIntPence(value: number): number {
  if (typeof value !== 'number' || !isFinite(value) || Math.floor(value) !== value) {
    throw new Error('Amount must be an integer number of pence');
  }
  return value;
}

function compareSupplierBars(a: SupplierBar, b: SupplierBar): number {
  if (b.outstanding !== a.outstanding) {
    return b.outstanding - a.outstanding;
  }
  if (a.supplierName < b.supplierName) {
    return -1;
  }
  if (a.supplierName > b.supplierName) {
    return 1;
  }
  if (a.supplierId < b.supplierId) {
    return -1;
  }
  if (a.supplierId > b.supplierId) {
    return 1;
  }
  return 0;
}

function addDays(isoDate: string, days: number): string {
  const parts: string[] = isoDate.split('-');
  const year: number = Number(parts[0]);
  const month: number = Number(parts[1]);
  const day: number = Number(parts[2]);
  const base: number = Date.UTC(year, month - 1, day);
  const shifted: Date = new Date(base + days * 86400000);
  const y: number = shifted.getUTCFullYear();
  const m: number = shifted.getUTCMonth() + 1;
  const d: number = shifted.getUTCDate();
  const mm: string = m < 10 ? '0' + String(m) : String(m);
  const dd: string = d < 10 ? '0' + String(d) : String(d);
  return String(y) + '-' + mm + '-' + dd;
}

function compareIsoDates(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function isActiveOutstanding(status: InvoiceStatus): boolean {
  return status !== 'Paid' && status !== 'Cancelled';
}

function isOverdueCandidate(status: InvoiceStatus): boolean {
  return status !== 'Paid' && status !== 'Cancelled';
}

/**
 * Computes an invoice due date from an issue date plus the supplier's payment
 * terms in whole days. All arithmetic is done in UTC so the result is stable
 * regardless of the host timezone.
 *
 * @param issueDate - ISO date (YYYY-MM-DD) on which the invoice was issued.
 * @param termsDays - Payment terms in whole days; zero is a valid term.
 * @returns The computed due date as an ISO date string (YYYY-MM-DD).
 */
// req-4
function computeDueDate(issueDate: string, termsDays: number): string {
  return addDays(issueDate, termsDays);
}

/**
 * Recomputes invoice statuses from stored records. Any invoice whose due date
 * has passed and which is not Paid or Cancelled becomes Overdue; Overdue
 * invoices that are no longer past due return to Submitted unless they are
 * Paid or Cancelled. The function is pure and returns a fresh array each call.
 *
 * @param invoices - The stored invoices to recompute.
 * @param today - ISO date (YYYY-MM-DD) representing the current day.
 * @returns A new array of invoices with recomputed statuses.
 */
// req-5
function refreshAgeing(invoices: Invoice[], today: string): Invoice[] {
  return invoices.map(function (invoice: Invoice): Invoice {
    const result: Invoice = {
      id: invoice.id,
      number: invoice.number,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplierName,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      amount: invoice.amount,
      tax: invoice.tax,
      status: invoice.status,
      notes: invoice.notes
    };
    if (result.status === 'Paid' || result.status === 'Cancelled') {
      return result;
    }
    if (compareIsoDates(result.dueDate, today) < 0) {
      result.status = 'Overdue';
    } else if (result.status === 'Overdue') {
      result.status = 'Submitted';
    }
    return result;
  });
}

/**
 * Submits a new expense claim. The amount must be an integer number of pence,
 * and the claim is persisted in the Submitted state.
 *
 * @param input - The expense claim details to submit.
 * @returns A promise resolving to the persisted Submitted expense claim.
 */
// req-6
async function submitExpenseClaim(input: ExpenseClaimInput): Promise<ExpenseClaim> {
  const amount: number = parseIntPence(input.amount);
  const claim: ExpenseClaim = {
    id: input.id,
    employeeName: input.employeeName,
    dateIncurred: input.dateIncurred,
    category: input.category,
    amount: amount,
    receiptReference: input.receiptReference,
    status: 'Submitted',
    decisionNote: ''
  };
  claimStore.claims = claimStore.claims.concat([claim]);
  return claim;
}

/**
 * Rejects a submitted expense claim. The decision note must be at least 8
 * characters; shorter notes are refused with an error and no state change.
 *
 * @param id - Identifier of the claim to reject.
 * @param note - The decision note explaining the rejection.
 * @returns A promise resolving to the updated Rejected claim.
 */
// req-6
async function rejectExpenseClaim(id: string, note: string): Promise<ExpenseClaim> {
  if (note.length < 8) {
    throw new Error('Decision note must be at least 8 characters');
  }
  let found: ExpenseClaim | undefined = undefined;
  for (let i: number = 0; i < claimStore.claims.length; i = i + 1) {
    if (claimStore.claims[i].id === id) {
      found = claimStore.claims[i];
      break;
    }
  }
  if (found === undefined) {
    throw new Error('Expense claim not found: ' + id);
  }
  if (found.status !== 'Submitted') {
    throw new Error('Only submitted claims can be rejected');
  }
  found.status = 'Rejected';
  found.decisionNote = note;
  return found;
}

/**
 * Marks an approved expense claim as Reimbursed. Rejected claims and claims
 * that are not approved fail the transition check with an error and no state
 * change.
 *
 * @param id - Identifier of the claim to reimburse.
 * @returns A promise resolving to the updated Reimbursed claim.
 */
// req-6
async function reimburseExpenseClaim(id: string): Promise<ExpenseClaim> {
  let found: ExpenseClaim | undefined = undefined;
  for (let i: number = 0; i < claimStore.claims.length; i = i + 1) {
    if (claimStore.claims[i].id === id) {
      found = claimStore.claims[i];
      break;
    }
  }
  if (found === undefined) {
    throw new Error('Expense claim not found: ' + id);
  }
  if (found.status === 'Rejected') {
    throw new Error('A rejected claim cannot be reimbursed');
  }
  if (found.status === 'Reimbursed') {
    throw new Error('Claim is already reimbursed');
  }
  if (found.status !== 'Approved') {
    throw new Error('Only approved claims can be reimbursed');
  }
  found.status = 'Reimbursed';
  return found;
}

/**
 * Computes dashboard totals from the supplied stored records each time it is
 * called. Totals are never cached: outstanding covers all non-Paid, non-
 * Cancelled invoices, overdue covers Overdue invoices, counts are per status,
 * and expenses awaiting approval counts Submitted claims.
 *
 * @param invoices - The stored invoices to aggregate.
 * @param claims - The stored expense claims to aggregate.
 * @returns The freshly computed dashboard totals.
 */
// req-7
function getDashboard(invoices: Invoice[], claims: ExpenseClaim[]): DashboardTotals {
  let totalOutstanding: number = 0;
  let totalOverdue: number = 0;
  const countByStatus: Record<string, number> = {};
  for (let i: number = 0; i < invoices.length; i = i + 1) {
    const invoice: Invoice = invoices[i];
    const current: number = countByStatus[invoice.status] === undefined ? 0 : countByStatus[invoice.status];
    countByStatus[invoice.status] = current + 1;
    if (isActiveOutstanding(invoice.status)) {
      totalOutstanding = totalOutstanding + invoice.amount;
    }
    if (invoice.status === 'Overdue') {
      totalOverdue = totalOverdue + invoice.amount;
    }
  }
  let expensesAwaitingApproval: number = 0;
  for (let j: number = 0; j < claims.length; j = j + 1) {
    if (claims[j].status === 'Submitted') {
      expensesAwaitingApproval = expensesAwaitingApproval + 1;
    }
  }
  return {
    totalOutstanding: totalOutstanding,
    totalOverdue: totalOverdue,
    countByStatus: countByStatus,
    expensesAwaitingApproval: expensesAwaitingApproval,
    topSupplierBars: getTopSupplierBreakdown(invoices, 5)
  };
}

/**
 * Produces a bar breakdown of outstanding amounts grouped by supplier, sorted
 * by outstanding descending and limited to the requested count. Ties are
 * broken deterministically by supplier name then supplier id.
 *
 * @param invoices - The stored invoices to aggregate.
 * @param limit - Maximum number of supplier bars to return.
 * @returns The top supplier bars by outstanding amount.
 */
// req-7
function getTopSupplierBreakdown(invoices: Invoice[], limit: number): SupplierBar[] {
  const bySupplier: Record<string, SupplierBar> = {};
  for (let i: number = 0; i < invoices.length; i = i + 1) {
    const invoice: Invoice = invoices[i];
    if (!isActiveOutstanding(invoice.status)) {
      continue;
    }
    const key: string = invoice.supplierId;
    if (bySupplier[key] === undefined) {
      bySupplier[key] = {
        supplierId: invoice.supplierId,
        supplierName: invoice.supplierName,
        outstanding: 0
      };
    }
    bySupplier[key].outstanding = bySupplier[key].outstanding + invoice.amount;
  }
  const bars: SupplierBar[] = [];
  const keys: string[] = Object.keys(bySupplier);
  for (let k: number = 0; k < keys.length; k = k + 1) {
    bars.push(bySupplier[keys[k]]);
  }
  bars.sort(compareSupplierBars);
  if (limit < 0) {
    return [];
  }
  return bars.slice(0, limit);
}

/**
 * Formats an integer number of pence as a GBP amount string with two decimal
 * places and thousands separators.
 *
 * @param pence - The amount in integer pence.
 * @returns The formatted GBP amount, for example "£1,234.50".
 */
// req-9
function formatPence(pence: number): string {
  const normalized: number = parseIntPence(pence);
  const negative: boolean = normalized < 0;
  const absolute: number = negative ? -normalized : normalized;
  const units: number = Math.floor(absolute / 100);
  const pennies: number = absolute % 100;
  const unitsText: string = String(units);
  let grouped: string = '';
  let count: number = 0;
  for (let i: number = unitsText.length - 1; i >= 0; i = i - 1) {
    grouped = unitsText.charAt(i) + grouped;
    count = count + 1;
    if (count % 3 === 0 && i > 0) {
      grouped = ',' + grouped;
    }
  }
  const penniesText: string = pennies < 10 ? '0' + String(pennies) : String(pennies);
  return (negative ? '-' : '') + '£' + grouped + '.' + penniesText;
}
export { computeDueDate, refreshAgeing, submitExpenseClaim, rejectExpenseClaim, reimburseExpenseClaim, getDashboard, getTopSupplierBreakdown, formatPence };
