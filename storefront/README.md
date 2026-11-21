# LyriBop free storefront

A separate Render static site serves the existing customer interface. It shares the existing backend using explicit customer-only rewrites. It does not copy the database, provider credentials, orders, generated songs, administrator interface or scheduler. The current service remains active and old URLs continue to work.

Deploy branch `lyribop-free-storefront`, build `node scripts/build-storefront.mjs`, publish `storefront-dist`, and skip dependency installation. The build reads the actual assigned Render URL; never assume the requested name became the hostname. Static site hosting adds no compute subscription, but uses the workspace's existing bandwidth/build allowances.

Configure the routes and headers in `storefront/render.yaml`. This file must not replace the backend's root Blueprint. Before customer handoff, add the exact assigned storefront origin to the backend's customer-only origin policy, then verify homepage, order form, samples, settings, preview response, PayPal loading and promotion checks. Admin and social OAuth remain at their current origin. Do not change PUBLIC_BASE_URL or recreate the existing service.

No customer traffic, existing ads or QR codes should be switched until the complete flow has passed. Preserve the old hostname and saved publishing approvals.
