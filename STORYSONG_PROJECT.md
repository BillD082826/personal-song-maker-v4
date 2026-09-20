# StorySong Project Ledger

**Project:** StorySong  
**Tagline:** Every story deserves a song.  
**Repository:** personal-song-maker-v4  
**Active branch:** v5-storefront  

## Purpose of This File

This file is the authoritative working record for the StorySong project.

It exists to preserve project status, unfinished work, verified behavior, decisions, naming research, and important implementation history across development sessions.

### Working Rules

- Update this file whenever StorySong work changes project status, TODOs, decisions, or verified behavior.
- Update it before ending a substantial StorySong development session.
- Commit ledger changes to Git with the related project changes.
- Distinguish VERIFIED facts from unresolved questions or remembered items that still require verification.
- Do not treat conversational memory as the authoritative project record when this ledger contains the answer.
- Do not remove unresolved items merely because they were discussed; move or close them only when their disposition is verified.


## Current Verified Status

**Recovery snapshot:** September 2026

- Local repository branch: `v5-storefront`.
- Local branch is synchronized with `origin/v5-storefront`.
- Working tree was clean immediately before creation of this ledger.
- Current verified HEAD before ledger creation: `af9f7ac` — `Polish Store Settings layout`.
- Live V5 Render service: `personal-song-maker-v5-test`.
- Verified live V5 deployment was running commit `af9f7ac`.
- Production database: PostgreSQL 18 on Render, resource `personal-song-maker-db`.
- Production database contains 11 verified application tables:
  - `accounts_payable`
  - `customer_marketing_preferences`
  - `generation_costs`
  - `marketing_email_history`
  - `orders`
  - `reviews`
  - `seller_payouts`
  - `sellers`
  - `song_versions`
  - `store_settings`
  - `vendors`
- Current application source is primarily:
  - `server.mjs`
  - `public/admin.html`
  - `public/order.html`
  - `public/delivery.html`
  - `public/index.html`
  - `public/seller.html`
- The existing `README.md` is an older V4-oriented deployment document and is not the authoritative StorySong project record.
- No other project-management Markdown or text file existed before this ledger.
- No explicit StorySong TODO/FIXME markers were found in project source outside third-party dependencies.


## Master TODO

### VERIFIED — Documentation: Admin Create Song Refresh/Resume Workflow

Update the official User Manual to document the verified Admin Create Song recovery workflow.

The documentation must explain:

- After the first preview has been successfully created, the active Admin Create Song session is saved in browser `sessionStorage`.
- Refreshing the Admin page restores the active preview order and preview token.
- The most recently successfully generated preview version saved in the active session is restored after refresh.
- The Create Song form is restored after refresh, including customer information, song settings, instruments, song length, story, and special instructions.
- Once an active preview exists, subsequent form edits are automatically saved on both `input` and `change`.
- Form auto-save does **not** begin before the first preview has been successfully created.
- After refresh, the Admin can continue the existing preview workflow rather than creating a duplicate order.
- `Create Another Preview` can be used after recovery; each successful retry updates the saved active preview version.
- If an alternate preview version is active when `Approve Full Song` is used, StorySong selects that version before generating the full song.
- After successful approval, the saved Admin preview session is cleared and the Create Song form is reset.
- Recovery uses browser `sessionStorage`; it is refresh/session recovery and should not be described as permanent recovery across closed browser sessions.

### VERIFIED — Store Settings Guidance

Add concise Admin Create Song refresh/resume guidance to the Admin **Store Settings** area.

This guidance should summarize the same verified recovery behavior without duplicating the entire User Manual chapter.

### VERIFIED — Test Order Handling Documentation

Document the correct handling of Admin-created songs used for development or testing:

- Admin Create Song orders are created as ordinary `$0.00` orders by default.
- They are **not** automatically classified as test orders.
- When an Admin-created song is only for testing, use **Mark as Test**.
- Test handling is classification, not deletion.
- The test-status endpoint only changes the order's `is_test` value.
- Test orders are separated from real orders and excluded from business metrics where implemented.
- Do not document a nonexistent test-order deletion workflow.


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
