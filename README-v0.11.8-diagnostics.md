# SchoolVis v0.11.8 — provider diagnostics hotfix

This overlay updates `lib/search-visibility.mjs`, `search.js`, and adds tests. No credentials are included.

If DataForSEO rejects a query (HTTP error or non-20000 provider/task status), SchoolVis saves a **partial audit** to `~/.schoolvis/search-audits/`, showing the failed query, HTTP status, provider status/message, and task ID if supplied. Already captured results survive and only completed queries count toward ranking metrics. Subsequent queries are not requested after failure. The provider's raw response body and authorization header are not persisted.

Install: copy the overlay paths to `schoolvis-clean`; restart `npm start`; run `npm run check`. Do not retry a paid search until you decide to test again.
