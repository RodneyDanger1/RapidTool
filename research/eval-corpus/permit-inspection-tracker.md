---
name: "Permit & Inspection Tracker"
brief: "a permit and inspection tracker for a small construction office: permit applications with the issuing authority, status and expiration date, the required inspections per permit scheduled with an assigned inspector, pass/fail inspection results with deficiency punch lists and re-inspection dates, and a per-project compliance summary"
kind: "webapp"
domain: "construction"
expectedNouns: ["permit", "permitApplication", "authority", "expirationDate", "inspection", "inspector", "inspectionResult", "deficiency", "punchList", "reInspection", "complianceSummary", "project"]
expectedCapabilities: ["Permit applications with issuing authority, status and expiration date", "Required inspections per permit, scheduled with an assigned inspector", "Pass/fail inspection results recorded per permit", "Deficiency punch lists with re-inspection dates", "A per-project compliance summary"]
acceptance: "A small construction office can run permits from application through authority status and expiration, schedule each permit's required inspections with an assigned inspector, record pass/fail results with deficiency punch lists and re-inspection dates, and read a per-project compliance summary in one runnable web app."
baseline: "not yet measured — authored 2026-09-24 by W19-L4 (OV-7); no prior run exists, the first recorded run establishes it (nothing here quotes a run or dossier)"
---

## Provenance

- **Authored, NOT transcribed — stated plainly:** this fixture was authored 2026-09-24 by W19-L4 under
  OV-7 so the `construction` domain carries a **second** fixture (a same-domain peer whose prior row is
  citable by M7/learning; the six 2026-09-08 fixtures left `construction` with a single case). Unlike those
  six, this brief is **not** transcribed from an on-disk run — there is no dossier and no run evidence
  behind it, and the `baseline` line says so. Its first recorded eval run establishes the real baseline.
- **What is evidence-shaped and what is not:** `expectedNouns` / `expectedCapabilities` decompose the
  brief text above (the corpus schema's documented purpose, same shape as `field-ops-suite.md`); the
  `acceptance` line is the run-side grader's bar (`graders/permit-inspection-tracker.grader.json`) and is
  documentation here — the grader, read only by `scripts/run-eval.mjs`, is the grading source of truth.
- **Why not a third domain instead:** the domain count already reached two (`real-estate`, `construction`);
  what was missing for a *cross-domain* M7 reading was a second fixture **inside** construction. See
  `README.md` § "Domain spread & the M7 reading (OV-7)".
