# LyriBop Gmail transactional email

Prepared November 10, 2026. Not connected or live until deployment and account setup are verified.

## Purpose and choice

Resend currently has no verified domain and rejects customer emails from its test sender. Bill cannot buy a domain and approved using lyribop@gmail.com. Existing Admin Copy Link remains the immediate manual delivery option.

Gmail SMTP with a Google app password is the smallest integration for the existing paid Render service. Google prefers OAuth; a dedicated OAuth Gmail API connection offers narrower send-only scope but requires Google Cloud consent/client setup and token lifecycle work. App passwords require two-step verification and grant broad account access: keep the app password only in Render secrets, never chat/Git/source. Do not use the normal Gmail password. Do not disable security protections. If Google does not offer app passwords, stop and reassess OAuth instead.

No additional domain or mail-service subscription is required for this route. Gmail applies sending limits and anti-abuse checks; this is low-volume order mail, not a marketing campaign sender. Paid Render supports SMTP465; Render Free blocks SMTP ports.

## Runtime setup (operator reference; guide Bill one action at a time)

1. Deploy the reviewed source. Additive startup creates gmail_delivery_emails; it does not queue or send email.
2. Bill signs into lyribop@gmail.com and enables two-step verification if needed. Bill creates a named Google app password and enters it directly in Render's secret GMAIL_APP_PASSWORD. Credential creation/entry is a user handoff.
3. Set GMAIL_USER=lyribop@gmail.com and TRANSACTIONAL_EMAIL_PROVIDER=gmail. Preserve RESEND_API_KEY and existing settings for rollback/marketing/seller mail. Do not switch provider to bypass an uncertain send.
4. Run node scripts/check-gmail-connection.mjs --check, then --verify. Verify authenticates only and sends no email; no secrets are printed.
5. With explicit recipient/content approval, send one intended email and check Gmail Sent and recipient receipt. SMTP acceptance alone is not proof of inbox delivery. Do not manufacture a payment or bulk retry old orders.
6. Review failed confirmation/alert rows before explicit Admin retry. Sending/uncertain rows stay blocked pending review. No automatic historical backfill.

## Scope and safeguards

Gmail mode routes customer confirmations, customer song delivery emails, and new-paid-order Admin alerts. Marketing campaigns and seller portal/report email still use Resend and remain subject to its domain restriction. Gmail sender is fixed to LyriBop <lyribop@gmail.com>, one recipient, TLS smtp.gmail.com465, bounded timeouts, no debug logging, file/URL loading disabled. No silent fallback/retry on error.

Existing confirmation/alert durable claims remain in place. Gmail delivery adds one persistent record per order: repeated identical successful requests return the stored receipt; simultaneous clicks cannot send twice. Uncertain network/DATA outcomes stay blocked. Explicit provider rejection permits a later manual retry of identical content. Changed payload after a claim requires review rather than bypassing the guard. This table covers Gmail sends after rollout, not historical Resend/manual Gmail deliveries; review Gmail Sent before the first resend of a previously delivered order.

Initial focused tests:8passed/0failed/0skipped (six Gmail tests plus existing confirmation and alert suites, including actual delivery-function wiring). SMTP and database calls mocked; live Google authentication, real database migration and recipient receipt still unverified. Added nodemailer10.5.0 had no advisory in npm audit; existing unrelated dependency advisories not changed.

References:
- https://support.google.com/accounts/answer/185833
- https://support.google.com/mail/answer/22839
- https://nodemailer.com/smtp
- https://render.com/docs/free#other-limitations


### Gmail Activated and Authentication Verified — November 10, 2026

Bill enabled Google 2-Step Verification for lyribop@gmail.com and personally created the LyriBop Render app password. Credential was entered directly by Bill into Render, never requested in chat or read by the agent. Prepared TRANSACTIONAL_EMAIL_PROVIDER=gmail and GMAIL_USER=lyribop@gmail.com; Bill saved GMAIL_APP_PASSWORD and deployed. Render dep-dbpjbp8m7kps73b3t940 observed Deploy succeeded|Live, source2364a435040cded23ed37456a6c4a204e67721b0. Live no-send command node scripts/check-gmail-connection.mjs --verify returned provider:gmail,account:lyribop@gmail.com,configuration_valid:true,authentication_verified:true,emails_sent:0. This proves SMTP configuration/authentication, not email acceptance or inbox delivery. Prior gmail_delivery_emails schema existence verified. No customer messages sent during this setup. Next obtain explicit intended recipient/content approval for one email, review Gmail Sent before resending a previously delivered order, then verify provider result and recipient receipt separately. Marketing/seller mail remains Resend. No ad scheduler settings changed.


### Gmail Receipt and Two Customer Deliveries — November 10, 2026

Bill confirmed receipt of the one approved LyriBop email connection test at lyribop@gmail.com. After reviewing two Ready orders, Bill explicitly approved sending both existing delivery emails to their saved recipients. Used Admin Send to Customer exactly once per order: SS-1794270821321 (Down Spradling Avenue) and SS-1794157522323 (Welcome Home, Levi). Each returned Delivery email sent successfully. No repeat send,bulk action,order status change or scheduler change performed. These are provider/application send successes; customer inbox receipt is not yet confirmed. Orders remained Ready because Send to Customer does not automatically mark Delivered. Gmail test used no customer order. Preserve existing delivery guards and do not resend solely because status remains Ready.


### New-Order Arrival Alert Fix Prepared — November 10, 2026

Bill reported missing new-order notifications. Read-only live audit of latest6orders showed paid:false,captured:false,alert_state:null,including SS-1794270821321 and SS-1794157522323. Existing alert was queued only at PayPal capture, so these submissions never queued an alert; this is separate from repaired Gmail transport. Changed public /api/order to atomically insert order and one notification record,then invoke existing guarded notifier. Alert supports non-test submitted orders before payment and labels Payment:Not recorded as paid versus Recorded as paid; fixed recipient lyribop@gmail.com. Existing single order primary-key claim prevents duplicate at later capture; no historical backfill, no changed order payment/status, no customer delivery resend. Admin-created song path unchanged. Existing pending/failed alerts have no automatic background retry; uncertain outcomes remain blocked. Focused notifier tests and actual submission-handler test pass (notification failure still returns successful saved order);6Gmailtests and customer-confirmation suite pass;syntax/diffcheck pass. Tests use mocked services, no new production order/email generated. Fix saved for deployment approval; not yet live.
