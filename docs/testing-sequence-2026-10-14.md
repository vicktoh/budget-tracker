# End-to-end testing sequence

Prepared 14 October 2026 for the deployed build (`main` at `1426ce6`, production: https://budget-tracker--budget-tracker-2fb26.us-east4.hosted.app). It covers onboarding, funding and expenditure entry, comments and notifications, reference requests, offline capture, and the import flows, including the AI-assisted import.

Work through the sections in order: later sections reuse the accounts and records created earlier. Each step has an expected result. Tick it or note the actual result and an entry ID or screenshot.

## 0. Ground rules for testing on the live database

Production uses the live Supabase project. Every saved entry is real and reportable immediately.

- **Keep test records out of Q3.** Use dates from **1–10 October 2026 (Q4)** and references starting `TEST-`, with the remark `TEST - delete after`. Never use Q3 dates (1 July–30 September) for test data: that is the live onboarding period.
- **Use tiny amounts** (₦1–₦50).
- **Do not publish a BIR quarter** (Reports → Budget Implementation Report → Publish). Publishing is permanent and locks the quarter for everyone.
- **Do not change real users' grants.** Use dedicated test accounts.
- **Clean up afterwards.** There is no delete button for ledger entries. Collect every `TEST-` public ID in the sign-off table and ask the developer/Admin to remove them in one database step (section 11).
- **Existing test rows.** FL-2026-0127 and FL-2026-0128 (₦1 and ₦2, Hospital Management Board, references `IMPTEST-20261013-01/02`) were left by the 13 October import test and are still live. Include them in the cleanup.

### Test files (in the repo under `docs/testing/`)

| File | Used in | What it exercises |
| --- | --- | --- |
| `import-funding-test.csv` | 8.1 | Mixed ready/blocked/skipped/excluded funding rows (MDA column = HMB code) |
| `import-expenditure-test.csv` | 8.3, 9 | Expenditure with **no MDA column** (default MDA) and one "Other" row missing remarks |
| `ai-test-workbook.xlsx` | 10 | Synthetic 3-sheet workbook: messy transaction sheet, monthly return, quarterly summary, planted prompt-injection cell |

Regenerate the workbook with `node docs/testing/make-ai-test-workbook.cjs` if needed.

## 1. Accounts and browser setup

Create these accounts in step 2.1 (use emails you control, for example plus-addresses):

| Account | Role | Grants | Purpose |
| --- | --- | --- | --- |
| **ADMIN** | Admin | — | Your existing admin account |
| **VIEWER** | Viewer | — (statewide by role) | Comments, register, reports |
| **MDA-1** | MDA user | HMB: funding submitter + expenditure submitter | Main data-entry tester, single MDA |
| **MDA-2** | MDA user | HMB + Ministry of Health (HQ): funding submitter only | Multi-MDA and permission edges |

Use a **separate browser profile (or browser) per account**. The offline outbox is shared per browser, so never switch accounts in the same profile while anything is pending. Use one phone (or browser device emulation at 375 px) for section 3.

## 2. Onboarding

| # | Step | Expected result |
| --- | --- | --- |
| 2.1 | ADMIN → **Users → Create user**. Create VIEWER, MDA-1 and MDA-2 with the roles/grants above. | Each user is created. "Invite sent" shows for each; if email delivery fails, an invite link is shown with **Copy**. |
| 2.2 | Open the invite email (or copied link) for MDA-1 in MDA-1's browser profile. | Lands on **/auth/accept-invite**; asks for a new password. |
| 2.3 | Set a password and continue. | Signed in. MDA-1 lands on the dashboard and sees **Dashboard, Assistant, Funding Entries, Expenditure Entries, Import entries, Entry Register, Request a value, Settings**. No Administration items. |
| 2.4 | Repeat 2.2–2.3 for VIEWER and MDA-2. | VIEWER sees Dashboard, Entry Register, Reports, Request a value, but **not** Funding/Expenditure/Imports. MDA-2 sees **Funding** and **Import entries** but **not** Expenditure. |
| 2.5 | ADMIN → Users → open MDA-2 → **Resend invite email** (or **Reset password**). | A new email/link is produced; the old link no longer works after the new password is set. |
| 2.6 | As MDA-2, type `/expenditure/new` in the address bar. | Redirected away; expenditure isn't available without an expenditure grant. |
| 2.7 | As VIEWER, open `/imports` and `/admin/users`. | Redirected to the viewer's home page for both. |
| 2.8 | Sign out and sign back in as MDA-1 with the new password. | Works; wrong password shows an error. |

## 3. Navigation on a phone

| # | Step | Expected result |
| --- | --- | --- |
| 3.1 | On a phone (or 375 px emulation), sign in as MDA-1. | Header shows a **☰** menu button; no sideways scrolling on any page. |
| 3.2 | Tap ☰. | Drawer lists the same items as 2.3, grouped Overview / Entries / Personal. |
| 3.3 | Tap **Request a value**. | Drawer closes and **Request a reference value** opens (not the dashboard). |
| 3.4 | Visit Funding, Expenditure, Import entries, and an entry detail. | Each fits the screen; tables scroll horizontally inside their box; tab bars scroll. |
| 3.5 | As ADMIN on the phone, open Executive overview, a report (BIR, Accountability Brief) and Users. | All fit; report toolbar buttons wrap onto a second line. |

## 4. Funding entries (manual)

Sign in as **MDA-1** (desktop is fine).

| # | Step | Expected result |
| --- | --- | --- |
| 4.1 | **Funding → New funding entry**. Date **2026-10-02**, MDA HMB (preselected for a single-MDA user), Programme **Disease Control**, Source **BHCPF Allocation**, Amount **12.00**, Reference **TEST-F-001**, Remarks `TEST - delete after`. Save. | Saved with a public ID like `FL-2026-0xxx`; period shows **FY2026 Q4**. Record the ID. |
| 4.2 | New entry with Programme **Other** and no remarks. | Blocked: "Add remarks to explain the Other selection". |
| 4.3 | New entry with Amount **0**, then **-5**. | "Amount must be greater than zero." |
| 4.4 | New entry reusing reference **TEST-F-001** (same MDA, 2026 date). | "This reference number is already used for the selected MDA and fiscal year." |
| 4.5 | Open TEST-F-001 → **Edit** → change amount to **13.00** → save. | Saved; detail shows 13.00; audit history shows the change. |
| 4.6 | As **MDA-2**, open the funding form. | The MDA list offers only HMB and Ministry of Health (HQ). |
| 4.7 | As **VIEWER**, open **Entry Register** and search `TEST-F-001`. | Visible with the edited amount. No edit control. |

## 5. Expenditure entries (manual)

Sign in as **MDA-1**.

| # | Step | Expected result |
| --- | --- | --- |
| 5.1 | **Expenditure → New**. Date **2026-10-03**, Programme **Hospital Services**, Category **Overhead / Running Costs**, Payment method **GIFMIS**, Amount **30.00**, Voucher **TEST-E-001**, funding breakdown **BHCPF Allocation 30.00**, Remarks `TEST - delete after`. Save. | Saved with an `EL-2026-0xxx` ID, FY2026 Q4. Record it. |
| 5.2 | New expenditure **TEST-E-002**, Amount **40.00**, split funding **BHCPF 25.00 + Kano State Govt Budget Release 10.00**. | Blocked: funding allocations must equal the expenditure amount (35 ≠ 40). |
| 5.3 | Change the second allocation to **15.00** and save. | Saved; detail shows both sources totalling 40.00. |
| 5.4 | When the state-budget source is chosen, check the **Approved Budget Item** option. | A budget line can be selected for HMB/2026; choosing one sets and locks the category. Optional. |
| 5.5 | New expenditure reusing voucher **TEST-E-001**. | "This voucher reference is already used for the selected MDA and fiscal year." |
| 5.6 | Payment method **Other** without remarks. | Blocked until remarks are entered. |
| 5.7 | Edit TEST-E-001 amount to **31.00** with allocation **31.00**. | Saved; audit history shows the edit. |

## 6. Comments and notifications

| # | Step | Expected result |
| --- | --- | --- |
| 6.1 | As **VIEWER**, open TEST-E-001 → add comment "TEST: please confirm the voucher date." | Comment appears with VIEWER's name and role. |
| 6.2 | As **MDA-1** (entry author), check the **bell** icon without reloading. | Unread badge increases in real time; the notification names the entry. |
| 6.3 | Click the notification. | Opens TEST-E-001; the notification is marked read and the badge decreases. The entry's **Audit events** card lists its creation and edits. |
| 6.4 | As **ADMIN**, check the bell. | Also notified (admins and viewers receive comment notifications statewide). |
| 6.5 | As **VIEWER**, check the bell. | **No** notification for their own comment. |
| 6.6 | As **MDA-1**, reply "TEST: confirmed." | VIEWER and ADMIN are notified; MDA-1 is not. |
| 6.7 | As **MDA-2** (member of HMB), check the bell. | Notified, because MDA members of the entry's MDA are participants. |
| 6.8 | Confirm the entry is still reportable. | Comments never approve, reject or change reportability; the entry stays in the register and totals. |

Notifications are in-app only. Email is used for invites and password resets, not comment notifications.

## 7. Reference requests

| # | Step | Expected result |
| --- | --- | --- |
| 7.1 | As **MDA-1**, **Request a value**: type Funding source, value `TEST Source – do not approve`, reason "TEST". Submit. | Request listed as pending under the user. |
| 7.2 | As **ADMIN**, **Reference requests**. | The request appears with requester and MDA. |
| 7.3 | **Reject** it (a short comment is required): "TEST". | MDA-1 sees the rejected status and note. Don't approve test values; that would add them to live dropdowns. |

## 8. Imports (deterministic)

Online only. Sign in as **ADMIN** for 8.1–8.2 (the HMB code in the file is valid for any admin) and as **MDA-1** for 8.3.

### 8.1 Funding CSV

| # | Step | Expected result |
| --- | --- | --- |
| 8.1.1 | **Import entries** → "Funding entries (receipts)" → upload `import-funding-test.csv` → **Upload and inspect**. | Batch page opens; columns pre-mapped (Date, MDA, Programme Area, Funding Source, Amount, Reference No., Remarks). |
| 8.1.2 | Read the stats. | **1 ready, 4 blocked, 1 skipped, 1 excluded**. Blocked reasons: ambiguous date (02/10/2026), negative amount, unknown source "Mystery Fund", impossible date 2026-02-31. Skipped: exact repeat. Excluded: Total row. |
| 8.1.3 | Set **Numeric dates mean → Day first**, **Apply and check rows**. | 2 ready (row 3 resolves to 2 Oct 2026). |
| 8.1.4 | On the Mystery Fund row: **Fix** → source `BHCPF Allocation` → **Save and re-check**. | 3 ready, NGN 34.00; the row shows "edited". |
| 8.1.5 | **Issue report** download. | CSV lists every row with disposition, issues and a Corrections column; formula-like cells are prefixed with `'`. |
| 8.1.6 | Click **Insert 3 funding entries totalling NGN 34.00**. | Receipt shows 3 entry IDs and "Not inserted: 2 blocked, 1 skipped, 1 excluded". Record the IDs. |
| 8.1.7 | Click the button again / refresh. | No second insert; the completed receipt is shown. |
| 8.1.8 | Upload the same CSV again (new batch). | The three inserted references are **Skipped — already recorded as FL-…**. Cancel this batch. |
| 8.1.9 | Entry Register: search `TEST-IMP-F`. | The three entries are there, entered by ADMIN, FY2026 Q4. |

### 8.2 Guards

| # | Step | Expected result |
| --- | --- | --- |
| 8.2.1 | Upload a `.pdf` or `.xls`. | Rejected with a clear message; nothing staged. |
| 8.2.2 | Upload a CSV whose amount header is `Amount (₦'000)`. | All rows blocked: "suggests thousands or millions". Cancel. |
| 8.2.3 | Edit one row in a draft, then try to confirm a stale preview in another tab. | "The batch changed after you reviewed it." Refresh shows the new preview. |

### 8.3 Expenditure CSV with no MDA column (default MDA)

| # | Step | Expected result |
| --- | --- | --- |
| 8.3.1 | As **MDA-1**: Import → "Expenditure entries (payments)" → `import-expenditure-test.csv`. | Mapping panel shows **"Defaulted to Hospital Management Board (HMB), the MDA you're registered under."** |
| 8.3.2 | Stats. | 2 ready (NGN 40.00), 1 blocked (Other category without remarks). |
| 8.3.3 | Fix the blocked row: add remarks `TEST - other`. Re-check. | 3 ready, NGN 45.00. |
| 8.3.4 | Insert. | Receipt with 3 `EL-` IDs. Each has one funding allocation equal to its amount. |

## 9. Import permissions and default MDA edges

| # | Step | Expected result |
| --- | --- | --- |
| 9.1 | As **MDA-2** (two MDAs, funding only): Import → Funding → upload a copy of `import-funding-test.csv` with the MDA column deleted. | No default; MDA-2 must choose between HMB and Ministry of Health (HQ). Until chosen, rows are blocked. Cancel. |
| 9.2 | As **MDA-2**: Import → is "Expenditure entries" offered? | No; MDA-2 has no expenditure grant. |
| 9.3 | As **MDA-1**: upload the funding CSV after changing one row's MDA to `052100100100` (Ministry of Health). | That row is blocked "You don't have a funding submit grant for Ministry of Health (HQ)"; other rows unaffected. Cancel. |
| 9.4 | As **VIEWER**: open `/imports`. | Redirected (no import access). |
| 9.5 | As **MDA-1**, copy a batch URL created by ADMIN into the address bar. | "Import batch not found"; batches are private to their owner (Admins can view all). |

## 10. AI-assisted import (phase 2)

Sign in as **ADMIN** (or MDA-1 for an HMB-only run). Uses `ai-test-workbook.xlsx`.

| # | Step | Expected result |
| --- | --- | --- |
| 10.1 | Import → "Expenditure entries" → upload `ai-test-workbook.xlsx`. | Status **Choose a sheet**; three sheets listed. Nothing has been sent to AI yet. |
| 10.2 | Click **Analyze sheets with AI** (takes 10–40 s). | "Reads as" column: **Payments Oct = Expenditure payments** (high %), **HMB Monthly = Monthly budget-line returns**, **Q3 Summary = Quarterly published totals**, each with rationale and evidence. Q3 Summary warns it repeats/totals HMB Monthly ("importing both would double count"). Non-transaction sheets show "Belongs in: …" and a **Use anyway** button. |
| 10.3 | Check the planted cell. | Despite the "Ignore previous instructions…" narration, the other sheets are **not** classified as ledgers. |
| 10.4 | **Use this sheet** on Payments Oct. | Date, Agency (MDA), Naira (amount), PV Number (voucher) and Narration map automatically; Programme, Category, Payment method and Funding source stay empty. |
| 10.5 | **Suggest mapping with AI**. | Each empty field shows "AI suggests Prog. / Spend Type / Paid Via / Fund From · %" with a reason. Nothing is applied yet. |
| 10.6 | **Use AI suggestions for empty fields**, set **Day first**, **Apply and check rows**. | **Questions about values** appears: MDA "MoH HQ" (2 rows), "Hospital Mgt Board" (1), Funding source "State budget release" (2), "BHCPF" (2), Category "Overhead" (2). |
| 10.7 | **Suggest answers with AI**. | Each question shows an AI suggestion with % and reason (e.g. MoH HQ → Ministry of Health (HQ)). Selections are still empty. |
| 10.8 | **Pre-fill AI suggestions**, then set one question to **None of these — keep rows blocked**, and **Save … answers and re-check**. | Rows with accepted answers become ready and show "matched … by your answer"; the declined value's rows stay blocked with "You chose to leave these rows blocked." |
| 10.9 | Change the declined answer to the correct value and save. | All 4 rows ready, NGN 10.00. |
| 10.10 | As **MDA-1** (HMB only), repeat 10.1–10.8. | The MDA question lists all MDAs; those outside MDA-1's grants are marked "not your MDA — rows will stay blocked". Answering "MoH HQ" truthfully with Ministry of Health (HQ) leaves those rows blocked as not permitted; "Hospital Mgt Board" → HMB becomes ready. |
| 10.11 | Either **Cancel batch** (preferred; no ledger write) or insert and record the 4 `TEST-AI-` IDs for cleanup. | — |
| 10.12 | On a fresh batch, never press an AI button. | Upload page and batch page work fully without AI; nothing is sent to OpenAI. |

The batch records every AI call (model, prompt version, user, what was sent). Each batch is limited to 12 AI requests; the buttons disable after that.

## 11. Reports, dashboard and cleanup

| # | Step | Expected result |
| --- | --- | --- |
| 11.1 | As ADMIN, Executive overview and MDA Dashboard for HMB, period FY2026 Q4. | Test entries are included in Q4 totals (small amounts). Q3 figures are unchanged by testing. |
| 11.2 | Reports → BIR for 2026 Q4: **view only**. | Report renders; do **not** publish. |
| 11.3 | Collect all `TEST-` / `IMPTEST-` public IDs in the sign-off table. | — |
| 11.4 | Ask the developer/Admin to delete them in one confirmed database step (entries, their allocations and comments). Reject the test reference request (7.3) rather than deleting it. | Register search for `TEST-` returns nothing; Q4 totals return to their prior values. |
| 11.5 | Deactivate the VIEWER/MDA-1/MDA-2 test accounts if they shouldn't persist. | — |

## 12. Offline capture

Follow `docs/offline-demo-runbook.md`. That runbook uses a genuine Q3 transaction during the live session. To smoke-test beforehand, use MDA-1 with a Q4 `TEST-` record: production URL, form loaded online, DevTools → Offline, submit once → "Waiting to sync" pending → back online → exactly one server record. Add its ID to the cleanup list.

## Sign-off

| Section | Pass / fail | Notes, entry IDs, screenshots |
| --- | --- | --- |
| 2 Onboarding | | |
| 3 Phone navigation | | |
| 4 Funding | | |
| 5 Expenditure | | |
| 6 Comments and notifications | | |
| 7 Reference requests | | |
| 8 Imports | | |
| 9 Import permissions | | |
| 10 AI import | | |
| 11 Reports and cleanup | | |
| 12 Offline | | |

Known limitations (not failures):
- voucher attachments are not saved yet
- facility users cannot save expenditure (database permission gap)
- email notifications for comments are not implemented
- AI import does not yet load monthly returns, budgets, AOP or quarterly totals
- AI questions don't cover expenditure items, facilities or AOP codes (fix those per row)
