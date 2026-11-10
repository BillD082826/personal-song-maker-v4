# LyriBop scheduler — current checkpoint

Updated November 7, 2026, America/New_York. Read STORYSONG_PROJECT.md and LYRIBOP_WORKFLOW_RULES.md before resuming. This summary supplements the historical ledger.

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

1. Dashboard start/stop controls are now built locally, with all six targeted checks passed, including real PostgreSQL. Next: approve deployment and one-time server configuration while DB switches stay OFF. No repeat test is needed. The controls are not deployed or active yet.
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


### Scheduler Controls Deployed and Prepared OFF — November 7, 2026

Bill approved deployment and one-time configuration, with no ad approval or posting. Render deployment dep-dbnhntnf3r2c738mh9qg observed Deploy succeeded|Live, exact revision ba430e0040c9f208bd65eaa1bd79306386400726. Added only AD_SCHEDULER_FACEBOOK_WORKER_ENABLED=true and AD_SCHEDULER_INSTAGRAM_WORKER_ENABLED=true using Save only before deployment. Both DB switches verified false before and after. No storage migration needed.

Post-deploy worker statuses: configured:true, enabled:false, last_tick:null,last_outcome:null,needs_attention:false for Facebook and Instagram. Read-only SchedulerControls.inspect: can_start:true,can_stop:true,reasons:[],queue:[],provider_requests:0 for each. No Start/change/approval/publication invoked. Dashboard shows Scheduler Controls navigation, automatic posting off, one historical plan and three earlier verified posts. Inner panel visual check remains incomplete: automatic UI approval review rejected navigation coordinate click as potentially activating Start; no bypass attempted. Server readiness independently verified. Six targeted tests previously passed; no changed source or redundant tests. Pinterest public automation still unavailable/unimplemented; uncertain guard preserved. This supersedes older not-deployed/configured-false summaries. Next: review intended queue and current connection before explicit activation; finish remaining notices/instructions and Pinterest access-dependent work.


### Scheduler Operating Guidance Prepared — November 7, 2026

Added expandable operating instructions in Scheduler Controls and LYRIBOP_SCHEDULER_GUIDE.md. Controls now display bounded existing worker outcome explanations, clear instructions for unresolved deliveries, and a status-unavailable notice that does not imply OFF. No sending, approval, authorization or switch behavior changed. node --check scheduler.js and git diff --check passed. No repeated integration/public test needed for wording-only changes. This update is saved for deployment review; live remains ba430e0. Both schedulers last verified OFF. Unrelated posting-history.json and homepage-preview.html edits preserved/excluded.


### Scheduler Guidance Live — November 7, 2026

Bill approved guidance deployment. Render dep-dbnhsm49v7es73cqm100 observed Deploy succeeded|Live at exact revision d967af84f23696db698081e5fae309b439941c38. Read-only live file check verified operating guide, expandable instructions and status-unavailable notice present. Both post-deploy worker statuses configured:true, enabled:false, last_tick:null,last_outcome:null,needs_attention:false. No approvals, switch changes or posts. No environment/storage changes. This supersedes previous pending-deployment guidance note. UI inner panel visual verification remains outstanding; deployment contents and OFF states independently verified.


### Live Controls Visual Review Passed — November 7, 2026

Opened actual hosted Scheduler Controls navigation without activating either platform. Both platform cards visibly show OFF, zero approved posts waiting and separate Start/Stop buttons. Expandable How to use the scheduler opens and shows deployed instructions, uncertainty guidance and Pinterest draft-only limit. No layout overlap observed at current Safari desktop size. Screenshot saved in workspace outputs/scheduler-controls-live-review-2026-11-07.png. This resolves the earlier outstanding inner-panel visual check. No plan/approval/switch/provider-post changes. Next prepare a proposed weekly ad selection for Bill's review before any activation.


### Weekly Drafts Saved November 7–13 — November 7, 2026

Bill accepted reviewed static-ad selection and authorized starting today. At preparation time all 9AM/1PM/6PM Eastern slots were future. Saved 42 hosted draft plans, 21 each Facebook/Instagram, with distinct ads per daily slot and platform-specific saved captions/artwork. Local reviewed manifest outputs/reviewed-week-2026-11-07.json. Existing planner validation and snapshot/media storage used; no direct plan inserts. Initial interrupted batch left 27 drafts; reconciliation compared every existing slot against exact ad ID/caption SHA256/artwork SHA256 and added only 15 missing drafts, no duplicates/replacements. Final server result week_plans:42,facebook_off:true,instagram_off:true,posting_approvals_created:0. No Start or approval invoked; no posts sent. These are drafts awaiting posting approval/activation, not scheduled publication claims.


### First Reviewed Week Approved and Activated — November 7, 2026

Bill explicitly answered yes to approving and activating November 7–13, 42 static posts at9AM/1PM/6PM Eastern,21 each Facebook/Instagram. Rechecked all42 exact stored slots, ad IDs, caption SHA256 and artwork SHA256 against reviewed local manifest, no existing deliveries, all times future. Fresh bound-account readiness passed both platforms before approval. Existing approveBatch services returned21 approvals each; SchedulerControls inspected exact21-item queues and change performed fresh connection checks plus locked fingerprint revalidation. Both enabled:true,posts_changed:0 at activation. First due time2026-11-07T14:00:00Z (9AM EST). No immediate/public test post submitted.

Read-only worker statuses after activation both configured:true,enabled:true,last_outcome:waiting,needs_attention:false, last_tick2026-11-07T13:06:50Z. Hosted dashboard shows Facebook & Instagram scheduling enabled and43 saved plans (42 new weekly plans plus one historical plan),3 previously verified posts. Evidence outputs/weekly-scheduling-active-2026-11-07.png. Activation script saved workspace outputs/activate-reviewed-week-2026-11-07.mjs; do NOT rerun, existing approvals/guards must remain. Pinterest unchanged/unavailable. IMPORTANT: supersedes all earlier OFF summaries. Both workers are now ON; later explicitly approved posts can also become eligible. Future changes/approvals require their own review. Posting Report is the source of delivery results; future scheduled publication not yet verified.


### Session Closeout / Pinterest Pending Verified — November 7, 2026

Pinterest My Apps live status now explicitly shows LyriBop Marketing Scheduler, Trial access active, Upgrade to Standard access pending. No expected review timeframe displayed. Screenshot outputs/pinterest-status-pending-2026-11-07.png. No resubmission/settings/auth changes. Supersedes prior uncertainty about whether request was pending. Pinterest video folder restored locally and pushed dc94902; no Render deployment of that local dashboard update. Customer-avatar notes reviewed as reference only, no marketing/offer changes.

Weekly Facebook/Instagram schedule remains authorized ON for November7–13,42 static posts. Last checked workers healthy/waiting; do not claim future delivery success without Posting Report evidence. No repeated tests or extra ads. Facebook manual-video execution investigation remains deferred by Bill; Pinterest automatic publishing remains unavailable pending Standard and implementation. Preexisting unrelated posting-history.json and homepage-preview.html edits remain untouched and excluded from these commits. Resume by reading latest checkpoints before any action.


### Facebook Manual Video Upload Investigation — November 7, 2026

Bill reported endless loading for Arlo and Guilty Dog. All8 updated MP4s fully decoded without errors; local HTTP downloads returned video/mp4 and SHA256-identical complete files. Arlo/Guilty originals vs updated versions compared; update adds4-second offer card and repackages/encodes, no proven corruption. Created diagnostic re-exports in workspace outputs/facebook-video-check-2026-11-07 with verified decode; did not replace dashboard files. Diagnostic Arlo still looped in Safari per Bill. In Chrome, Bill confirmed diagnostic Arlo loaded, then original dashboard Arlo loaded; screenshot shows single19-second uploaded clip and Arlo preview. Other thumbnails are frame-based cover choices, not extra clips. Chrome is the verified workaround for Arlo; Safari-specific cause not established. Guilty Dog has not yet been separately confirmed uploading in Chrome. Bill closed/discarded test draft, no test publication authorized or performed. Keep original dashboard media unchanged; use Chrome for manual Facebook video uploads. Active static weekly schedule unaffected.

Earlier today live Posting Report verified four new scheduled posts: November7 9AM Facebook/Instagram at9:00:22AM;1PM Facebook1:00:20PM and Instagram1:00:27PM Eastern. Dashboard7 verified total includes3 prior posts. Evidence outputs/first-week-four-posts-verified-2026-11-07.png. Evening/future results require fresh verification.


### Weekly Delivery Report Prepared — November 7, 2026

Built pure weeklySchedulerReport projection and Admin/feature-gated no-store GET /weekly-report?start=YYYY-MM-DD. Select seven Eastern scheduled local dates; platform counts/items distinguish verified,upcoming,overdue,in-progress,needs-review,canceled. Uses existing validated receipts; manual tests excluded from weekly scheduled cohort. No provider calls, credentials returned, approvals/switches altered or posts sent. CSV export and date-change invalidation in Ad Performance panel, lifetime one-test Instagram reader kept separate. Audience reach/views/engagement/clicks remain explicitly not connected/null, no ranking or weekly-engagement claim. This is delivery-summary foundation, not completed multi-platform audience performance collection or email automation.

Four focused checks passed,0fail/0skip: seven-day boundaries/cohort,uncertainty vs success,invalid data,Admin/enablement/no-store/sanitized response. Initial HTTP check denied local socket permission; rerun with granted network passes all4. Syntax and diff checks pass. No new database schema or background work. Saved for deployment review; not live yet. Active weekly static schedule must remain ON and unchanged.


### Weekly Delivery Report Live — November 7, 2026

Bill explicitly approved report deployment. Render dep-dbnntj7f3r2c73961i8g observed Deploy succeeded|Live exact revision58c451420b930807cc7fcf1a54232cdf25362d38. No environment/schema/worker/approval changes. Actual hosted Ad Performance weekly report selected2026-11-07 through13 and displayed Facebook2verified19upcoming and Instagram2verified19upcoming, zerooverdue/inprogress/needsreview/canceled; Pinterestallzero.42rows and per-row audience Not connected, CSV button enabled. Earlier manual3tests excluded from weekly cohort. Initial button unresponsive with old cached script; Safari full reload resolved; no source fix needed. Screenshot outputs/weekly-report-live-2026-11-07.png. Both schedulers still enabled on hosted banner. No new posts triggered by checks. Four focused tests passed before deployment.

Delivery-summary report now live. Audience reach/views/engagement/clicks for scheduled posts, comparisons/ranking, weekly audience deltas, email/automatic weekly report delivery remain unfinished. Existing one-test lifetimeInstagram metrics remain separate. Do not claim full performance-report completion. Bill reported38%5hour/14%weekly; finish checkpoint and pause newfeaturework.


### Scheduled Instagram Audience Reader Built — November 7, 2026

Added lib/instagram-weekly-performance.mjs: read-only verified scheduled Instagram receipt cohort selected by seven local scheduled dates, limit21; validates existing receipt projection and exact account/media/caption/type/permalink before metrics. Reuses known six lifetime metric endpoints and extends strict parser with validated expected media ID while retaining default test-ID binding. Current active connection and analytics grant inventory checked; no new OAuth/scopes requested. Bounded page3posts, max21post/metricGETs per read plus bounded existing account/grant preflight, no retries/timers/writes. Shared per-minute cache/coalescing with concurrent different-page refusal. Admin/flag/no-store GET /instagram-weekly-performance, safe errors.

Ad Performance gains separate scheduled Instagram lifetime section using selected week, per-metric unavailable status, Next Posts pagination and date invalidation. No summing reach or claiming weekly activity. Existing delivery CSV and lifetime test view remain separate; Facebook audience/Pinterest integration and true weekly activity/email remain unfinished.19targeted checks passed/0fail/0skip including7new scheduled reader/route tests and affected old metrics/performance/weekly tests. Syntax/diff pass. No live provider read, deployment or UI visual verification yet; save for review. Active42-post weekly schedule untouched and remains authorized ON.


### Scheduled Instagram Audience Reader Live — November 7, 2026

Approved deployment and one read verified. Render dep-dbno50p5efls73bsu5n0 observed Deploy succeeded|Live exact revision be2ee5ab1cb3309967de67894a2a6370cdf57650. Hosted Ad Performance week2026-11-07 through13 returned2verified posts at3:01:37PM Eastern: Turn Your Story into a Song views2/reach2; Dad’s Birthday views1/reach1; likes/comments/saves/shares all0 for both. Per-post lifetime organic totals, not weekly activity or summed unique reach. No publishing, permission, schema, approval or schedule changes. Banner still Facebook & Instagram scheduling enabled,43plans/7verifiedtotal.19targeted tests passed before deployment. Evidence outputs/scheduled-instagram-insights-live-2026-11-07.png.

Resume: Instagram scheduled lifetime reader now live. Facebook audience metrics, true weekly activity/deltas, rankings and automated report email unfinished. Pinterest Standard approval pending; automatic videos not built. Active42static weekly posts remain ON unchanged. Bill reported6%5hour/9%weekly; save and stop new work.


### Instagram Figures CSV Prepared — November 7, 2026

Added Download Loaded Instagram Figures CSV beside scheduled insights. Exports only successfully loaded pages with selected scheduled week, per-post lifetime scope, collection timestamp, loaded/available counts and individual metric statuses; unavailable values blank, real0preserved. Fresh reads/date changes/failures invalidate export; no extra provider calls or posts. Spreadsheet formula-prefix escaping included. Clarified delivery-table explanatory copy. Targeted export harness passed zero/unavailable, formula escaping, partial-cohort disclosure, lifetime label and stale-week refusal. Syntax/diff checks passed. Saved for deployment review; not live. Active schedule unchanged.


### Instagram CSV Live — November 7, 2026

Approved release dep-dbnrbqs9v7es73di4li0 observed Deploy succeeded|Live exact ef526462a0ed9f123e4a52a2934080d7beb27556. Export disabled before collection and enabled after read at6:40:58PM Eastern for3verified scheduled Instagram posts: Story views2/reach2,Dad views2/reach2,Little Things Anniversary views0/reach0,othermetrics0. Safari Downloads visibly confirmed LyriBop-Instagram-lifetime-2026-11-07.csv,1KB. Actual downloaded-file parsing blocked by macOS file access despite read grant; do not claim content reparse. Prior focused export harness passed. Banner43plans/9verifiedtotal and both schedulers enabled. No schedule/approval/permission changes or test posts. Active week stays ON. Facebook audience,true weekly activity,rankings,email and Pinterest approval remain open.


### Current Analytics Grant Inventory — November 7, 2026

Ran existing read-only scripts/analytics-access-review.mjs --review-meta-grants on live Render. Observed pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights all granted; read_insights not_returned. instagram_business_basic/manage_insights not_returned. Report explicitly insights_endpoint_verified:false,permissions_changed:0,posts_changed:0. Publishing_enabled:false is this audit output safety flag, NOT a scheduler switch change; active schedule untouched. No tokens logged. Official Meta insights documentation retrieval returned429; no third-party metric names or permission requirements adopted.

Next Facebook work: confirm current official Page/post insight endpoint and scope requirements, then review the minimum additional permission if needed; any access expansion requires specific approval. Do not restart authentication blindly or claim Page insights works from publishing success. Existing Instagram lifetime reader/export remains working.


### Facebook Insights App Permission Added — November 7, 2026

Official Meta permissions reference read in Safari confirms read_insights reads owned Page/app/domain Insights; dependencies pages_read_engagement/pages_show_list already granted in live inventory. Bill explicitly approved adding this app permission. In app1689275265898013 Page use case PAGES_API clicked only read_insights Add; Meta changed row to0calls,Ready for testing,Actions. No other permission added. No account consent,login configuration save,credential replacement,authorization activation or scheduler switch change performed. App capability is NOT proof stored account authorization has this grant or endpoint access works.

Next inspect active login configuration2105143776809540 to see whether read_insights can be selected; review exact change before saving or new consent. Existing active FB/IG schedule remains unchanged ON. Do not replay old authorization flows or replace active credentials blindly.


### Facebook Insights Login Configuration Saved — November 7, 2026

Bill explicitly approved selection/save. Existing config2105143776809540 edited only by selecting read_insights (4to5selected); no automatic extra selection observed. Save returned configuration list; expanded persisted details confirm instagram_basic,instagram_content_publish,instagram_manage_insights,instagram_manage_messages,read_insights. LoginGeneral,SystemUser,neverexpiry,Instagramaccounts asset remained displayed unchanged. No account consent/new login/tokenactivation/runtime changes. Current publishing authorization still preserved; stored token read_insights grant not yet verified. Next fresh login and exact account consent needs approval, then inspect pending authorization/grants; do not replace working scheduler binding blindly.


### Gmail Order Email Prepared — November 10, 2026

Bill reported Resend testing-only customer delivery failure. Live Resend Domains inspected:No domains yet. Bill has no owned domain/cannot purchase; approved Gmail connection for lyribop@gmail.com. Built explicit TRANSACTIONAL_EMAIL_PROVIDER=gmail transport for confirmations,manual song deliveries,Admin new-paid-order alerts, fixed sender/TLSsmtp.gmail.com465,app-password-only config,one recipient,disabled URL/file loading,short timeouts,safe errors,no silent fallback/retry. Existing Resend default untouched; seller/marketing still Resend.

Added additive gmail_delivery_emails schema and permanent per-order delivery claim to prevent repeated/concurrent Gmail sends; sent receipt reused,uncertain blocked,explicit rejection later manual retry allowed,changedpayload blocked. Existing confirmation/alert durable state retained. Added no-send --check/--verify script and LYRIBOP_GMAIL_SETUP.md. Nodemailer10.5.0 installed from npm; initial defaultcache permission denied, isolated/tmpcache succeeded,no systemownership changes. Added dependency has no npm advisory; unrelated existing advisories unchanged.8focusedchecks pass0fail0skip (sixGmail plus existingconfirmation/alert suites),syntax/diffpass. Calls mocked,real DB migration/SMTP auth/receipt not yetverified. No email/account connection/live setting/deployment performed.

Next deploy reviewed source,then user-owned Google app-password handoff(two-step required) and direct Render secret entry; never request credential in chat. Explicit recipient/content approval before real email. Manual Copy Link+Gmail remains available now. Preserve active ad schedule; MetaInsights authorization paused by urgent email task,configsavedbutfreshconsent unfinished. All existing unrelated local changes preserved.


### Gmail Source Deployed, Account Setup Pending — November 10, 2026

Bill approved deploy. Render dep-dbpivitg1s2s738ij8h0 observed Deploy succeeded|Live exact64fc6fa1c93347899258b9d0f16ddb3495e9fce1. Read-only deployed shell check returned provider:resend,configured:true,delivery_guard_installed:true,emails_sent:0. Additive gmail_delivery_emails table exists; Gmail remains off until direct user-owned account credential/config setup. No email sent,no credentials inspected,no scheduler setting changed. Existing Resend testing-only issue persists until Gmail activation. Next user signs into lyribop@gmail.com; inspect two-step/App Password eligibility,hand off credential creation and direct Render entry;do not ask for password in chat. Then no-send authentication verify and one explicitly approved intended recipient email.
