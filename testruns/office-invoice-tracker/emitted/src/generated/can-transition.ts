import { computeDueDate, refreshAgeing, submitExpenseClaim, rejectExpenseClaim, reimburseExpenseClaim, getDashboard, getTopSupplierBreakdown, formatPence } from "./compute-due-date.ts";
type InvoiceStatus = 'Draft' | 'Submitted' | 'Approved' | 'Paid' | 'Overdue' | 'Cancelled';

type StatusTransitionRule = { from: InvoiceStatus; to: InvoiceStatus };

// req-10
/**
 * Determines whether an invoice status transition is permitted under the
 * enforced lifecycle rules.
 *
 * Allowed transitions:
 * - Draft -> Submitted
 * - Submitted -> Approved
 * - Submitted -> Cancelled
 * - Approved -> Paid
 *
 * Paid is terminal: no transition out of Paid is ever allowed. Any other
 * pair of statuses (including self-transitions such as Approved -> Approved)
 * is rejected.
 *
 * @param from - the current invoice status
 * @param to - the requested next invoice status
 * @returns true when the transition is permitted, false otherwise
 */
function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowed: StatusTransitionRule[] = [
    { from: 'Draft', to: 'Submitted' },
    { from: 'Submitted', to: 'Approved' },
    { from: 'Submitted', to: 'Cancelled' },
    { from: 'Approved', to: 'Paid' },
  ];
  for (let i = 0; i < allowed.length; i++) {
    const rule: StatusTransitionRule = allowed[i];
    if (rule.from === from && rule.to === to) {
      return true;
    }
  }
  return false;
}
export { canTransition };
