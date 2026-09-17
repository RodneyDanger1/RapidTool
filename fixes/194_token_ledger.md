# 194 — Token ledger (SessionBudgetExceeded)

New `src/lib/token-ledger.ts`:

- `recordSpend` / `wouldExceed` / `assertWithinBudget`
- `SessionBudgetExceeded` (`code: RT_E_BUDGET_EXHAUSTED`)
- `NoMoneyException` alias

No cap → no-op (unmetered path unchanged). Missing usage does not bump calls.

**Not yet** wired into `completeDeepSeek` / P6 (that needs a project-level cap field).
The class exists so a later parent wire can abort instead of dropping usage.
