# ADR 0005: Quarterly BIR Publication Locks Replace Ledger Review Statuses

- Status: Accepted
- Date: 2026-07-15
- Supersedes: The ledger review-workflow portions of ADR 0004

## Context

Funding and expenditure reviewers do not approve or reject individual records. They inspect statewide records, comment, view evidence and warnings, and use the resulting reports. The former `pending`, `approved`, `processed`, and `rejected` state machine therefore misrepresented their authority and incorrectly excluded valid active rows from reporting.

The actual approval boundary is publication of a quarter-specific Budget Implementation Report (BIR). Once published, the recorded quarter must remain stable for routine users while accountable corrections remain possible.

## Decision

- Remove workflow statuses and approval metadata from the two ledger tables. Every active ledger row is immediately reportable.
- Preserve the database role slug `reviewer`, but label it “Viewer” in all user-facing surfaces. Viewers retain statewide read, comment, attachment, warning, audit, and reporting access and cannot mutate ledger rows.
- Record BIR publication as append-only metadata keyed by fiscal year, quarter, and version. Initial publication is Admin-only and version 1 is irreversible through normal interfaces.
- Enforce publication locks in Postgres for ledger inserts, old/new periods on updates, deletes, expenditure allocations, imports, and privileged writes. Submission windows remain an independent restriction.
- Permit post-publication corrections only through Admin amendment commands. An amendment requires a reason, captures before/after JSON, updates the ledger and allocations atomically, creates one next publication version, and relies on the ledger audit trigger for its Audit Event.
- Permit Admin corrections to unpublished entries only through reasoned correction commands. Submitters may continue editing their own authorized entries until publication.
- Archive legacy rejected entries and their comments, audit history, and attachment metadata before removing them from active reporting. Convert approval-oriented comments on retained entries to general comments.
- Store metadata and audit evidence, not historical report PDFs or immutable report datasets.

## Consequences

The Entry Register and shared Entry Detail replace the review queue. Reports no longer expose entry-status filters or approved/processed-only calculations. A published quarter is stable for routine work, but later amendment versions mean the exact original report dataset cannot be reconstructed from the current ledger alone. Database triggers, rather than client state, are the authoritative enforcement boundary.
