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

