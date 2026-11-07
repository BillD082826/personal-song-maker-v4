# LyriBop scheduler — current checkpoint

Updated November 6, 2026, America/New_York. Read STORYSONG_PROJECT.md and LYRIBOP_WORKFLOW_RULES.md before resuming. This summary supplements the historical ledger.

## Live and saved

- Hosted planner: https://personal-song-maker-v5-test.onrender.com/admin/ad-scheduler/
- Seven-day planning, up to three daily slots per platform; different ads can be saved in individual slots.
- Facebook: reviewed batch approvals, permanent duplicate guards, verified delivery report, hosted worker installed **OFF**.
- Instagram: 18 prepared JPEG ad copies, reviewed batch approvals, delivery/account/caption verification, permanent guards, hosted worker installed **OFF**.
- Pinterest: real owned public boards load successfully, selected board saved with a draft. Public automated Pinterest publishing is **not implemented or enabled**.
- Latest live source: 23612435825035e356ce41be5f427d202dd9b773. Render deployment dep-dbn74nm7bikc73ai6o00 observed Live.
- Both Meta worker status checks: configured false, enabled false, no heartbeat or outstanding attention warning. No new posts sent in this build session.
- Earlier verified live evidence: one timed Facebook pilot and two manual test posts. Do not resend them.

## Next scheduler work

1. Dashboard start/stop controls are now built locally, with five focused checks passed and the new real PostgreSQL check pending. Run ONLY outputs/check-lyribop-scheduler-controls.sh from the Codex workspace. Then review deployment and one-time server configuration while DB switches stay OFF. The controls are not deployed or active yet.
2. Review the intended Facebook/Instagram queue and current connection readiness before explicit activation. The user deferred the additional public test; its old approval must not be reused.
3. Pinterest currently shows **Trial access active**, verified November 6. Trial-created Pins are creator-visible. Standard is not active. Do not infer whether an upgrade request is pending from the stale upgrade form, and do not resubmit without reviewing the actual submission/evidence with Bill.
4. Pinterest's scheduled publishing/approval/verification worker remains to build behind a disabled gate after access requirements are resolved. Preserve the existing uncertain production Trial record; no retry, reset, deletion, or new-ID workaround.
5. Complete user-facing failure/expired-connection notices and final operating instructions before describing the three-platform scheduler as complete.

## Verification already done — avoid redundant repeats

- Instagram build: 166 checks passed in the combined run; the sole restart-test fixture error was corrected, and that exact real PostgreSQL check passed separately. All 167 accounted for across those runs.
- Pinterest board feature: 28 targeted checks passed; 2 unchanged PostgreSQL checks skipped locally. Five new feature checks all passed. Actual live board read verified @lyribop and Personalized Song Gifts.
- Do not repeat a full suite without a relevant change or unresolved failure. No long public test waits; prepare first, then use the earliest practical 2–3-minute slot only if a live test is actually needed and explicitly approved.
- Weekly performance reporting and promotions remain backlog. Bill explicitly prioritized finishing the scheduler.

## Evidence and preservation

Evidence screenshots/logs are in the workspace outputs folder, including instagram-scheduler-installed-off-2026-11-06.png, pinterest-trial-status-2026-11-06.png, and pinterest-board-access-verified-2026-11-06.png.

Unrelated local edits in posting-history.json and homepage-preview.html are preserved, excluded from scheduler commits, and copied into the closeout backup. No credentials belong in GitHub or this document.
