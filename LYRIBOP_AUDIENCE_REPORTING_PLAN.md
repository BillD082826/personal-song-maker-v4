# LyriBop audience-reporting implementation checkpoint

November 7, 2026. Preparation only; no permissions, runtime settings, posts or schedule changed.

## Verified existing implementation

- lib/instagram-metrics-review.mjs reads views, reach, likes, comments, saved and shares for one fixed verified Instagram IMAGE/FEED test post. It checks account/post identity, grant inventory, bounded fixed-host GETs, and parses nonnegative lifetime values.
- lib/instagram-performance.mjs restricts reads to that test receipt and caches/coalesces reads for one minute. It must not simply be relabeled as a weekly all-ad report.
- lib/analytics-access-review.mjs can inventory current permissions without requesting new ones. Current live grants have not been rechecked in this audit; historical Instagram insights success is evidence of a past working read, not proof of current access for every post.
- The weekly report now summarizes verified delivery receipts, not audience performance.

## Smallest useful next build

1. Instagram first: select only existing verified scheduled receipts for the exact owned account and chosen scheduled week. Derive remote media IDs from validated receipts; never accept arbitrary browser-supplied IDs or URLs.
2. Extend the strict metric parser to bind each result to the expected verified media ID. Keep identity checks, fixed hosts, redirects disabled, timeouts, bounded request count, one-minute coalescing and sanitized errors.
3. Return per-post available/null status and collection time. Unsupported/denied/delayed metrics are unavailable, never zero. Do not expose credentials/provider payload.
4. Show lifetime totals for posts scheduled in the selected week, explicitly labeled as such. These are NOT activity during that week. Do not sum per-post reach as unique people across the whole week.
5. If weekly changes are wanted, add reviewed durable dated snapshots or a verified period-based source. Counter changes are not weekly unique reach. Handle resets/deletions/unavailable reads without negative invented values.
6. Facebook second: read current safe grant inventory and verify exact Page-owned post insight access. Any additional permission request is a separate reviewed action. Do not infer analytics access from publishing success.
7. Clicks, preview starts and orders need an attribution source. Do not label likes or views as website visits or sales. Matching analytics/consent/link-tracking work needs its own design.
8. Add comparisons only for compatible metric definitions and scopes; account for different exposure time and unavailable figures. Email delivery/automatic weekly snapshots remain separate work.

## Verification to do when built

Check exact-account/media binding, malformed IDs, denied/expired access, missing vs zero, lifetime labeling, date boundaries, request bounds/cache/coalescing, Admin access and secret redaction. Use offline fixtures first; one bounded live read of an already-published verified post is sufficient for integration evidence. No new public test post is needed.

## External documentation check

Attempted official Meta Insights documentation on November7; fetch failed (429/access unavailable). Do not treat third-party search snippets as confirmed current requirements. Recheck official documentation before adding new endpoint/metric/permission assumptions. Existing verified integration remains the implementation baseline.
