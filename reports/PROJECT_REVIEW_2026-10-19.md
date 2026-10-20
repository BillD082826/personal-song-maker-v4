# LyriBop Project Review and Updated TODO

Reviewed October 19, 2026. Coverage: October 15–19, with earlier unresolved tasks retained.

Evidence: current project ledger, available recent chat history and retrieved chat context, repository commits through 5399f1e, current catalog/status JSON, and Bill's pasted Terminal verification. This is not a claim that every past chat attachment or production path was independently retested. Later verified closeouts supersede earlier chronological 'pending' entries. Historical entries remain preserved.

## Created, fixed and improved

| Area | Result and verification |
|---|---|
| Customer email templates | Admin Store Settings confirmation/delivery editors, popup previews and persistence completed. Automatic confirmation after successful PayPal capture and Admin-triggered delivery verified live. Status/timestamps and guarded retries implemented; failure paths tested with mocked services. User Manual chapter 12 verified live. |
| Real paid order | Real anniversary order completed payment, confirmation, delivery email and Delivered closeout. Preserve as a real order, not Test. Store price restored to $10 at its last verification; this report does not check today's price. |
| Admin layout | Wider desktop content area approved. Physical mobile check remains open. |
| Album covers | All 14 occasions completed and individually verified through delivery, downloaded artwork and playback. Editable actual title/recipient, Use Song Title and fixed generic Other artwork retained. Thank You heading/shading corrected. Saved cover wording remains separate from current song-version selection. |
| MP3 delivery | Displayed cover embedded in downloaded MP3; approved playback verified. Second MP3 button styled consistently and its download/playback confirmed. Full comparison of purchased extra-version artwork/audio/metadata remains open. |
| Lyrics printing | Shared branded Admin/delivery print sheet; measurement bug corrected; left column fills before right. Bill verified Danny's physical one-page print and approved layout. Browser Headers/Footers must be disabled to omit browser URL/date. Exceptionally long lyrics retain readable continuation. |
| Local ad builder | Create Advertisement entry with 14 backgrounds, editable wording, square/Story PNG export and browser-local save/load/delete. Browser save/reload and Story download checked. No cloud sync or automatic posting. |
| Seller display builder | Editable 14-template 4x6 display uses current Admin price and selected seller QR. Text wrapping and QR wording improved; seller code placed bottom-right. BILL91226 QR destination and physical print fit verified. Standalone Save Image export still lacks separate user confirmation. |
| Order form | Custom music-style helper examples added and approved live. |
| Pinterest setup | Business profile, logo and HTTPS website established. First organic Pin and destination verified. Website claiming remains optional. |
| Static ads | Separate Pinterest ads 08–14 created with dedicated title/description/direct-link copy fields. Ads 09–14 approved Ready to Post. Catalog default for 08 remains Draft; do not assume browser-local state matches it. |
| Preview-first ads | Ads 15–16 Hear Their Song Before You Buy approved Ready to Post. Fixed $10 removed; footer is Full song - MP3 download - Printable Lyrics. Actual storefront price remains Admin-controlled. |
| Bop stories | 17 Anniversary Rescue, 18 The Birthday Headline, 19 The Family Edition, 20 The Fishing Trip: four-panel collections, individual panel selection/download and ordered ZIPs, approved Ready to Post. Bop reference preserved for future ads/video. |
| Story corrections | Birthday: coffee shop, LyriBop newspaper and daughter's birthday. Family: corrected left-to-right dialogue/couch continuity and children cleaning while Dad plays song. Fishing: consistent father/son positions and hat-mishap song payoff. Approved panels preserved. |
| Pinterest stories | Dedicated Pinterest content for 17–20, plus separate approved Ready to Post collections 21–24. Anniversary/Birthday final cards adapted; Family/Fishing preserve approved platform-neutral panels. Fishing Pinterest ID collision repaired to 24. |
| Catalog/navigation | View in All Ads shortcuts, fresh catalog fetching, consistent Static/Video/All Ads/Ready folders, sibling accordion closure, and full folder/selection reset when changing main menu. User verified corrected behavior. |
| Posting records | Pinterest and All three choices added; server restarted; Bill confirmed they work. Record Posting records activity; it does not itself publish to social platforms. |
| Backup retention | macOS background access problem resolved after bash Full Disk Access. Indexed retention installed. Controlled LaunchAgent cleanup removed oldest three of 15 pairs; independent enumeration verified exactly 12 dumps, 12 source archives, no unmatched files, registry agreement and exit 0. Weekly Sunday 02:00 schedule unchanged. |
| Notes backup | Verified ZIP created in iCloud Drive/LyriBop Project Notes Backups at 2026-10-19_18-18-17, including project ledger/Master TODO and three prior snapshots. That ZIP predates this reconciliation; create a fresh verified ZIP after installing this update. iCloud upload completion is not independently verified. |

## Current inventory and boundaries

- Catalog currently contains 24 static entries and 8 video entries, including 8 four-panel story collections (17–24). There are 32 catalog entries total; panels are not counted as separate ads.
- Saved JSON defaults: 31 Ready to Post entries and 1 Draft (08 Story — Pinterest). Browser-local overrides may differ.
- Ready to Post means approved and reusable; it does not mean published. Bill reported a Facebook publication during story work; no additional Pinterest story publication is verified here. Do not fabricate posting history or infer the exact story ID from an ambiguous confirmation.
- Latest reviewed pushed checkpoint: 5399f1e. Latest user-confirmed live application commit in the ledger: 14ea200. Later local dashboard/backup changes do not establish a newer Render deployment.
- Unrelated homepage-preview.html and posting-history.json edits, plus existing untracked assets/backups, remain excluded from this documentation checkpoint.

## Updated TODO

| Priority/status | Task | Completion condition |
|---|---|---|
| Completed October 19 | Anniversary Rescue/Bop animated video. | Full video, Video Ads and Ready to Post approved by Bill. Pinterest content installed; final Pinterest field review and dashboard download remain unconfirmed. Not published. |
| Pending approved design | Convert approved newspaper-style flyer into a static dashboard ad. | Retrieve approved girl-in-pink-headphones design, preserve Turn Their Story into a Song/occasion strip/website CTA, review adaptation and add catalog entry. Not yet integrated. |
| Pending user material | Actual customer reaction video. | Bill supplies real recording; no recording received. Do not present generated scenes as testimonials. |
| Confirm status | 08 Story — Pinterest saved Draft default. | Confirm intended Ready status against Bill's browser; change only after confirmation. Image and copy controls already approved. |
| Open operational check | Observe next calendar-triggered Sunday backup. | Verify new pair and retained 12 from that run. Controlled background cleanup is complete; next calendar run remains unobserved. |
| Open recovery test | Full disaster recovery restore. | Restore database/source into an isolated environment and verify recovered operation; do not overwrite production. |
| Open backup improvement | Separate retention failure from backup success reporting. | Backup currently reports success before cleanup; make cleanup outcome visible without misrepresenting a valid dump/archive. Not fixed in this review. |
| Open customer-email validation | Pending/failed recovery, duplicates and uncertain/stalled provider outcomes. | Validate safely with provider evidence; no automatic retry worker or uncertainty override implemented. Do not manufacture live failures/payments/emails. |
| Optional verification | Purchased extra-version MP3 artwork/audio/metadata and live current-version delivery comparison. | Compare entitled files and selected-version delivery independently. Source audit and playback alone do not close these checks. |
| Optional verification | Standalone new seller Save Image PNG. | Download and inspect final 4x6 export separately. Physical print and seller QR are already verified. |
| Optional compatibility | Physical mobile layouts, other music-player compatibility, representative ad-builder exports. | Test target devices/players and export paths; preserve approved layouts. |
| Ongoing marketing | Existing caption/master keyword review; hooks and buyer-conversion testing. | Review each relevant ad naturally; measure observed results. No guaranteed viral/algorithm claim. Keep working direct links and platform-appropriate CTAs. |
| Platform adaptation | Instagram wording/final cards where original Facebook stories say link in caption. | Review affected Anniversary/Birthday originals before Instagram use; dedicated Pinterest versions are complete. |
| Optional Pinterest | Website claiming and further organic Pins. | Perform only selected posting/setup work; no automatic publication or paid campaign implied. |
| Future refinement | Builder logo/design polish, cloud saves and broader automation if requested. | Existing agreed initial local ad builder and seller builder are complete; do not list the whole builder as unstarted. |
| Monitor | Working brand LyriBop trademark status. | Continue LyriBop™; formal clearance/registration not established. |

## Closed items to avoid repeating

- Remaining original Pinterest variants and all four Pinterest story adaptations.
- Static/video folder consistency, sibling closure and sidebar reset.
- Controlled background 12-set retention cleanup.
- Fourteen occasion artwork catalog, approved lyrics print layout and seller-code placement.
- Customer communication template editors and core live sending workflow.
- Admin Create Song refresh/resume User Manual and Store Settings guidance (earlier ledger already marks complete).

## Important checkpoints

- October 15–16: customer communications, covers, builders, lyrics and delivery improvements; consolidated closeout 5d2f65b.
- 8515152 / 197cc9d: Pinterest static variants, preview-first ads and posting choices.
- 1a9031c / 89f478f / 12a971e / 2822b3b: four original Bop stories and folder organization.
- 089da4c / 066e2c5 / e8836ea / 904c1a3 / efe6c33: Pinterest captions and story collections.
- 9ec6fc3 / d4a39d9 / 212d66c: accordion, main-menu reset and consistent media folders.
- 5399f1e: background retention recovery scripts and verified operational result.

## October 19 animated video update

Recorded October 20. Completed and user-approved: video 08 Anniversary Rescue, 36 seconds, vertical 720 x 1280, with original audio timing. Dashboard Video Ads and Ready to Post approved. Facebook/Instagram captions and Pinterest title, description and direct link installed without a fixed price. Final Pinterest field review and dashboard download remain unconfirmed. Not published; no Render deployment. Catalog: 24 static + 8 video = 32 entries. Other TODO items remain open.


### Anniversary Rescue Final Checks — October 20, 2026

- Bill confirmed the Pinterest title, description and direct website link match the intended content.
- Bill downloaded the completed video through the dashboard and confirmed correct playback with sound.
- These confirmations close the previously pending Pinterest field and dashboard download checks, including those in the TODO table.
- Anniversary Rescue video 08 is fully reviewed and Ready to Post. No publication confirmed.
- Main video checkpoint: f67cb2a. This final verification note still needs its own backup and Git checkpoint.
