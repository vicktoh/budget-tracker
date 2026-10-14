# Live Q3 offline entry runbook

Updated 14 October 2026. Onboarding uses the live database and real Q3 2026 records, dated **1 July to 30 September 2026 inclusive**. The offline segment captures one genuine, previously unrecorded transaction under its responsible MDA submitter. It remains a live submission when synchronized. Use its actual reference and amount; do not create a dummy entry for this demonstration.

This is Activity 9 of the two-day handbook. Reserve the genuine source transaction on Day 1 and recheck it is still outstanding before the Day 2 demonstration.

The supported target is a user who has signed in online and keeps an already loaded app open while connectivity is lost. Offline first-time sign-in and reliable cold restart have not been established. CSV/XLSX Imports requires connectivity throughout upload, review and confirmation; it does not use the manual-entry offline queue.

## Prepare before Day 1

1. Confirm the approved live application URL and database project with the Admin. Prefer the deployed production app over HTTPS. All saved records affect live reports; opening localhost does not change this when it uses the live Supabase configuration.
2. Validate each named submitter's MDA and ledger grants, plus separate Viewer/Admin accounts. Use distinct browser profiles rather than tabs sharing login storage.
3. Verify Q3 2026 publication state. If Q3 is locked, resolve the reporting workflow with the Admin; do not demonstrate using Q4 or alter the actual date. Identify one genuine outstanding Q3 receipt or payment, check that it is not already recorded or queued, and remove it from any file about to be imported.
4. Agree the source reference, transaction date, amount and classification with the MDA owner. Record starting Q3 counts/totals and the expected contribution of this one record. Use a production build: `npm run dev` disables the service worker. If the facilitator must host locally, use:

```sh
npm run build
npm run start -- --port 3000
```

5. Open the approved live URL (or `http://localhost:3000` for the configured local host). Sign in online and load the selected Funding or Expenditure form and its list. Wait until dropdowns and the account's MDA scope load. Set the actual Q3 date; the form may initially show today's October date.
6. In browser developer tools, check Application → Service Workers for `/sw.js` and an active worker controlling the page. Reload once while still online if needed. Optional installation uses the browser's Install/Add to Home Screen option; installation alone is not proof of offline readiness.
7. Keep the MDA browser profile signed in and the form loaded. Review any existing pending/failed entries before proceeding. Do not clear storage to obtain an empty demonstration screen.
8. Check disconnect/reconnect behaviour before the session without submitting dummy records. Keep this handbook available locally. If a full rehearsal saves the selected real transaction, mark it completed and choose a different genuine outstanding record for the session; never submit it twice.

## Day 2 - Eight-minute demonstration

| Step | Action | Expected result and narration |
| --- | --- | --- |
| 1. Establish online state | Show the responsible MDA account, selected real source record, Q3 transaction date and loaded form. | “This is a real outstanding Q3 transaction. It will enter live reporting after it synchronizes.” |
| 2. Disconnect | Set browser DevTools Network to Offline, or disable Wi-Fi. Keep the page open. | Offline banner appears. Ensure DevTools affects the app tab being demonstrated. |
| 3. Capture the real record | Enter its actual receipt/payment date, amount, reference and verified classifications. For expenditure, verify the actual funding allocations equal the total. Submit once. | Local capture and Waiting to sync should show the record as Pending. Wait for the outcome rather than resubmitting. |
| 4. Explain storage | Point to the pending item and amount. | “Saved on this device. It has not reached the server and is not yet in server reports.” |
| 5. Check the pending item | Compare its reference, actual Q3 date and amount with the source. | Keep the account/tab open. One real record is sufficient; a second demonstration needs a different genuine outstanding transaction. |
| 6. Reconnect | Restore DevTools to No throttling/Online or restore Wi-Fi. Keep the app open. | Automatic sync attempts on reconnect/queue changes; a 30-second retry timer covers transient failures. |
| 7. Verify server save | Wait for the sync result. Refresh online and search the exact reference. | Confirm exactly one server record, correct amount, actual transaction date, MDA and FY2026 Q3. An empty outbox alone is not the full verification. |
| 8. Cross-role check | In a separate Viewer profile, find the reference and compare it with the source. | Record its public entry ID and reconcile its contribution to the Q3 register. Leave comments only for genuine questions. |

Expected change is the verified amount of the selected source record in its own ledger. Concurrent participants may also change dashboard totals, so reconcile using the exact reference/public ID and the session's submission log. Expenditure funding allocations classify its sources; they are not a link to a particular funding transaction. Keep the genuine saved record after onboarding.

## What to avoid during the live demonstration

- Do not log out, switch users, close the browser or clear site data with pending entries. The current outbox is device/browser storage and is not scoped to the active account in its display/drain code.
- Do not promise a fresh offline start. Profiles and MDA memberships are fetched online and lack a durable offline recovery path; a reload may remove access even when references are cached.
- Do not rely on unsaved form text surviving a refresh. The durable offline path begins when submission is successfully queued.
- The offline queue covers manual entries only. Voucher uploads, AI, comments, requests, account management, BIR publication and Admin corrections require connectivity.
- Do not open an uncached edit page after disconnecting. New-entry reference fallback is explicit; loading an existing entry still depends on fetching that entry. A previously loaded routine edit may queue, but Admin corrections/amendments require connectivity.
- Do not publish Q3 merely to demonstrate the button. A quarter published before a queued change syncs will cause a permanent failure. Complete reconciliation and the authorized publication process separately.
- Do not call cached reports current. Cached list filters may not reflect the selected live filter, and not every screen is cached.

## Troubleshooting

| Symptom | Likely cause | Facilitator action |
| --- | --- | --- |
| Page fails to open offline | Development build, inactive service worker, page not cached or lost permission/profile state | Restore connection, sign in, prewarm the exact page and repeat with the tab kept open. |
| MDA list empty | Missing grant or permission data lost after offline reload | Reconnect; verify role/grants as Admin; reload account online. |
| Pending persists | Connection/DNS/server still unavailable | Restore connectivity, keep the page open and allow the retry cycle. Check the exact error. |
| Failed after reconnect | Duplicate reference, permission change, invalid data or quarter publication | Record reference/error and inspect the server for an existing save before recreating anything. Escalate to facilitator/Admin. |
| Duplicate error after a timeout | Server may have saved but the response was lost | Search the exact reference online. Do not change references simply to force a second insert. |
| Entry is locked | BIR quarter published before save/sync | Use the Admin amendment process if appropriate; do not alter the true transaction date to bypass the lock. |
| Selected attachment missing | File persistence is not wired to the submission route | Explain the limitation; retain the original supporting document outside this demo. |

The queue engine has retry/discard helpers, but the displayed Waiting to sync card has no repair/discard controls. Do not direct participants to a nonexistent button. Failed items require a controlled support workflow; preserve the record and error before any cleanup.

## Live session sign-off

Record live URL/project, browser/version, responsible account/MDA, source register, actual transaction date, session date/time, Q3 publication state, reference, public entry ID, amount, pending count and any failure message. Mark each independently:

- Online login and correct MDA grants verified.
- Production service worker active.
- Selected genuine Q3 transaction verified as outstanding before entry.
- Offline capture observed for the selected ledger.
- Reconnection produced exactly one server record per reference.
- Viewer saw the synced records.
- Pending/failed records resolved or assigned for follow-up before switching accounts; no storage cleanup discards live data.
- Saved real records retained and included once in the MDA's Q3 reconciliation.

Record the current live Q3 state and actual demonstration result during onboarding; earlier software checks do not establish what happened in this session.
