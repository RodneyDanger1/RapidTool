# Ledgeline — Office Invoice & Expense Tracker

## What this is
An internal office tool for tracking supplier invoices and staff expenses from
receipt through to payment. It replaces a spreadsheet and gives the office
manager a single ageing view of what is owed and what is overdue.

## Users
- **Office manager** — enters invoices, marks them paid, chases overdue.
- **Employee** — submits an expense claim with a receipt reference.
- **Approver** — approves or rejects expense claims.

## Core domain
- **Supplier**: id, name, email, payment terms (days).
- **Invoice**: id, number, supplier, issue date, due date, amount (integer
  pence), tax amount, status (Draft | Submitted | Approved | Paid | Overdue |
  Cancelled), notes.
- **ExpenseClaim**: id, employee name, date incurred, category (Travel |
  Meals | Equipment | Software | Other), amount (pence), receipt reference,
  status (Draft | Submitted | Approved | Rejected | Reimbursed), decision note.

## Required features
1. **Invoice list** — table with supplier, number, dates, amount, status, and an
   "age" column (days since due; overdue highlighted). Filter by status and
   supplier, search by number/supplier, sort by due date or amount.
2. **Add / edit invoice** — validate: number required and unique, supplier
   required, amount > 0, tax >= 0 and <= amount, due date on/after issue date.
   Computes due date from the supplier's terms when not given explicitly.
3. **Status ageing** — an invoice becomes Overdue automatically when its due
   date has passed and it is not Paid/Cancelled; a "refresh" recomputes this
   from the data (never a manual flag alone).
4. **Expense claims** — submit, approve, reject (rejection requires a note of at
   least 8 characters), and mark reimbursed. A rejected claim cannot be
   reimbursed; an approved claim cannot be re-approved.
5. **Dashboard** — totals: total outstanding, total overdue, count by status,
   and expenses awaiting approval. A simple bar breakdown by supplier of the
   top five outstanding.
6. **Export** — a CSV of the currently filtered invoice list (columns: number,
   supplier, issue, due, amount, tax, status, age).

## Functional requirements
- All money in integer pence; arithmetic (totals, outstanding, overdue sums) is
  exact; display in GBP.
- Ageing and dashboard totals derive from the stored records each time they are
  requested (no stale cached totals).
- Status transitions constrained: Draft→Submitted→Approved→Paid; Submitted→
  Cancelled; a Paid invoice is terminal.
- Expense rejection note rule enforced (>= 8 chars) with a clear error.
- CSV export must quote fields containing commas/quotes correctly.

## Non-functional requirements
- Desktop-first, usable to 768px; accessible data tables with proper headers.
- Deterministic core calculations separated from UI for unit testing.
- Local persistence; no external services needed to run.

## Explicitly out of scope
- Bank feed / open-banking integration.
- Real OCR of receipts.
- Multi-currency (GBP only).
- Payroll or tax filing.
