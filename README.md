# LyriBop — Personalized Song Platform

LyriBop provides a guided customer storefront, personalized song previews, PayPal checkout, private song delivery, an Admin dashboard, seller referrals, and Store Display advertising.

## Project record

Read [STORYSONG_PROJECT.md](STORYSONG_PROJECT.md) before changing the project. It contains the required session protocol, verified status, approved decisions, and remaining work. The integrated Admin User Manual provides operating instructions, including chapter 12, Customer Communications.

## Runtime and configuration

Use Node.js 20 or later. Install dependencies with `npm install` and start with `npm start`.

Configure secrets securely in the environment; do not commit their values:

- `OPENAI_API_KEY` and `ELEVENLABS_API_KEY`: lyrics and music generation.
- `DATABASE_URL`: PostgreSQL order/settings storage. Use a separate development database for local testing; startup initializes schema and defaults.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: authenticated Admin operations.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT`: payment integration. Use `sandbox` and sandbox credentials for development; use `live` only deliberately.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: transactional email provider and sender.
- `PUBLIC_BASE_URL`: public URL used in private customer links.
- `PORT`: optional listening port, supplied by Render when hosted.

This server does not load a local `.env` file itself. Supply variables through your shell or hosting configuration. Never place secrets in browser-side code.

## Existing Render service

The established service is `personal-song-maker-v5-test`, using branch `v5-storefront`. The user prefers **manual deployment**: push the reviewed feature commit, choose **Manual Deploy → Deploy latest commit**, confirm the intended commit is Live, and verify the affected workflow. Pushing alone does not confirm deployment.

Build command: `npm install`. Start command: `npm start`.

The existing `render.yaml` is an older starter template with automatic deployment enabled and a partial environment-variable list; it does not represent the full current service configuration. Do not recreate or reconfigure the live service from it without reviewing the ledger and current dashboard settings.

## Customer Communications

Admin → Store Settings contains editable Order Confirmation and Song Delivery subject/message templates and previews. Preview does not save or send. Use Save Store Settings to persist edits.

A verified completed PayPal capture records payment and queues a one-time confirmation. The persistent claim prevents concurrent automatic sends. Email failure preserves payment success. Admin order cards show confirmation status and timestamps. Pending or explicitly rejected confirmations can be retried by Admin; uncertain/stalled sends require provider review. No background retry worker is implemented.

Send to Customer uses the saved delivery template and private song link. Identical delivery payloads have provider deduplication for 24 hours; this is not permanent per-order delivery suppression. Mark Delivered remains a separate operator action.

## Checks

- `node --check server.mjs`
- `node tests/customer-confirmation.cjs`
- `git diff --check`

Confirmation tests simulate database, payment, and email services. They do not send emails or charge buyers, and they do not replace live PostgreSQL/inbox verification.

## Store Displays

Preserve approved displays. The October 12 Universal Store Display plan supersedes the earlier blanket restriction on photo-based designs, without authorizing a restart of the abandoned Signature photo redesign. Approved Classic Wedding work and the proposed Ad Template Builder are recorded in the ledger; the builder remains proposal work until a separate implementation stage is agreed.
