# StorySong Project Ledger

**Project:** StorySong  
**Tagline:** Every story deserves a song.  
**Repository:** personal-song-maker-v4  
**Active branch:** v5-storefront  

## Purpose of This File

This file is the authoritative working record for the StorySong project.

It exists to preserve project status, unfinished work, verified behavior, decisions, naming research, and important implementation history across development sessions.

## REQUIRED SESSION PROTOCOL

### Start of Every New Chat

Before making project decisions or changing code:

1. Read `STORYSONG_PROJECT.md` first.
2. Treat this ledger as authoritative over ChatGPT conversational memory.
3. Check `git status` and recent Git history when development work is being resumed.
4. Review `Current Verified Status` and `Master TODO` before deciding what comes next.
5. Do not recreate, reverse, repeat, or declare work unfinished until this ledger and the repository have been checked.
6. If a new chat begins because the previous chat reached its length limit, resume from this ledger rather than attempting to reconstruct project state from memory alone.

### During Every Substantial Session

Do not wait until the chat is ending to preserve important work.

Whenever a significant feature, fix, verification, deployment, security change, documentation update, marketing asset, or project decision is completed, update this ledger at that checkpoint.

### End of Every Substantial Session

Before the final commit and push:

1. Review everything changed during the session.
2. Update `Current Verified Status` when appropriate.
3. Update `Master TODO`: add newly discovered work and close only work that has been verified complete.
4. Record important decisions and verification results.
5. Record new documentation, marketing, operational, deployment, or security changes.
6. Run Git validation checks.
7. Commit the ledger with the related project changes.
8. Push the commit to GitHub.
9. Confirm the working tree is clean and synchronized.

**Continuity rule:** A ChatGPT conversation, memory, summary, or chat-length boundary is never the authoritative project state. `STORYSONG_PROJECT.md` and the verified repository state are the continuity record.

### Working Rules

- Update this file whenever StorySong work changes project status, TODOs, decisions, or verified behavior.
- Update it before ending a substantial StorySong development session.
- Commit ledger changes to Git with the related project changes.
- Distinguish VERIFIED facts from unresolved questions or remembered items that still require verification.
- Do not treat conversational memory as the authoritative project record when this ledger contains the answer.
- Do not remove unresolved items merely because they were discussed; move or close them only when their disposition is verified.


## Current Verified Status

**Current status snapshot:** September 24, 2026

- Active local branch: `v5-storefront`.

- Local branch and `origin/v5-storefront` were confirmed synchronized after commit `2860332` — `Update LyriBop project ledger and backup retention`.

- Working tree was confirmed clean immediately after that push.

- Customer-facing brand is `LyriBop™`.

- Customer-facing LyriBop rebrand is complete. Selected historical/internal StorySong identifiers remain intentionally unchanged where renaming them is unnecessary or could introduce risk.

- `LyriBop™` is the current working brand. It is not documented here as federally registered or formally cleared. Do not use `LyriBop®` unless that status changes.

- Live V5 Render service is `personal-song-maker-v5-test`.

- Do not assume the live Render deployment commit from Git history alone. Verify the deployed version separately whenever exact live deployment status matters.

- Production database is PostgreSQL 18 on Render, resource `personal-song-maker-db`.

- Production database includes the established application tables plus `backup_history`, which records successful disaster-backup runs.

- LyriBop disaster backup is configured for Sunday at 2:00 AM and protects both the PostgreSQL database and project source.

- Manual full-backup verification confirmed database dump validation, source archive validation, backup-history reporting, and automatic retention at 12 database backups plus 12 source backups.

- Scheduled LaunchAgent retention remains an OPEN verification item because retention cleanup has not yet been independently confirmed during an actual LaunchAgent-run backup.

- The repository recovery copy of `backup/lyribop-backup.sh` matches the current runtime backup script as of this snapshot.

- The Admin backup-status configuration reports automatic retention with a target of 12 backup sets. Exact live behavior should be treated as deployed only after the corresponding Render deployment is verified.

- The reusable LyriBop social-media package contains seven advertising images, matching Instagram and Facebook captions, and posting instructions under `marketing/social-media/`.

- Current unresolved work is maintained in `Master TODO` below.

- Current application source is primarily:

  - `server.mjs`
  - `public/admin.html`
  - `public/order.html`
  - `public/delivery.html`
  - `public/index.html`
  - `public/seller.html`

- The existing `README.md` remains an older V4-oriented deployment document and is not the authoritative project record.

- `STORYSONG_PROJECT.md` is the authoritative continuity record for project status, verified behavior, decisions, and unresolved work.


## Master TODO

### OPEN — LyriBop Ad Discovery / Keyword Optimization

- Review all existing Facebook and Instagram LyriBop ads and caption masters for natural niche-specific discovery keywords.
- Use clear customer-facing phrases such as `personalized song`, `custom song`, `personalized pet song`, `birthday song`, `anniversary gift`, and other subject-specific terms where they naturally match each ad.
- Optimize three areas where appropriate: on-screen text, social-media captions, and audio/video titles.
- Keep relevant hashtags, but do not rely on hashtags alone for discovery.
- Match keywords to each advertisement's actual subject and audience; avoid keyword stuffing.
- Review existing approved videos individually before changing rendered on-screen text. Do not rebuild an approved video unless the expected benefit justifies the change.
- Apply this keyword/discovery approach to all new LyriBop campaign ads going forward.
- Existing caption masters should be updated systematically when this work resumes.


### OPEN — Scheduled Backup Retention Verification

- Verify that automatic retention succeeds when the LyriBop disaster backup runs through the macOS LaunchAgent.
- Manual full-backup testing successfully verified retention at 12 database backups and 12 source backups.
- Scheduled LaunchAgent retention is not yet independently verified because earlier macOS/iCloud directory-enumeration behavior caused permission problems.
- Do not mark this complete until a LaunchAgent-run backup confirms retention cleanup works in that execution context.

### COMPLETE — PayPal Refund Buyer-Side Settlement Verification

- Merchant-side refund issuance was successfully verified.
- Final buyer-side settlement/receipt of the live PayPal refund was confirmed on September 25, 2026.
- The controlled Live PayPal refund workflow is now verified through both merchant issuance and final buyer receipt.

### COMPLETE — Avery 5876 Physical Stock Verification

- Seller business-card layout was physically tested on actual Avery 5876 perforated business-card stock.
- Final layout was visually approved on the real Avery card with no further adjustment required.
- Final measured alignment: top to LyriBop name 0.312 inch; top to QR code 0.312 inch; Referral Code to bottom 0.437 inch; QR wording to bottom 0.312 inch; left margin 0.187 inch; right margin 0.125 inch.
- QR size was finalized at 1.18 inches after physical-stock testing.
- Final QR refinement commit: `38b49ff` (`Refine seller card QR size for Avery 5876`).

### MONITOR — LyriBop Working Brand / Naming

- LyriBop is the current working replacement brand and the customer-facing rebrand is complete.
- Preliminary public-web research did not identify a decisive conflict.
- LyriBop has not been documented in this ledger as federally registered or formally cleared.
- Continue using `LyriBop™`, not `LyriBop®`, unless formal trademark status changes.
- Earlier incomplete StorySong replacement-name recovery remains historical research and must not be mistaken for the current brand decision.

## Decision Log

### Project Record

- `STORYSONG_PROJECT.md` is the authoritative project ledger.
- Important StorySong decisions, TODOs, verified workflows, and unresolved questions must be recorded here rather than relying on conversational memory.
- Git history and current source code are the primary evidence for implementation claims.
- Production behavior should be verified before being documented as fact when practical.
- Items recovered only from prior discussion must be labeled as unverified until supported by code, Git history, production behavior, or other concrete evidence.

### Documentation

- User Manual changes should be batched when practical rather than making repeated small documentation edits.
- Admin Create Song refresh/resume guidance belongs in both:
  - the official User Manual, with full workflow detail;
  - Store Settings, as concise operational guidance.
- Documentation must distinguish browser-session recovery from permanent persistence.

### Test Orders

- Development/test songs should be classified using **Mark as Test**.
- Test-order cleanup means proper classification and separation from real business activity; it does not mean deleting order history.
- Preserve order history unless a separate deletion feature is deliberately designed and implemented later.

### Naming Research — RocketSong Standard

- Do not keep presenting or promoting a proposed product name without concrete evidence that it is realistically usable.
- Availability/conflict research comes before subjective enthusiasm about a name.
- A name remains only a candidate until adequate evidence supports keeping it under consideration.
- Record naming candidates, evidence, conflicts, eliminations, and unresolved checks in this ledger so the naming search does not have to be reconstructed from conversation history.


## Naming Search

### Recovery Status

**INCOMPLETE — DO NOT TREAT THIS AS THE COMPLETE CANDIDATE LIST.**

A previous StorySong naming search contained more candidates than have currently been recovered. Do not describe the names below as "the finalists" unless later evidence establishes that.

### Recovered Candidate Names

- `Sonly`
- `Songly`
- `SonlyBop`
- `Songry`

### Recovered Research Status

#### Songly

**Status: Conflict identified during prior research.**

Recovered research found multiple existing uses of Songly, including a music-related app/service and music/licensing/custom-song uses.

Under the RocketSong Standard, Songly should not be promoted as an available StorySong replacement without new concrete evidence resolving those conflicts.

#### Sonly

**Status: Unresolved.**

Prior research surfaced uses of Sonly, including a recording-artist use and an unrelated industrial trademark. The significance of those findings to the intended StorySong business name has not been conclusively established.

Do not mark Sonly available or eliminated without further concrete research.

#### SonlyBop

**Status: Unresolved.**

No decisive conflict was recovered from the earlier first-pass search, but that is not proof of availability.

Further concrete availability/conflict research is required.

#### Songry

**Status: Unresolved.**

No decisive conflict was recovered from the earlier first-pass search, but that is not proof of availability.

Further concrete availability/conflict research is required.

### Missing Naming History

- Additional previously discussed candidate names have not yet been recovered.
- The previous shortlist/finalist structure has not been reliably recovered.
- Do not invent missing candidates from memory.
- If additional naming history is recovered from evidence later, add it here with its source/status.
- Resume serious naming evaluation only under the RocketSong Standard: establish concrete usability evidence before investing in subjective comparison.


## Technical Verification

### Server Syntax

**VERIFIED:** The current `server.mjs` passes:

`node --check server.mjs`

The check completed successfully with no syntax errors during the September 2026 recovery.


## Completed / Verified

### Core StorySong Application

- StorySong is the current product brand; tagline: **Every story deserves a song.**
- The current application uses PostgreSQL for persistent application data.
- Customer orders, song versions, reviews, sellers, payouts, accounting records, generation costs, marketing records, and store settings have corresponding production database tables.
- Store pricing and operational settings are database-backed.
- Customer delivery uses private delivery tokens.
- Preview access uses preview tokens.
- PayPal payment endpoints are implemented for order creation and capture.
- Resend-based email functionality is implemented.
- OpenAI-based song/lyrics generation is implemented.
- Music/audio generation workflow is implemented.
- Preview clipping uses FFmpeg.

### Admin Order Workflow

- Admin includes separate Active Orders, Closed Orders, and Test Orders views.
- Order workflow supports lyrics creation, music generation, Ready status, customer delivery, and Delivered status.
- Admin can review lyrics before music generation.
- Admin can revise lyrics and create additional song versions.
- Individual versions can have their own generated audio.
- Admin can select which song version is current.
- The selected version controls the primary Admin lyrics/audio and customer delivery version.
- Admin can create alternate music versions while preserving the existing lyrics.
- Customer delivery supports song playback, MP3 download, printable lyrics, and customer reviews.

### Admin Create Song

- Admin has a dedicated **Create Song** workflow that bypasses customer checkout.
- Admin-created songs are `$0.00`.
- The workflow supports a 30-second preview before full-song approval.
- Admin can create additional preview versions without creating a new order.
- Alternate preview versions can use different music/vocal settings while retaining the existing order/lyrics workflow.
- Admin can choose the active preview version before approval.
- Approval generates the full song and moves the order to Ready.
- Song length is persisted for Admin-created songs.
- Admin Create Song refresh/resume recovery is implemented using browser `sessionStorage`.
- Active preview identity, preview version, and full form state are restored after refresh within the active browser session.
- Successful approval clears the saved recovery state.

### Sellers and Referrals

- Seller records and referral codes are implemented.
- Orders can be associated with sellers.
- Seller portal functionality is implemented.
- Seller commission and payout data are supported.
- Seller-specific store displays are implemented.
- Automatic seller reports are implemented with configurable schedule settings.

### Business Administration

- Admin reporting includes sales, customers, and sellers.
- Accounting functionality is implemented.
- Vendor management is implemented.
- Accounts payable tracking is implemented.
- AI generation-cost tracking is implemented.
- Customer marketing functionality and marketing-email history are implemented.
- Customer marketing preferences/unsubscribe handling are implemented.
- Customer review administration is implemented.

### Admin Documentation

- Admin contains an integrated **User Manual**.
- Admin contains **Forms & Checklists**.
- Existing manual chapters cover the Dashboard, Admin Create Song, lyric revisions and versions, alternate music, final QC and delivery, customer delivery/reviews, paid-order processing, reports/accounting, troubleshooting/recovery, and forms/checklists.
- Existing QC forms include Song Version QC, Final Order & Delivery QC, and Customer Delivery QC.
- The remaining Admin Create Song refresh/resume documentation work is tracked in the Master TODO above.


## Naming / Brand Research — September 20, 2026

### Working Brand Decision

- **LyriBop™** is the current working replacement brand being considered for StorySong.
- The LyriBop brand migration has begun. The customer storefront (`public/order.html`) was rebranded from StorySong to LyriBop and verified live on September 20, 2026. Other application areas still retain StorySong branding and will be migrated separately.
- LyriBop has **not** been federally registered as a trademark.
- LyriBop has **not** received formal legal trademark clearance.
- Public-web conflict research did not identify a decisive reason to reject LyriBop at the preliminary brand-screening stage.
- Concentrated research included exact-name searches, spelling/spacing variants, phonetic neighbors, music and software uses, AI-song products, artists, businesses, personalized-song services, and trademark-oriented searches.
- No exact active LyriBop / Lyri Bop personalized-song company, AI-song generator, music application, recording artist, or obvious exact federal trademark was identified in the research performed.
- Known neighboring names/usages requiring awareness include **LyriTunes**, an AI song-making application in a related market, and **Lyripop**, which has existing music-related usage.
- The working decision is that LyriBop is reasonable to test as a brand, subject to the understanding that public-web research is not equivalent to comprehensive professional trademark clearance.
- If used before federal registration, the appropriate designation is **LyriBop™**, not LyriBop®.

### Naming Research Summary

Numerous candidate names were researched and rejected because of existing music, software, AI-song, personalized-song, artist, company, or trademark conflicts. Significant rejected candidates included Songly, Sonly, Songry, Soly, Mele, SongVerse, Lyros, Belsong, Sonosphere, Auronics, Melory, Memody, StoryBop, TuneTale, TuneJoy, SongSprout, SongTale, Songaroo, SongCraft, Melodator, Songomatic, Songiverse, ScribeBeat, Tunify, Tunely, Tunix, Tunerator, Tunator, Tuneine, Chordiify, Scalio, Melodify, Melodio, Chordator, Melodine, Harmonify, Melodizoo, SS Songworks, Apollo Soundworks, Cretune, Cremelo, Songbeau, Ballad Memoir, Ode Melody, Soundtrack Memories, and Sonpretty.

Other names surviving preliminary research included Tune Memoir, Melodater, Lyriloo, Lyronggo, SonlyBop, LyriJoy, TuneBonny, and LyriBop. After considering the intended advertising strategy and desired younger, energetic brand character, **LyriBop was selected as the current working brand for further use/testing**.

### Branding Strategy

- The product name does not need to explain the entire personalized-song service by itself.
- Advertising and storefront messaging are expected to communicate the core proposition: the customer provides a story and the service turns it into a personalized song.
- The working brand should therefore prioritize memorability, pronunciation, distinctiveness, and suitability for advertising rather than attempting to describe every product feature.
- Federal trademark registration may be considered later if the LyriBop brand demonstrates commercial traction.

### LyriBop Brand Migration — Customer Storefront

- On September 20, 2026, the customer storefront (`public/order.html`) was rebranded from StorySong to **LyriBop**.
- Customer-facing product wording was cleaned up so **LyriBop** is used as the brand and **song** is used as the product noun.
- Existing internal identifiers were intentionally preserved, including `storysongCheckoutState` and `initializeStorySongPage()`, to avoid unnecessary risk to verified checkout/session behavior.
- Commit `0c78746` — `Rebrand customer storefront to LyriBop`.
- Commit `0c78746` was pushed to branch `v5-storefront`.
- The first Render auto-deploy timed out waiting for the internal health check even though the build succeeded. A manual **Deploy latest commit** retry succeeded.
- Render verified commit `0c78746` as **Live**.
- The live customer storefront at `/order.html` was visually verified from the header through the pricing/preview section and footer. LyriBop branding, tagline, customer wording, live store price, preview controls, and page layout displayed correctly.
- Remaining StorySong branding elsewhere in the application must be migrated deliberately rather than with a global replacement.

### LyriBop Brand Migration — Customer Delivery Page

- On September 20, 2026, the customer delivery page (`public/delivery.html`) was rebranded from StorySong to **LyriBop**.
- Customer-facing wording now uses **LyriBop** as the brand and **song** as the product noun, including the order-number area, assistance text, review wording, second-song heading, and MP3 fallback filenames.
- Commit `f656c47` — `Rebrand customer delivery page to LyriBop`.
- Commit `f656c47` was pushed to branch `v5-storefront` and successfully deployed by Render.
- Render verified commit `f656c47` as **Live**.
- The live Customer Delivery page was visually verified using an existing Admin-created song/order. The LyriBop branding, order information, song title, audio player, Download MP3, Print Lyrics, and review section displayed correctly.
- The optional second-song section was not displayed by the order used for live visual verification; its LyriBop wording and fallback filenames were verified in source code.
- The Admin interface still retains StorySong branding and has not yet been migrated.

### LyriBop Brand Migration — Seller Portal

- On September 20, 2026, the seller portal (`public/seller.html`) was rebranded from StorySong to **LyriBop**.
- Visible branding was updated in the browser title, Seller Portal header, and footer.
- The internal session-storage key `storysongSellerToken` was intentionally preserved to avoid unnecessary risk to verified seller-session behavior.
- Commit `3742c8b` — `Rebrand seller portal to LyriBop`.
- Commit `3742c8b` was pushed to branch `v5-storefront` and successfully deployed by Render.
- Render verified commit `3742c8b` as **Live**.
- The live Seller Portal was visually verified using Nicole Ring's existing seller portal access. LyriBop branding, referral information, commission data, payout history, referral link, and page layout displayed correctly.
- The live footer was separately verified as `© 2026 LyriBop · Seller Portal`.

### LyriBop Brand Migration — Web App Manifest

- On September 20, 2026, `public/manifest.webmanifest` was rebranded from StorySong / Song Maker to **LyriBop**.
- The manifest `name` and `short_name` are now both `LyriBop`.
- The manifest description, start URL, display mode, and theme/background colors were left unchanged.
- Commit `1d24f74` — `Rebrand web app manifest to LyriBop`.
- Commit `1d24f74` was pushed to branch `v5-storefront`.
- Render verified commit `1d24f74` as **Live**.

### LyriBop Brand Migration — Server Messaging

- On September 20, 2026, `server.mjs` was rebranded from StorySong to **LyriBop** in customer-facing and operational messaging.

- Updated areas include the Admin Basic Auth realm, ordering-paused messages, PayPal order description and payment-verification message, Resend fallback sender names, customer delivery email, seller portal email, seller report email, marketing/unsubscribe messaging, Store Settings fallback turnaround messages, song-title/error fallbacks, review messages, and the server startup log.

- Product wording was cleaned up where appropriate so **LyriBop** is used as the brand and **song** is used as the product noun. Generic song-title fallbacks now use `Your Song`.

- No application routes, SQL operations, payment calculations, song-generation logic, version-selection logic, or review logic were intentionally changed as part of this migration.

- A post-edit search confirmed zero remaining `StorySong` occurrences in `server.mjs`.

- `git diff --check` completed cleanly, and the complete `server.mjs` diff was reviewed before commit.

- Commit `92e0aab` — `Rebrand server messaging to LyriBop`.

- Commit `92e0aab` was pushed to branch `v5-storefront` and successfully deployed by Render.

- Render reported the deployment as **Live**.

- The live customer storefront at `/order.html` was smoke-tested after deployment and loaded normally with LyriBop branding and intact page layout.

- The existing live Store Settings turnaround message remained stored in the database as `Your custom StorySong will be ready within 24 hours.` because changing the source default does not overwrite an existing stored setting.

- The live Store Settings turnaround message was manually updated to `Your custom LyriBop song will be ready within 24 hours.` Refreshing the Admin page confirmed that the updated value persisted.

- The Admin Store Settings explanatory text still says `their StorySong`. That text is part of `public/admin.html` and is intentionally deferred to the separate Admin interface LyriBop migration.

- Email branding changes and PayPal description changes were verified in source code but were not exercised through new live email sends or a new live payment solely for branding verification.

### LyriBop Brand Migration — Admin Interface

- On September 20, 2026, `public/admin.html` was rebranded from StorySong to **LyriBop** throughout the visible Admin interface, embedded User Manual, reports, print views, Store Display, seller cards, review fallback text, and Admin Create Song status/error messaging.

- Internal session-storage key `storySongAdminPreview` was intentionally preserved because it supports the previously verified Admin Create Song refresh/resume workflow and is not visible branding.

- A final search of `public/admin.html` found only the three intentional `storySongAdminPreview` references; no visible StorySong branding remained.

- `git diff --check` completed cleanly and the Admin changes were reviewed before commit.

- Commit `f797da2` — `Rebrand admin interface to LyriBop`.

- Commit `f797da2` was pushed to branch `v5-storefront` and successfully deployed by Render.

- The live Admin Dashboard and Store Settings were visually verified with LyriBop branding.

### LyriBop Brand Migration — Main Page

- On September 20, 2026, `public/index.html` was rebranded from **Personal Song Maker** to **LyriBop** in the browser title, main heading, and embedded display artwork text.

- A final search confirmed no remaining `StorySong` or `Personal Song Maker` occurrences in the active `public/index.html`.

- Commit `a937c06` — `Rebrand main storefront to LyriBop`.

- Commit `a937c06` was pushed to branch `v5-storefront` and successfully deployed by Render.

- The live root page was visually verified in Safari and displayed **LyriBop** instead of **Personal Song Maker**.

- The historical backup file `public/index-v4-backup.html` was intentionally left unchanged.

### LyriBop Brand Migration — Final Seller Verification

- The live Seller Portal was rechecked after the broader LyriBop migration and continued to display LyriBop correctly.

- **Email Seller Portal Link** was exercised live for Nicole Ring. The send succeeded, and the received email used LyriBop branding in the sender name, subject, heading, body, contact wording, and signature.

- The received seller email subject was `Your LyriBop Seller Portal`, and the email provided the private Seller Portal button and referral code correctly.

- **Print Seller Card** was exercised live. Safari's preview was not visible, but the resulting printed page was visually checked by the operator and reported correct.

- **Copy Seller Portal Link** was exercised live and reported that the portal link was copied.

- Internal seller session-storage key `storysongSellerToken` remains intentionally unchanged.

### LyriBop Brand Migration — Final Source Sweep

- A recursive search of active public HTML/JavaScript files found no remaining visible old branding requiring migration.

- Remaining StorySong-derived names in active files are internal implementation identifiers: `storysongCheckoutState`, `initializeStorySongPage`, `storysongSellerToken`, and `storySongAdminPreview`. These were intentionally preserved.

- `public/index-v4-backup.html` still contains the historical **Personal Song Maker** branding and was intentionally preserved as an inactive backup file.

### LyriBop Live PayPal Payment Configuration and Verification

- On September 20, 2026, a separate PayPal Business account for **LyriBop** was established so the existing personal PayPal account could remain separate.

- A PayPal REST API application named **LyriBop Live** was created under the Live PayPal environment.

- Render environment variables for the live `personal-song-maker-v5-test` service were configured with the LyriBop Live PayPal Client ID and Client Secret, and `PAYPAL_ENVIRONMENT` was explicitly set to `live`.

- No PayPal Client ID, Client Secret, password, or other credential is stored in this project ledger.

- Render successfully redeployed the service after the environment-variable changes.

- The live `/api/paypal/config` endpoint was checked after deployment and returned `sandbox: false`, confirming that the running LyriBop server was configured for the PayPal Live environment. The endpoint also reported USD currency and the current $10.00 store price.

- The live customer storefront at `/order.html` successfully loaded the PayPal and Venmo payment options after a 30-second preview was created.

- The PayPal checkout was opened while authenticated as the LyriBop merchant account. PayPal refused the attempted self-payment and reported that the account was associated with the merchant being paid, providing additional evidence that the checkout was connected to the LyriBop Live merchant account.

- The Venmo checkout was exercised without completing a payment and successfully generated the live scan-to-pay QR-code interface.

- A controlled real-money PayPal transaction was then completed from a separate personal PayPal buyer account through the LyriBop customer storefront.

- Live test order `SS-1789956509473` completed a real **$10.00 USD** PayPal payment. The LyriBop storefront displayed `Payment complete! Your full song is being prepared for delivery.` after payment.

- The transaction was independently verified in the LyriBop Business PayPal account as **Completed**: gross payment **$10.00 USD**, PayPal fee **$0.84 USD**, and net proceeds **$9.16 USD**.

- This provides end-to-end live verification that the LyriBop storefront can create and capture a real PayPal payment and that the proceeds reach the LyriBop Business PayPal account.

- The controlled $10.00 transaction was left unchanged immediately after verification; no refund was performed during the verification sequence.

### LyriBop Live PayPal Refund Verification

- On September 20, 2026, the controlled $10.00 Live PayPal test transaction was used to verify the merchant refund workflow.

- The first attempt to issue a full $10.00 refund was blocked because the LyriBop PayPal balance contained only the $9.16 net proceeds from the original transaction and was insufficient to cover the full customer refund.

- PayPal's refund guidance confirmed that the original goods/services transaction fee is not returned to the merchant when a refund is issued. The original $0.84 PayPal processing fee therefore remained a cost to LyriBop.

- A bank account was securely linked to the LyriBop Business PayPal account. No bank credentials or account information are stored in this project ledger.

- After the bank was linked, the insufficient-balance warning disappeared and PayPal allowed the full $10.00 refund to proceed.

- The LyriBop merchant transaction activity recorded the refund as gross **-$10.00 USD**, refund fee **$0.00 USD**, and net **-$10.00 USD**.

- The original merchant transaction subsequently reported that the payment had been refunded in full.

- The separate personal PayPal buyer account showed the refund as **Pending** after it was issued.

- On September 25, 2026, final buyer-side receipt of the full refund was confirmed. The controlled Live PayPal refund workflow is therefore fully verified from merchant issuance through final buyer receipt.

### LyriBop Facebook Page — Launch Setup and Initial Public Activity

- On September 21, 2026, the LyriBop Facebook Page setup resumed after successful Live PayPal payment and refund verification.

- The Facebook Page website link was configured to the live LyriBop customer storefront at `/order.html` with the description `Create Your LyriBop Song`.

- The Facebook Page action button was configured as **Contact us** and linked to the same live `/order.html` customer storefront.

- Facebook's saved Action Button configuration was reopened and verified. The `Contact us` button retained the correct storefront URL and Facebook displayed the URL as valid.

- The Page website link was exercised live from Facebook and successfully opened the LyriBop customer storefront.

- The first storefront visit displayed the Render loading screen for approximately 20 seconds before the order page appeared. A second visit immediately afterward loaded the storefront in approximately one second, consistent with a cold-start delay rather than a persistent Facebook-link problem.

- The LyriBop Facebook Page status was reviewed and reported **Page has no issues**, **no Community Standards violations**, and **no account restrictions**. Recommendations were shown as Active.

- Public personal address and phone information were intentionally not added to the LyriBop Page.

- Facebook Page Data sharing remained **Off**.

- The first intentional public LyriBop introduction post was published with the LyriBop promotional artwork. The post explains the personalized-song service and states that customers can hear a **free 30-second preview before they buy**.

- The published introduction post was expanded and visually verified after publication. The complete intended text and promotional artwork displayed correctly.

- Facebook displayed an `AI content` designation on the published introduction post even though the composer had shown the AI-label control as off. No attempt was made during this session to remove or alter that designation.

- Facebook also generated an optional event draft from the introduction post. The event draft was not intentionally published.

- Five selected personal Facebook friends were sent invitations to connect with/follow the new LyriBop Page. A bulk `Select All` invitation was intentionally not used.

- Paid Facebook advertising was not started during this setup sequence.

### Render Paid Compute Upgrade and Storefront Load Verification

- On September 21, 2026, the live LyriBop Render service `personal-song-maker-v5-test` was upgraded from the Free compute plan to the **$7/month 0.5c-512mb plan**.

- The selected paid compute plan provides **0.5 CPU and 512 MB RAM**.

- This upgrade was made to address the Free-instance inactivity spin-down behavior. Render warned that Free instances can spin down with inactivity and that subsequent requests can be delayed by 50 seconds or more.

- A prior live test from the LyriBop Facebook Page had observed approximately a 20-second first-load delay followed by an approximately one-second repeat load, consistent with the Free-instance cold-start behavior.

- Changing the compute plan triggered a new Render deployment using source commit `c62521f`.

- The compute-plan-triggered deployment completed successfully and reached **Live** status.

- After deployment, Render's Compute section was checked and visually verified that the **$7/month, 0.5 CPU, 512 MB RAM** plan was selected.

- A fresh Safari Private window was then used to open the live customer storefront at `/order.html`.

- The LyriBop customer storefront loaded in approximately **one second** during that fresh private-browser test.

- The previous cold-start delay was therefore not reproduced after the paid compute upgrade. This verifies a successful initial post-upgrade load test, but does not by itself establish long-term performance under all traffic conditions.

### Storefront Launch Review — Announcement Disabled

- On September 21, 2026, the live LyriBop customer storefront was reviewed from top to bottom in a fresh Safari Private window from the perspective of a first-time customer.

- The storefront clearly presented the LyriBop brand, `Your Story. Your Song.` messaging, three-step ordering explanation, customization form, free 30-second preview offer, $10.00 price, supported payment methods, free printable lyrics sheet, and the statement that no payment is required to hear the preview.

- The existing storefront announcement `🎁 Special LyriBop orders are now available!` was judged too vague for the current launch presentation.

- In Admin > Store Settings, `Show announcement on storefront` was unchecked and the Store Settings were saved.

- The Admin page displayed no obvious visual confirmation after `Save Store Settings` was clicked. After refreshing Admin, the announcement setting remained unchecked, verifying that the setting had persisted.

- The live customer storefront was then refreshed and the yellow announcement banner was gone, verifying the customer-facing change.

- VERIFIED September 22, 2026: Improved the Admin `Save Store Settings` interaction so the administrator receives immediate visible feedback.
  - The status message was moved directly beneath the Save button.
  - The button now changes from `💾 Save Store Settings` to `Saving...`, then `✓ Settings Saved`, and returns to its normal label after about two seconds.
  - A failed save restores the button and displays `Save Failed — Try Again`.
  - Live verification confirmed the save feedback works correctly and the Custom Song Price was restored to `$10.00`.
  - Implementation commit: `139be03` (`Improve Store Settings save feedback`).

### Live Customer Free-Preview Journey Verification

- On September 21, 2026, the live LyriBop customer storefront free-preview journey was tested in a Safari Private window without completing another payment.

- Test customer name: `LyriBop Customer Test`. Song recipient: `Preview Test`. Occasion: Birthday. Music style: Pop. Song length: 90 seconds. Lead vocal: Any. Vocal style: Warm and expressive. Tempo: Medium. Duet: No duet. Mood: Happy / Upbeat / Fun. No instrument preference or special message was supplied.

- The customer selected `Create My Free Preview` and the storefront displayed `Creating Your Personalized Preview...` while generation was in progress.

- Preview generation completed successfully. The generated title was `Preview Test’s Birthday Parade`.

- The storefront displayed a working 30-second audio player, `Preview Ready ✓`, the $10.00 full-song price, alternate-preview option, free printable lyrics-sheet benefit, and the statement that no payment was required to hear the preview.

- The complete 30-second preview was played successfully. The personalized recipient name `Preview Test` and the Birthday occasion were both audible in the preview.

- After the preview was ready, the storefront displayed the payment section with PayPal and Venmo buttons and explained that debit/credit-card payment does not require a PayPal account.

- The test created order `SS-1790004552314`. No payment was made for this order.

- In Admin, order `SS-1790004552314` was located and verified with the expected test data and generated song.

- The order was then marked as a TEST order. It moved successfully to the Test Orders section, displayed the `TEST ORDER` badge, retained its generated song and order information, and showed the option to `Mark as Real`.

- This test verifies the live customer journey from initial storefront entry through successful personalized free-preview generation and presentation of payment choices, stopping before payment.

### Mobile Launch Verification and Facebook Learn More Button

- On September 21, 2026, the live LyriBop customer experience was reviewed on a mobile phone beginning from the LyriBop Facebook Page.

- The Facebook Page opened the live LyriBop storefront in approximately 1 second.

- The live storefront was reviewed from top to bottom on mobile. No obvious clipping, overlapping elements, undersized content, or awkward positioning was observed.

- Mobile form interaction was tested with a standard text field, the Occasion and Music Style dropdowns, and the multiline story field. The controls and mobile keyboard interaction behaved normally.

- The free-preview section displayed the $10.00 price, preview explanation, `Create My Free Preview` button, and no-payment-required message clearly on mobile.

- The storefront footer displayed normally on mobile.

- A new preview and payment were intentionally not performed during this mobile test because the live customer preview journey and real payment flow had already been verified separately. Therefore, preview audio playback and post-preview payment controls were not independently mobile-verified in this test.

- The LyriBop Facebook Page action button was changed from `Contact us` to `Learn more`, which more accurately reflects the free-preview-first customer journey.

- Facebook Admin was reopened after the change and showed `Learn more` with the existing live LyriBop storefront destination, verifying that the new action-button configuration persisted.

- After restarting the Facebook mobile app, the visitor-facing LyriBop Page displayed `Learn more`.

- The mobile `Learn more` button was tapped and successfully opened the live LyriBop storefront in approximately 1 second.

### LyriBop Instagram Business Setup and Facebook Connection — 2026-09-21
- Created the official LyriBop Instagram account with username `@lyribop`.
- Verified the public Instagram profile displays the LyriBop logo and bio: “Turn your story into a personalized song. Every story deserves a song. 🎵”
- Added the LyriBop Instagram account to the existing Meta Accounts Center.
- Converted `@lyribop` from a personal Instagram account to a Professional Business account.
- Selected Business rather than Creator.
- Selected `Product/service` as the Instagram business category; category display was left hidden on the public profile.
- Connected the LyriBop Facebook Page to the `@lyribop` Instagram Business profile.
- Meta explicitly confirmed: “Instagram connected — The LyriBop Facebook Page is now connected to the @lyribop Instagram profile.”
- Facebook Linked Accounts subsequently displayed LyriBop `@lyribop` under Connected Instagram, independently verifying that the connection persisted.
- Instagram message access in the shared Meta Inbox is enabled.
- The connected setup supports management of content and ads, insights, messages/comments, and settings/permissions across the LyriBop Facebook and Instagram business assets.
- This establishes the Facebook + Instagram foundation for a future coordinated Meta advertising campaign.

### LyriBop Instagram Storefront Link Verification — 2026-09-21
- Added the live LyriBop customer storefront to the `@lyribop` Instagram Business profile.
- External link title: `Create Your LyriBop Song`.
- Destination: `https://personal-song-maker-v5-test.onrender.com/order.html`.
- Instagram displays the external website on the public profile through its link area (`1 link` / clickable storefront URL).
- Tested the link from the normal public-facing `@lyribop` profile on mobile.
- The link successfully opened the live LyriBop storefront in approximately 1 second.
- No customer information was entered, no additional preview was generated, and no payment flow was started during this verification.

### LyriBop Instagram Profile and Professional Setup — 2026-09-21
- Published the first public post on the `@lyribop` Instagram Business profile using the LyriBop launch artwork.
- Post publication was verified on the public profile; the profile displayed 1 post.
- Instagram professional Insights recognized 1 post and 1 follower at the time checked.
- Set professional goals to `Website visits` and `Reach`.
- Set preferred customer connection methods to `Comments` and `Messages`.
- Configured Instagram chat FAQ: `How does the free preview work?` with a response explaining the free 30-second preview and optional full-song purchase.
- Configured Instagram chat FAQ: `What payment methods do you use?` with a response listing PayPal, Venmo, and credit/debit cards.
- Instagram professional setup checklist displayed `3 of 7 complete`.
- Completed checklist items shown by Instagram: `Complete your profile`, `Grow your audience`, and `Tell us your goals`.
- `Introduce yourself` remains incomplete because Instagram requires creating a post through that checklist action; no duplicate launch post was created.
- Meta Verified was not purchased and no Instagram post was boosted or paid advertising started.

### LyriBop Instagram Second Promotional Post — 2026-09-22
- Created and published a second promotional post on the `@lyribop` Instagram Business profile.
- Final artwork uses a 16:9 layout with the full LyriBop branding and promotional messaging visible.
- Added an upper-left `CREATE YOUR SONG` / `Tap the link above` callout with an upward-pointing arrow to help visitors locate the storefront link in the Instagram profile.
- Artwork also highlights the free 30-second preview, unique gift idea, and personalized-song concept.
- Published caption emphasizes the free 30-second preview and directs visitors to tap the link in the profile.
- Post publication was confirmed by Instagram with `Your post has been shared.`
- The public profile grid displayed two LyriBop posts after publication.
- Opened the new post and verified the full 16:9 artwork and caption were displayed.
- Instagram displayed an `AI content` label on the published post even though the Add AI label control was left off during posting.
- The post was not boosted and no paid advertising was started.

### LyriBop Facebook Second Promotional Post — 2026-09-22
- Published the second LyriBop promotional artwork separately on the public LyriBop Facebook Page after confirming the Instagram post had not automatically cross-posted to Facebook.
- Used the same final artwork: `LyriBop_Instagram_Promo_2_Final.png`.
- Facebook post audience was Public and publication was set to Publish now.
- Share to Story remained off.
- Boost Post remained off; no paid advertising was started.
- Opened the published Facebook post and verified the promotional artwork displayed correctly.
- Facebook automatically displayed an `AI content` label even though the AI label control had been left off during posting.
- Facebook collapsed part of the caption behind `See more`, which is normal display behavior.
- Keep `LyriBop_Instagram_Promo_2_Final.png` as reusable promotional artwork for future Facebook and Instagram posts.

#### Reusable Promotional Caption
🎵 Your story deserves its own song.

Turn a birthday, anniversary, special memory, or someone you love into a personalized LyriBop song.

🎧 Hear your FREE 30-second preview first — no purchase required to hear your preview.

💙 Ready to create yours? Click the Learn More button on our page.

Your story. Your song. Your LyriBop. 🎶

- For Instagram reuse, change `Click the Learn More button on our page.` to `Tap the link in our profile.`

### LyriBop Seven-Ad Social Media Campaign — 2026-09-22
- Created a reusable seven-ad social-media campaign for Facebook and Instagram.
- Campaign artwork is stored permanently in `marketing/social-media/`.
- All ads use consistent LyriBop branding and the upper-left `CREATE YOUR SONG / Tap the link above` arrow callout.
- Ads intentionally use different themes and imagery rather than weekday names, allowing them to be posted in any order or reused later.
- `LyriBop_Ad_01_Story.png` — relationship/story theme; `Turn Your Story Into a Song`.
- `LyriBop_Ad_02_Love.png` — romantic/couple theme; `Say It With a Song`.
- `LyriBop_Ad_03_Gratitude.png` — gratitude/appreciation theme; `Turn Gratitude Into Music`.
- `LyriBop_Ad_04_Memories.png` — family memories/photo-album theme; `Life's Best Moments Deserve a Song`.
- `LyriBop_Ad_05_Gift.png` — personalized gift theme; `More Than a Gift. A Song They'll Always Remember.`
- `LyriBop_Ad_06_Adventure.png` — pet/outdoor/everyday adventure theme; `Every Story Has a Soundtrack`.
- `LyriBop_Ad_07_Family.png` — multigenerational family/loved-ones theme; `Your Story Deserves Its Own Song`.
- All seven final images were individually reviewed and approved before being stored in the project.

### Seller Business Cards — Avery 5876 Full-Sheet Printing — 2026-09-22

- Updated Admin seller-card printing to produce a full US Letter sheet formatted for Avery 5876 business-card stock.
- Each print sheet contains 10 identical seller cards arranged 2 columns × 5 rows.
- Each card position is 3.5 inches wide × 2 inches high.
- Sheet layout uses 0.75-inch left/right margins and 0.5-inch top/bottom margins.
- Existing seller-specific LyriBop card content and QR-code behavior were preserved.
- Removed printed card outlines so the finished cards do not include artificial borders.
- Implementation commit: `6a0b654` (`Format seller cards for Avery 5876 sheets`).
- Pushed to `v5-storefront` and deployed successfully to the live Render service.
- Live print test completed on plain US Letter paper.
- Horizontal positioning measured correctly.
- Vertical card-to-card spacing measured exactly 2.0 inches.
- Printed layout looked good in the physical plain-paper test.
- Actual alignment against Avery 5876 perforated card stock has NOT yet been physically verified because Avery 5876 stock was not available during testing.
- No layout adjustment is currently indicated by the plain-paper measurements.

### LyriBop Social Media Advertising Package — Final Documentation — 2026-09-24

- The previously completed seven-ad LyriBop social-media campaign is preserved permanently in `marketing/social-media/`.

- The complete reusable campaign package contains seven final advertising images:
  - `LyriBop_Ad_01_Story.png`
  - `LyriBop_Ad_02_Love.png`
  - `LyriBop_Ad_03_Gratitude.png`
  - `LyriBop_Ad_04_Memories.png`
  - `LyriBop_Ad_05_Gift.png`
  - `LyriBop_Ad_06_Adventure.png`
  - `LyriBop_Ad_07_Family.png`

- `LyriBop_Ad_Captions.md` contains seven matching caption sets, with a separate Instagram caption and Facebook caption for every ad.

- Instagram captions use the platform-specific call to action directing customers to tap the link in the LyriBop profile.

- On September 24, 2026, Facebook captions were updated to include the direct LyriBop customer order-page link; this approach was successfully tested and was later superseded by the September 25 customer-facing link strategy documented below.
- Facebook captions advertise the current offer as $10.00 for your complete personalized song + printable lyrics, while preserving the FREE 30-second preview message.
- The $10.00 price is intentionally kept in editable Facebook caption text rather than embedded in the seven advertising images, so future price changes do not require redesigning the artwork.
- Facebook price/direct-link update commit: 2afe88f (Add Facebook price and direct order link to LyriBop ads).
- Live Facebook verification completed September 24, 2026 using Ad #1 — Story.
- Ad #1 was successfully published as a normal free LyriBop Facebook Page post through Meta Business Suite, with paid-ad/Boost options left off.
- Facebook rendered the direct LyriBop order-page URL as a blue clickable link immediately above the advertising image.
- Clicking the published Facebook link successfully opened the live LyriBop customer order form at /order.html.
- This verifies the Facebook post-to-order-page customer path end-to-end.
- Live Instagram profile-link verification completed September 24, 2026.
- The LyriBop Instagram profile displays the customer order-page link, and clicking it successfully opened the live LyriBop /order.html customer order form.
- This verifies the Instagram profile-to-order-page customer path end-to-end and supports the Instagram caption call to action: Tap the link in our profile.
- Live Instagram publication verification completed September 24, 2026 using Ad #1 — Story.
- Ad #1 was successfully published as a normal free LyriBop Instagram post; paid advertising/Boost was not used.
- The LyriBop Instagram profile increased from 3 posts to 4 posts, confirming the new Ad #1 publication is present on the profile.
- Ad #1 is now live on both Facebook and Instagram.
- Facebook and Instagram Ad #1 publication, caption, and customer order-page paths have now been verified.

### Facebook Customer-Facing Link Strategy — 2026-09-25

- The September 24 direct-link Facebook caption strategy was intentionally superseded for future Facebook posts to minimize display of the technical Render hostname.
- Future Facebook captions direct customers to visit the link on the LyriBop Facebook Page to start their song rather than printing the full Render order-page URL in the post caption.
- The Facebook Page link remains connected to the working LyriBop customer order page; the underlying Render service URL was not renamed or changed.
- Instagram continues to use the customer-friendly call to action directing customers to tap the link in the LyriBop profile.
- No custom domain was purchased and no Render service rename was performed. This is a marketing-display change, not a true URL/domain replacement.
- Updated the master Facebook captions, simplified Facebook posting captions, and social-media posting instructions to reflect this strategy.
- Added simplified plain-text posting files for easier manual posting: `LyriBop Facebook Captions.txt` and `LyriBop Instagram Captions.txt`.
- Desktop copies of both simplified caption files are kept in the `LyriBop Ads` folder for convenient copy-and-paste posting.

- `READ ME - How to Post LyriBop Ads.txt` preserves the posting procedure, image-to-caption matching instructions, and reuse guidance.

- The picture number must be matched with the same numbered caption before posting.

- Original campaign artwork and the master caption file should remain in the repository; posting or copying them does not remove the originals.

- Ads may be reused and do not have to be posted in numerical order.

- Related implementation/documentation commits:
  - `68e7485` — `Add seven-ad LyriBop social media campaign`
  - `d48bdda` — `Add reusable captions for LyriBop ad campaign`
  - `cc0753b` — `Add LyriBop social media posting instructions`

### LyriBop Disaster Backup System — 2026-09-24

- Implemented an automated disaster-backup system for LyriBop.

- The backup system protects both:
  - the PostgreSQL production database;
  - the complete local `personal-song-maker-v4` project source.

- Database backups are created with PostgreSQL `pg_dump`.

- Each database dump is validated with `pg_restore --list`.

- Source backups are created as compressed `.tar.gz` archives.

- Each source archive is validated with `tar -tzf`.

- Backups are stored in the iCloud Drive folder `LyriBop Backups`.

- Backup credentials are stored separately in `~/.config/lyribop/backup.env` and are not stored in the project repository or this ledger.

- A macOS LaunchAgent named `com.lyribop.disaster-backup` is configured to run `/Users/billdonofrio/bin/lyribop-backup.sh`.

- Scheduled backup time is Sunday at 2:00 AM.

- LaunchAgent standard output is written to `/tmp/lyribop-backup.log`.

- LaunchAgent error output is written to `/tmp/lyribop-backup-error.log`.

- Repository recovery copies of the backup script and LaunchAgent configuration are maintained under `backup/`.

- Related backup implementation commits:
  - `8a3285c` — `Add automated LyriBop disaster backup`
  - `8abf503` — `Add LyriBop disaster backup LaunchAgent`
  - `37868a3` — `Fix LyriBop disaster backup paths`
  - `9b9a578` — `Finalize LyriBop disaster backup LaunchAgent`

### Backup History and Admin Backup Status — 2026-09-24

- Added PostgreSQL table `backup_history` for recording successful LyriBop disaster backups.

- Successful backup runs report the database-backup path, source-backup path, status, and timestamp to the LyriBop database.

- Added protected Admin endpoint `/api/admin/backup-status`.

- Added a Disaster Backup Status card to Admin Store Settings.

- The Admin card displays the most recently reported successful backup, the Sunday 2:00 AM schedule, and the 12-set retention target.

- End-to-end status reporting was verified by running a complete backup and confirming the resulting `backup_history` record appeared in the Admin interface.

- Related implementation commit:
  - `1632aa3` — `Add disaster backup status to admin`

### Automatic Backup Retention — 2026-09-24

- Added automatic retention logic to the LyriBop backup script.

- Retention target is the newest 12 database backups and newest 12 source backups.

- A complete manual backup run verified that the retention logic successfully reduced the backup directory to exactly 12 database dumps and 12 source archives.

- The repository copy `backup/lyribop-backup.sh` was synchronized with the current runtime script so the status-reporting and retention logic are protected by Git.

- Admin backup-status configuration was updated from `automaticRetention: false` to `automaticRetention: true` so the interface no longer incorrectly describes old-backup cleanup as manual.

- IMPORTANT VERIFICATION LIMIT: automatic retention has been verified during a manual full backup run. Retention behavior during an actual scheduled LaunchAgent execution has not yet been independently verified. Earlier macOS/iCloud directory-enumeration permission behavior makes this a required follow-up verification rather than an assumed fact.

### Security and Repository Access Maintenance — 2026-09-24

- PostgreSQL backup credentials were rotated during disaster-backup setup after earlier credential exposure.

- Production and V5 test database configuration were updated to use the replacement PostgreSQL credential.

- Old exposed database users were removed.

- Temporary secret files used during setup were removed.

- Current database credentials are not stored in this ledger or committed to Git.

- GitHub fine-grained personal access token `Personal Song Maker` was regenerated with expiration September 24, 2027.

- The previous GitHub credential was removed from macOS Keychain before authentication with the regenerated token.

- Repository HTTPS authentication was successfully verified with `git push`.

- The GitHub token value itself is intentionally not stored in this ledger.

### Recent Development History — 2026-09-20 through 2026-09-24

Recent Git history confirms completion and documentation of the following major project work:

- StorySong customer-facing branding migrated to LyriBop while selected internal historical identifiers were intentionally preserved.

- LyriBop working-brand decision documented.

- Customer storefront, delivery page, seller portal, web-app manifest, server messaging, Admin interface, and main storefront rebranded.

- Live PayPal configuration and real payment flow verified.

- Live PayPal refund issuance and final buyer-side receipt fully verified as of September 25, 2026.

- Render service upgraded to paid compute.

- Live storefront launch review completed.

- Live free-preview customer journey verified.

- Mobile launch behavior verified.

- Facebook business-page launch and promotion documented.

- Instagram business setup, storefront link, profile configuration, and promotional posting documented.

- Seven-ad reusable Facebook/Instagram campaign, captions, and posting instructions completed.

- Store Settings save feedback improved and verified.

- Avery 5876 seller-card sheet layout implemented and verified on plain US Letter paper; actual perforated Avery 5876 stock remains to be physically verified.

- Admin Create Song refresh/resume workflow documentation completed and live verified.

- Store Settings refresh/resume guidance completed and live verified.

- Test-order handling documentation completed and live verified.

- LyriBop disaster backup, LaunchAgent scheduling, backup-history reporting, Admin status display, and retention logic implemented and tested to the verification levels documented above.

### Remaining Verified Follow-Up Items — 2026-09-24

The following items remain unresolved and must not be silently removed from the project record:

1. **Scheduled backup retention verification**
   - Verify that the automatic 12-set retention cleanup succeeds when the backup is executed by the macOS LaunchAgent, not only during a manual Terminal run.
   - This is specifically important because earlier macOS/iCloud directory-enumeration behavior caused permission problems under LaunchAgent execution.

2. **PayPal refund settlement — COMPLETE September 25, 2026**
   - Merchant-side refund issuance was successfully verified.
   - Final buyer-side settlement/receipt of the full refund was confirmed on September 25, 2026. No further PayPal refund verification is required for this controlled test.

3. **Avery 5876 physical-stock verification**
   - Seller-card layout is implemented and plain-paper measurements were successful.
   - Final alignment must still be checked against actual Avery 5876 perforated business-card stock.

### Avery 5876 Seller Card Back — 2026-09-25

- Added a separate `🔄 Print Card Back` action to the Admin Sellers interface while leaving the previously approved seller-card front unchanged.
- The card back uses the same Avery 5876 full-sheet geometry: 10 cards arranged 2 columns × 5 rows, with each card position 3.5 inches × 2 inches.
- The back is intentionally evergreen and does not print the current LyriBop song price, so future price changes do not make existing cards obsolete.
- Back messaging promotes LyriBop, common song occasions, the FREE 30-second preview, and directs the customer to scan the QR code on the front.
- Initial card-back implementation commit: `8f387d2` (`Add Avery 5876 seller card back printing`).
- Physical plain-paper testing verified that the back content fits within the actual Avery 5876 card positions.
- Two-sided plain-paper testing verified that the front and back print right-side-up relative to each other when the front-printed sheet is reloaded with its marked TOP edge facing into the printer.
- A test adjustment moved the entire back upward by 0.187 inch in commit `e622c3c`; physical comparison showed the original position was better.
- The 0.187-inch adjustment was therefore rejected and the original `transform: translateY(-0.125in)` position was restored in commit `edf425d`.
- No size, font, wording, spacing, QR configuration, or approved front-card positioning was changed by the restoration.
- Current verified card-back position is the original `translateY(-0.125in)`.
- Temporary development safety copy `public/admin.html.before-card-back` was removed after the implementation was safely committed and pushed.
- The older September 24 Avery follow-up entry below is historical; actual Avery 5876 front-stock verification was subsequently completed, and the new back-side work is documented here.

### Facebook Customer Link — Bitly End-to-End Verification — 2026-09-25

- Created the customer-facing short link `bit.ly/LyriBopSong`.
- The short link redirects to the live LyriBop `/order.html` storefront.
- Bitly account email status was confirmed Verified.
- A normal free Facebook post was published using LyriBop Ad #1, the full Facebook caption, and `https://bit.ly/LyriBopSong`.
- The published Facebook post displayed the LyriBop advertising image and the clickable Bitly link together.
- The technical Render hostname was not displayed in the customer-facing Facebook post.
- The published Facebook Bitly link was clicked from the actual Facebook post and successfully opened the live LyriBop Create Your Custom Song order page.
- This supersedes the earlier Facebook caption strategy that told customers to visit the link on the LyriBop page.
- All seven stored Facebook caption templates now use the verified Bitly customer link.
- Facebook customer path is now verified end-to-end: published Facebook post -> `bit.ly/LyriBopSong` -> live LyriBop order form.

### Social Media Desktop Package Final Verification — 2026-09-25

- Verified the Desktop `LyriBop Ads` package contains all seven LyriBop advertising images and the Facebook, Instagram, master-caption, and posting-instruction files.
- Updated the Desktop Facebook captions from the repository; all seven Facebook captions use the verified `bit.ly/LyriBopSong` customer link.
- Updated the Desktop master caption file from the repository.
- Updated the Facebook posting instructions to reference the verified LyriBop Bitly customer link and copied the current instructions to the Desktop package.
- Repository documentation update committed as `9cf8b7f` (`Update Facebook ad posting instructions`) and pushed to `origin/v5-storefront`.
- Final Git verification after the push showed `v5-storefront` synchronized with `origin/v5-storefront` and a clean working tree.

### Instagram $10 Pricing Update — 2026-09-26

- Updated all seven LyriBop Instagram caption templates to state the $10.00 price for the complete personalized song + printable lyrics.
- The FREE 30-second preview messaging remains unchanged.
- Instagram continues to direct customers to tap the link in the LyriBop profile.
- Updated Desktop `LyriBop Ads` Instagram captions and verified all seven captions contain the $10.00 price.
- Repository update committed and pushed as `1fe2628` (`Add price to Instagram ad captions`).

### LyriBop Social Video Generation — 2026-09-26

- Established a local automated video-generation workflow using macOS Swift, AVFoundation, AppKit, and built-in audio capabilities; no Homebrew, FFmpeg, or third-party video-generation service is required.
- Added `tools/video/make-lyribop-ad.swift` for the verified 12-second vertical LyriBop Ad #1 video.
- Verified the 12-second video plays correctly with original upbeat audio and visible artwork animation that enlarges and returns to normal.
- Created a separate narrated explainer workflow in `tools/video/make-lyribop-explainer.swift` so the verified 12-second generator remains independent.
- Captured the real LyriBop customer order form for use in the explainer rather than creating a fictitious form.
- Created a conversational Samantha narration for the explainer. Narration duration is approximately 23.26 seconds.
- Generated and reviewed a 24-second, 1080x1920 vertical explainer containing the LyriBop advertising artwork, real order-form imagery, ordering-step messaging, FREE 30-second preview messaging, $10.00 complete personalized song offer, printable lyrics messaging, and closing LyriBop branding.
- User reviewed the complete explainer with sound and confirmed that it looks and sounds good.
- Preserved the reviewed test as `LyriBop_Explainer_APPROVED_BASELINE.mp4` in the Desktop `LyriBop Ads/Videos` folder so later refinements can be compared against the known-good version.
- Current video work is approved as a baseline only; narration may be softened later if desired.
- No social-media publication of the explainer has been performed.

### LyriBop Explainer Facebook Publication — 2026-09-26

- Published the approved 24-second LyriBop explainer video as a Facebook Reel on the LyriBop Page.
- Facebook Reel playback continuously loops the video automatically.
- Published caption includes the FREE 30-second preview, $10.00 complete personalized song + printable lyrics offer, and `https://bit.ly/LyriBopSong`.
- Verified the Bitly link directly from the actual published Reel; it successfully opened the live LyriBop customer order form.
- A first-comment Bitly link was tested but Facebook generated a preview exposing the underlying Render hostname, so that comment was deleted.
- The main Reel caption remains unchanged and provides the working customer link without requiring a separate comment.
- Saved the verified Reel caption as `EXPLAINER VIDEO — 24-Second Reel` in `marketing/social-media/LyriBop Facebook Captions.txt`.
- Updated the Desktop `LyriBop Ads/LyriBop Facebook Captions.txt` copy for easy future reposting.
- Reusable approved master video remains `LyriBop_Explainer_APPROVED_BASELINE.mp4` in the Desktop `LyriBop Ads/Videos` folder.

### Next Session — Seven New LyriBop Videos

- Create seven completely new LyriBop promotional videos; these should not simply animate or reproduce the existing seven static social-media ads.
- Develop distinct concepts and visuals for each video while maintaining consistent LyriBop branding and the current $10.00 offer.
- Test softer and/or upbeat narration voices and choose the voice treatment based on how it sounds with the new video concepts.
- Preserve `LyriBop_Explainer_APPROVED_BASELINE.mp4` unchanged as the known-good approved explainer.
- New videos should be suitable for both Facebook and Instagram vertical video/Reel use.
- Continue using the goal-first automated local video-generation workflow rather than manually constructing each video in another application.
- Do not publish any of the seven new videos until each has been reviewed and approved.

### LyriBop Video #1 — Birthday Surprise — 2026-09-27

- Began the first of the seven planned new story-driven LyriBop promotional videos: `Birthday Surprise`.
- Established the opening hook: `She thought she was getting a birthday card...`
- Created and approved a natural vertical birthday-gathering visual featuring the recipient reading a birthday card with friends/family gathered around her.
- Saved the approved source visual as `LyriBop_Birthday_Surprise.png` in the Desktop `LyriBop Ads/Videos` folder.
- Added `tools/video/make-lyribop-birthday.swift` as the automated local generator for this video.
- Video uses a 1080x1920 vertical Reel format with the birthday photograph maintained as the visual background rather than large black advertising panels.
- Story progression: birthday-card hook -> her story becomes a song -> FREE 30-second preview -> $10 complete personalized song + printable lyrics -> LyriBop call to action.
- Current test narration uses the macOS Samantha voice at rate 145 with a more conversational script; narration is approximately 21.58 seconds.
- Current timeline is 23 seconds; final exported media ends at approximately 21.93 seconds because the narration begins 0.35 seconds into the composition.
- User reviewed the corrected continuous-photo version and confirmed that it looks better.
- Preserved the reviewed version as `LyriBop_Birthday_Surprise_APPROVED_BASELINE.mp4` in the Desktop `LyriBop Ads/Videos` folder.
- QuickTime player controls are not part of the rendered MP4; social platforms will provide their own playback controls.
- A more natural narration voice remains a future refinement; the approved visual/video baseline must be preserved while voice alternatives are evaluated.
- Video #1 has not been published to Facebook or Instagram.

### Birthday Surprise — ElevenLabs Roger Narration Approved — 2026-09-27

- Tested ElevenLabs for more natural LyriBop narration and selected `Roger — Laid-Back, Casual, Resonant`.
- User immediately approved Roger's conversational delivery and later reviewed the narration integrated with the complete Birthday Surprise video.
- Downloaded Roger narration as 48 kHz WAV and preserved it as `LyriBop_Birthday_Narration_Roger.wav` in the Desktop `LyriBop Ads/Videos` folder.
- Roger narration duration is approximately 21.16 seconds.
- Added a separate test generator, `tools/video/make-lyribop-birthday-roger.swift`, so the original Birthday Surprise generator and earlier approved baseline remain unchanged.
- Generated and reviewed `LyriBop_Birthday_Surprise_ROGER_TEST.mp4`.
- User reviewed the complete Roger version with sound and confirmed: `perfect that's a keeper`.
- Preserved the approved Roger version as `LyriBop_Birthday_Surprise_ROGER_APPROVED_BASELINE.mp4`.
- Roger is now the preferred narration for Birthday Surprise; preserve this approved baseline unchanged.
- ElevenLabs is now a verified option for natural LyriBop narration on future promotional videos.
- Birthday Surprise remains unpublished to Facebook and Instagram.
- Creative narration insight: Birthday Surprise became more effective when the narrator changed from a woman to Roger, a male storyteller, while the woman remained the subject of the visual story. This created clearer separation between narrator and subject and made the piece feel more like an outside storyteller describing a real moment rather than the subject narrating her own advertisement.
- For future LyriBop videos, narrator gender should be chosen intentionally for the story perspective and does not need to match the gender of the person shown on screen.

### LyriBop Video #2 — Funny Pet Video — Arlo — 2026-09-27

- Created a new 15-second funny pet-focused LyriBop promotional video using real vertical footage of Arlo the husky.
- Source footage is `IMG_3677.mov`, exported from Photos and stored in the Desktop `LyriBop Ads/Videos` folder.
- Added `tools/video/make-lyribop-arlo.swift` as the automated local generator.
- Video format is 1080x1920 vertical, suitable for Facebook and Instagram Reels.
- Final approved caption sequence: `ARLO HEARD SOMEBODY WROTE A SONG ABOUT HIM…` -> `WAIT… YOU TOLD THEM EVERYTHING?` -> `OKAY… HE LIKES IT.` -> LyriBop offer and call to action.
- Final CTA includes LyriBop™, `Turn their story into a song.`, FREE 30-second preview, and complete song + printable lyrics for $10.
- Selected ElevenLabs `Roger — Laid-Back, Casual, Resonant` as the narrator.
- Approved Roger narration script: `Arlo heard somebody wrote a song about him. Then he found out we told them everything. Yeah... he's not sure how he feels about that. Wait... okay. He likes it.`
- Preserved the narration as `LyriBop_Arlo_Narration_Roger.mp3` in the Desktop `LyriBop Ads/Videos` folder.
- User reviewed the complete video with burned-in captions and Roger narration and confirmed that it looks and sounds good.
- Preserved the approved master as `LyriBop_Arlo_FUNNY_ROGER_APPROVED_BASELINE.mp4` in the Desktop `LyriBop Ads/Videos` folder.
- Approved Facebook caption was added to Desktop `LyriBop Ads/LyriBop Facebook Captions.txt`, using `bit.ly/LyriBopSong` as the customer CTA.
- Approved Instagram caption was added to Desktop `LyriBop Ads/LyriBop Instagram Captions.txt`, using `Tap the link in our profile to create yours.` as the CTA.
- Approved pet campaign line: `Your pet already has a story. Now give them their own song.`
- Arlo video has not yet been published to Facebook or Instagram.

### LyriBop Video Folder Organization — 2026-09-27

- Cleaned and reorganized the Desktop `LyriBop Ads/Videos` folder.
- `Completed Ads` is now the authoritative location for finished, approved promotional videos ready for use.
- Current completed ads:
  - `Completed Ads/LyriBop_Explainer_APPROVED_BASELINE.mp4`
  - `Completed Ads/LyriBop_Birthday_Surprise_ROGER_APPROVED_BASELINE.mp4`
  - `Completed Ads/LyriBop_Arlo_FUNNY_ROGER_APPROVED_BASELINE.mp4`
- `Source Files` contains original footage, narration audio, images, and other rebuild materials.
- `Archived Versions` contains superseded but intentionally preserved approved versions, currently including the earlier Samantha Birthday Surprise baseline.
- `Test Renders` contains development, silent, caption-fix, and other non-final test renders.
- Removed duplicate approved masters from the top level of `Videos` after verifying copies existed in `Completed Ads`.
- Future completed LyriBop promotional videos should be placed in `LyriBop Ads/Videos/Completed Ads`.

#### Video Generator Path Update — 2026-09-27

- Updated the Swift promotional-video generators after reorganizing the Desktop video folder.
- Verified all newly referenced source assets exist at their updated locations.
- Arlo, Birthday Surprise, Birthday Surprise Roger, and Explainer generators now read moved footage, narration, and image assets from `LyriBop Ads/Videos/Source Files`.
- The Explainer's `LyriBop_Ad_01_Story.png` remains correctly referenced from the parent `LyriBop Ads` folder and was also verified present.
- Output paths remain unchanged under `LyriBop Ads/Videos`.
- Updated generators:
  - `tools/video/make-lyribop-arlo.swift`
  - `tools/video/make-lyribop-birthday.swift`
  - `tools/video/make-lyribop-birthday-roger.swift`
  - `tools/video/make-lyribop-explainer.swift`
- No video regeneration was required because the change only relocates verified input assets and leaves the generator logic and output paths unchanged.
- Generator path update is verified and ready for Git validation and commit.

#### Scheduled Backup Retention Verification — 2026-09-27

- The normal Sunday 2:00 AM LaunchAgent backup ran successfully on September 27, 2026.
- Database and source backups were both created successfully and backup status was reported to LyriBop.
- Automatic retention cleanup failed during the scheduled LaunchAgent run, leaving 13 database and 13 source backups instead of the configured retention target of 12 each.
- A controlled `launchctl kickstart` test of the actual registered `com.lyribop.disaster-backup` LaunchAgent reproduced the issue.
- The controlled LaunchAgent run completed successfully with exit code 0 and created both database and source backups, but retention cleanup failed again, leaving 14 database and 14 source backups.
- Direct non-destructive tests confirmed that both database and source retention-selection pipelines correctly identify the oldest backup for removal.
- The backup system itself is working; the unresolved issue is limited to automatic deletion of older backups under the LaunchAgent execution context.
- No backup files were manually deleted during this investigation.
- Master TODO remains OPEN. Continue investigation later; this is a storage/housekeeping issue and does not currently prevent successful disaster backups.

### LyriBop Video #3 — Anniversary Story — 2026-09-28

- Created and user-approved the third of the seven planned new story-driven LyriBop promotional videos: `Anniversary Story`.
- Concept focuses on specific shared memories rather than a generic anniversary sales message.
- Opening hook: `He remembered where they met. She remembered what he said.`
- Approved source visual is a realistic vertical candlelit anniversary scene featuring a middle-aged couple sharing an emotional card moment.
- Source visual is preserved as `LyriBop_Anniversary_Story.png` under `LyriBop Ads/Videos/Source Files`.
- Approved narration uses ElevenLabs `Roger — Laid-Back, Casual, Resonant`.
- Narration source is preserved as `LyriBop_Anniversary_Narration_Roger.wav` under `LyriBop Ads/Videos/Source Files`.
- Approved narration script: `He remembered where they met. She remembered what he said. The little moments became their story. And their story became a song. With LyriBop, turn the memories you share into a song that's completely yours.`
- Added `tools/video/make-lyribop-anniversary.swift` as the automated local generator.
- Video format is 1080x1920 vertical with a 15-second timeline, suitable for Facebook and Instagram Reels.
- Final caption progression: `HE REMEMBERED WHERE THEY MET.` -> `SHE REMEMBERED WHAT HE SAID.` -> `THE LITTLE MOMENTS BECAME THEIR STORY.` -> `AND THEIR STORY BECAME A SONG.` -> `TURN YOUR MEMORIES INTO A SONG.` -> `LyriBop™`.
- Kept the video story-first with minimal in-video sales language; the current offer and fuller CTA are intended for the social-media post caption rather than the rendered video.
- Caption timing was synchronized against Roger's actual spoken delivery.
- Final synchronization required delaying Roger's narration start by 1.72 seconds, from 0.35 seconds to 2.07 seconds.
- User reviewed the corrected final render and confirmed the synchronization was `perfect`.
- Preserved the approved master as `Completed Ads/LyriBop_Anniversary_Story_ROGER_APPROVED_BASELINE.mp4`.
- Anniversary Story is now Video #3 of the seven-new-video campaign and has not been published to Facebook or Instagram.

### LyriBop Video #4 — Princess Couldn't Sleep — 2026-09-28

- Created and user-approved the fourth of the seven planned new story-driven LyriBop promotional videos: `Princess Couldn't Sleep`.
- Fairy-tale concept features an original princess who cannot fall asleep until she hears a song made just for her; no recognizable copyrighted fairy-tale character is used.
- Approved source visual is preserved as `LyriBop_Fairytale_Wakeup.png` under `LyriBop Ads/Videos/Source Files`.
- Approved narration uses ElevenLabs `Jessica Anne Bogart — Eloquent Villain`.
- Narration source is preserved as `LyriBop_Fairytale_Cant_Sleep_Narration_Jessica.mp3` under `LyriBop Ads/Videos/Source Files`.
- Approved narration script: `Once upon a time, there was a princess who just couldn’t fall asleep. She tried everything… until she heard a song made just for her. One magical melody later, she was finally dreaming. With LyriBop, turn their story into a song.`
- Final ad was assembled and exported in ElevenLabs Studio using the approved moving fairy-tale footage, a second generated continuation, the verified sleeping-frame still, and Jessica's narration.
- Final project aspect ratio is 9:16 vertical for Reels/Shorts-style delivery.
- Video-source audio was muted so Jessica's narration is the final audio track.
- User reviewed the actual exported preview and confirmed the narration and video synchronize well.
- A brief moment remains where the princess's eyes reopen for approximately a second; user reviewed the artifact and accepted the final result rather than spending additional generation credits.
- Preserved the approved master as `Completed Ads/LyriBop_Fairytale_Cant_Sleep_JESSICA_APPROVED_BASELINE.mp4`; file existence was verified after copying and the file is approximately 20 MB.
- Princess Couldn't Sleep is now Video #4 of the seven-new-video campaign and has not been published to Facebook or Instagram.

#### Princess Couldn't Sleep — Failed Local Assembly Path / Do Not Repeat

- Before the successful ElevenLabs Studio assembly, multiple local Swift/AVFoundation approaches were tested to extend the approved moving fairy-tale clip with a sleeping-frame tail.
- Tested approaches included reversing footage, normalizing the moving clip to 1080x1920, concatenating a generated sleeping-frame tail, and writing the moving footage plus sleeping frames sequentially with AVAssetReader/AVAssetWriter.
- The original moving source clip was independently reviewed and behaved correctly, ending with the princess asleep.
- Despite that, the locally assembled test outputs repeatedly showed an apparent jump/restart back to the awake portion instead of producing the intended continuous asleep ending.
- Repeated local implementations did not resolve the behavior, so this path was abandoned rather than consuming additional time troubleshooting it.
- The temporary experimental Swift helper files were removed and were not committed.
- Do not repeat the local Swift concatenation/extension approach for this ad unless there is a new technical reason to revisit it.
- The successful workflow was to assemble the existing moving footage, continuation footage, sleeping-frame still, and Jessica narration directly in ElevenLabs Studio and export the completed 9:16 video there.

### LyriBop Video #4 — Princess Couldn't Sleep — Publication Verification — 2026-09-28

- Published the approved `Princess Couldn't Sleep` Reel to both the LyriBop Facebook Page and LyriBop Instagram account through Meta Business Suite.
- Meta Business Suite reports the Reel as published on Monday, September 28, 2026 at 6:17 PM.
- Publication to both Facebook and Instagram was visually verified in Meta Business Suite after publishing.
- The Facebook feed preview was checked and showed the correct Princess video and complete promotional caption.
- The Instagram feed preview was checked and showed the correct Princess video and complete promotional caption.
- `bit.ly/lyribopsong` was visually verified in the caption on both Facebook and Instagram; Facebook displayed the link as clickable.
- The published caption includes the FREE 30-second preview offer, the $10 full personalized song offer, and the planned LyriBop hashtags.
- The Reel was also set to share to the LyriBop Facebook Story.
- Verified publishing workflow: Meta Business Suite can publish LyriBop content to Facebook and Instagram together from one workflow.
- For future LyriBop publishing, use `Create reel` for the video-ad campaign and `Create post` for regular/static-image ads. Use `Create story` when a separate Story publication is specifically desired.
- Video #4 is no longer pending publication; it is verified live on both Facebook and Instagram.

### LyriBop Social Caption & Ads Folder Maintenance — 2026-09-29

Verified and completed:

- Updated `~/Desktop/LyriBop Ads/LyriBop Facebook Captions.txt`.
- Added hashtags to all seven static Facebook ad captions.
- Added/retained separate caption sections for:
  - Explainer Video
  - Arlo Pet Video
  - Princess Couldn't Sleep Video
- Added the approved Princess Couldn't Sleep Facebook content and hashtags.
- Verified static-ad numbering against the actual image assets:
  - 1. Story → `LyriBop_Ad_01_Story.png`
  - 2. Love → `LyriBop_Ad_02_Love.png`
  - 3. Gratitude → `LyriBop_Ad_03_Gratitude.png`
  - 4. Memories → `LyriBop_Ad_04_Memories.png`
  - 5. Gift → `LyriBop_Ad_05_Gift.png`
  - 6. Adventure → `LyriBop_Ad_06_Adventure.png`
  - 7. Family → `LyriBop_Ad_07_Family.png`
- Video captions are intentionally unnumbered so they are not confused with the numbered static-ad series.
- Removed obsolete decorative divider lines from the Facebook caption file.

Instagram:
- Updated `~/Desktop/LyriBop Ads/LyriBop Instagram Captions.txt`.
- Added hashtags to all seven static Instagram ad captions.
- Added the Explainer Video section and hashtags.
- Preserved Arlo's existing Instagram-specific hashtags.
- Added the Princess Couldn't Sleep Video caption and hashtags.
- Preserved Instagram-specific `Tap the link in our profile` calls to action.
- Verified the same 1–7 static-ad numbering used for Facebook.
- Video captions are intentionally unnumbered.

Folder cleanup:
- Created `~/Desktop/LyriBop Ads/Archived Captions`.
- Moved the pre-update Facebook and Instagram caption backups into `Archived Captions`.
- Moved `LyriBop_Anniversary_Story_ROGER_TEST.mp4` and `LyriBop_Anniversary_Story_silent.mp4` from the Videos root into `Videos/Test Renders`.
- Verified the Videos root now contains only:
  - `Archived Versions`
  - `Completed Ads`
  - `Source Files`
  - `Test Renders`
- Approved finished videos remain in `Completed Ads`.
- No advertising assets were deleted during cleanup.

### LyriBop Video #5 — Expectation vs Reality — Approved Baseline — 2026-09-29

Verified and completed:

- Created a new LyriBop promotional video using the `Expectation vs Reality` concept.
- Final editable iMovie project is saved as `LyriBop - Expectation vs Reality`.
- Video structure:
  - Scene 1: recording-studio footage with `EXPECTATION`.
  - Scene 2: laptop footage with `REALITY`.
  - Scene 3: couple/phone footage with `YOU BRING THE STORY.` followed by `LYRIBOP BRINGS THE SONG.`
  - Final black CTA card: `FREE 30-SECOND PREVIEW` / `FULL PERSONALIZED SONG — $10`.
- Narration uses ElevenLabs `Roger — Laid-Back, Casual, Resonant`.
- Approved narration:
  `Making a song used to mean studios, equipment, and knowing exactly what you were doing. Now? Just bring us your story. LyriBop turns the moments that matter into a personalized song made just for you.`
- Roger narration is approximately 12.4 seconds and was manually positioned so it ends with Scene 2.
- Scene 3 uses the ElevenLabs Music v2.5 instrumental `Bouncy Bright Moments`, approximately 12 seconds.
- Music begins with Scene 3 after the narration and carries the visual payoff through the ending.
- User reviewed and approved the narration-to-music handoff.
- Final video runtime is approximately 27 seconds.
- Export settings: Video and Audio, 1080p, High quality, Faster compression.
- Approved master exported to `~/Desktop/LyriBop Ads/Videos/Completed Ads/LyriBop_Expectation_vs_Reality_APPROVED_BASELINE.mp4`.
- Exported master is approximately 35.1 MB.
- User played the actual exported master from beginning to end and verified the picture, narration, music, titles, and CTA are correct.
- Approved baseline must remain unchanged; future revisions should be saved as separate versions.
- Preferred public campaign/order URL is `https://personal-song-maker-v5-test.onrender.com/order.html`; direct Safari testing showed it loaded substantially faster than the previous Bitly redirect. The URL is not burned into the video CTA because links displayed inside video are not clickable. The publishing caption/button should provide the actionable link where supported.
- Updated the Facebook master caption file so all campaign links use the direct LyriBop order-form URL; verified zero `bit.ly` references remain in the Facebook and Instagram master caption files.
- Added the approved `Expectation vs Reality Video` Facebook caption and hashtags to `~/Desktop/LyriBop Ads/LyriBop Facebook Captions.txt`.
- Added the approved `Expectation vs Reality Video` Instagram caption and hashtags to `~/Desktop/LyriBop Ads/LyriBop Instagram Captions.txt`; Instagram continues to use `Tap the link in our profile to create yours.`

### Facebook Reel Clickable-Link Test — 2026-09-29

Verified in the current Meta Business Suite Create Reel workflow:

- Tested the direct LyriBop order URL in the Facebook Reel `Text` field.
- Tested before and after uploading the approved `LyriBop_Expectation_vs_Reality_APPROVED_BASELINE.mp4`.
- Allowed the video upload to reach 100% and inspected all three Reel stages: `Create`, `Edit`, and `Share`.
- Facebook did not generate the clickable website preview card demonstrated by the tested regular-Facebook-post tutorial.
- No separate website-link or CTA destination field was available in the organic Reel Create, Edit, or Share stages.
- The regular Facebook-post preview-card technique therefore was not reproduced in the Reel workflow tested.
- Current Reel approach remains: Facebook Reel content includes the direct LyriBop order-form URL; Instagram uses the link-in-profile call to action.
- Test Reel was not published.

### Render Service Name / Public URL Verification — 2026-10-03

- The Render service display name was changed from `personal-song-maker-v5-test` to `lyribop`.
- Render accepted the service-name change, but the existing Render subdomain remained `personal-song-maker-v5-test.onrender.com`.
- This verified that changing the existing service display name does not, by itself, replace its assigned `onrender.com` hostname.
- No application code, database configuration, PayPal configuration, generated-link configuration, or customer-facing URL was changed as part of this test.
- The existing working Render URL will remain in use for now.
- Do not recreate or migrate the working Render service solely to obtain a cleaner free Render hostname.
- A different customer-facing LyriBop link strategy may be evaluated later, with priority on avoiding disruption to the working live service and avoiding unnecessary cost.

### Store Display Library / Save Image — 2026-10-04

- Expanded Admin > Store Display toward a reusable display/ad library.
- Added `Display Collection`, `Ad Design`, and existing `Display For` controls as separate selections.
- Initial collection: `General LyriBop`.
- Initial design: `Original Counter Display`.
- Seller assignment remains independent of artwork: the display can use General LyriBop or any active seller and the appropriate QR code.
- Added `📷 Save 4 × 6 Image` beside the existing print control.
- Save Image creates a 1200 × 1800 portrait PNG using the current Store Settings price and the selected General/seller QR code.
- Save Image supports the browser share sheet when available and falls back to downloading the PNG.
- Added a dependency-free Canvas renderer; no new package or third-party image service was introduced.
- Added Safari-compatible rounded-rectangle drawing rather than relying on `CanvasRenderingContext2D.roundRect()`.
- Existing `🖨️ Print 4 × 6 Display` behavior remains in place.
- `git diff --check` passed with no errors.
- Local browser verification was not possible because the local server requires an `OPENAI_API_KEY` that is not currently present in the local shell environment.
- STATUS: IMPLEMENTED / NOT YET PRODUCTION-VERIFIED. Verify the Store Display controls, General QR, seller QR, live price, generated PNG, and existing Print function after deployment before marking complete.
