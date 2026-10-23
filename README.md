# SchoolVis

**AI discovery intelligence for independent-school marketing and enrollment teams.**

SchoolVis is a privacy-first, Apache-2.0 open-source prototype that answers one question: **When prospective parents ask AI tools to recommend schools, which schools appear—and what strengths are missing from those answers?**

![Version](https://img.shields.io/badge/status-prototype-lightgrey) ![License](https://img.shields.io/badge/license-Apache--2.0-blue)

> **Important: the bundled dataset is entirely fictional.** No OpenAI, Google, or Perplexity services were queried to create these demonstration numbers. The demo must not be used to assess real institutions.

## Features

- Compare a selected school against three fictional peers by visibility rate.
- Filter across ChatGPT, Gemini, Perplexity, or all sampled platforms.
- Inspect 50 parent-intent questions across 10 marketing-relevant topics.
- Spot published strengths omitted from all sampled responses on that topic.
- Examine each recorded prompt, tracked-school mentions, and response excerpt.
- Import observations from a local JSON file (**self-reported, not independently verified**).
- Export a CSV summary, with spreadsheet formula-injection protection.
- No student records, authentication, analytics/tracking, database, API tokens, or external runtime dependencies.

## Quick start

Requires Node.js **22+**.

```sh
npm ci --ignore-scripts
npm run check
npm start
```

Open **http://127.0.0.1:4173**. The server listens only on localhost by default. Set `PORT=...` if required.

Alternatively, this is a purely static client-side app: upload the root directory to a static host. Paths are relative, so GitHub Pages can serve it under `/schoolvis/`. Note that some protective HTTP headers in `server.mjs` **cannot** be configured through GitHub Pages; configure equivalent security headers when using a host that supports them. No live service endpoints are present.

## Example insight

> Across 50 parent questions, fictional Harbor Preparatory School appeared in 18 ChatGPT responses. Fictional competitors appeared in 27, 31, and 36. Its robotics program appeared in none of the five robotics/engineering responses.

This is **a demo of the desired report**, not a measurement of a real school. A zero in five sampled answers has substantial uncertainty and is not a platform-wide claim.

## v0.2: Run a manual evidence-backed audit

1. Open the dashboard and click **Audit worksheet** to download a CSV containing 50 parent-intent prompts on each of three platforms (150 rows). These are **collection instructions**, not results.
2. Copy the JSON below to `schools.json` and replace the placeholder schools with actual school names, safe IDs, and publicly documented strengths. Do not include personal data. Add only strengths supported by public HTTPS links. Use 2–15 schools.

```json
[
  {"id":"school-a","name":"School A","strengths":[{"topic":"Robotics & engineering","description":"Publicly documented robotics program","sourceUrl":"https://example.org/robotics"}]},
  {"id":"school-b","name":"School B","strengths":[]}
]
```

3. In the worksheet, fill `captured_at_iso`, `school_ids_semicolon`, `response_excerpt`, and `source_urls_semicolon` based on actual, manually recorded responses. Use the school IDs from `schools.json` separated by semicolons, and preserve an accurate response excerpt. A blank `school_ids_semicolon` is allowed if no tracked school appeared. Do not paste confidential or personal information.
4. Save as CSV and convert locally:

```sh
npm run import:worksheet -- completed.csv schools.json recorded-observations.json
```

5. In the dashboard, select **Import observations** and choose `recorded-observations.json`. Measurements are marked **SELF-REPORTED**, not independently verified. The importer refuses to overwrite an existing output file.

Notes: the v0.2 converter preserves the v1.0 data schema, which supports **one recorded response per question and platform**; repeats and robust uncertainty estimates are future work. Only completed rows are imported. When editing the spreadsheet, preserve header names, parent questions, and platform labels exactly. Some spreadsheet tools may modify ISO timestamps or leading-zero identifiers; double-check the saved CSV. For a valid comparison, use the same questions, time window, settings and location across platforms, and document any API-versus-consumer differences. See [methodology](docs/METHODOLOGY.md).

## Import your own results

Use **Import observations** to load a JSON file conforming to [the measurement schema and methodology](docs/METHODOLOGY.md). The file stays in your browser session; it is not uploaded to a server. Input is limited to 1 MB, 2–15 schools, 1–100 questions, and 1–3,000 response observations. A `kind: "observed"` label signifies only that **the person who supplied the file claims the observations are real**. It is not independent verification.

A safe route to live testing is collecting results through an approved **server-side** integration that records provenance and honors the provider's terms. API outputs may differ from consumer-facing search results. No provider connector ships in v0.1.

## Development requirements

Read [`AGENTS.md`](AGENTS.md) before contributing. Requirements:

- Apache-2.0 project; **MIT and Apache-2.0 only** for every direct and transitive dependency.
- Security, privacy, and measurement integrity are release gates.
- No secrets in browser code or version control; no student or applicant data.
- `npm test`, `npm run lint`, `npm run check:licenses`, and `npm run check` must pass.
- `npm audit --audit-level=high` should be attempted in a network-enabled environment. Network failure must be reported rather than equated with a clean security result.

See [Security](SECURITY.md), [Dependency policy](docs/DEPENDENCIES.md), [Methodology](docs/METHODOLOGY.md), and [Roadmap](docs/ROADMAP.md).

## License

Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## v0.3: Run a local five-question live audit (optional, paid API)

The existing fictional demo remains available without an API key. To enable the live pilot on your Mac:

1. Ensure Node.js 22+ and your own OpenAI API key with API billing enabled.
2. Copy `.env.example` to `.env` in the project directory; replace the placeholder with your API key. Keep `.env` private; it is gitignored. Alternatively set `OPENAI_API_KEY` in your shell environment.
3. Run `npm ci --ignore-scripts && npm run check && npm start`.
4. Visit `http://127.0.0.1:4173`. Use the **Run a five-question audit** panel to enter the area and 2–5 school names and official HTTPS websites. Click the button **once**; each run incurs API and web-search usage costs.
5. The app saves successful audits in `~/.schoolvis/audits/` (local to your Mac) and loads a successful result into the dashboard. **Load last saved audit** retrieves the most recent archived run. Archive files contain excerpts and the longer provider response; protect them accordingly.

**Important limitations:** OpenAI API outputs with web search are not the same as consumer ChatGPT results. The first five questions all cover college preparation. The tool does not validate official school websites, and school-name matching misses alternate naming. Provider web-search/model support and pricing can change; consult OpenAI's current API documentation and usage dashboard. No API key or actual provider calls were available during development, so tests use mock responses only. For methodological disclosures see `docs/METHODOLOGY.md`.

## v0.4 experimental discovery panel

Run a **new** five-question audit after upgrading, or load a v0.4 archive. The discovered-school panel captures linked candidate schools even if they were not part of your configured comparison set. Labels are **heuristic and not verified recommendations**. Number claims are flagged for review, not checked against source documents. Google Maps links are classified as directory/search links, never as support for academic outcomes. Old v0.3 archives can still load, but do not include discovery analysis. The `ChatGPT` filter remains a legacy v1.0 dataset identifier; the v0.4 banner clarifies live results originate from the OpenAI Responses API.

## v0.5: Maryland/DC school registry (local SQLite)

The school registry is seeded on first `npm start` into `~/.schoolvis/schools.sqlite` using Node's built-in `node:sqlite` module (Node.js 22.13+; this feature may emit an experimental warning on Node 22). **No npm database driver is installed.** The directory panel supports name/county search, a grade 9–12 filter, and adding candidate schools to the audit form. Replace the HTTPS website placeholder with a verified official URL before any audit.

**Scope:** 118 entries transcribed as *candidate source-listed schools*, not verified active association members, from the historical list at https://en.wikipedia.org/wiki/Association_of_Independent_Maryland_and_DC_Schools (reviewed 2026-10-22). Multiple campuses can appear as separate entries. The published page reports a different headline membership count; do not equate these 118 rows with current association membership. The official association website and member directory should be checked directly before publishing institutional profiles or membership assertions: https://www.aimsmddc.org/ . Grade ranges, school names, status, and locations may be stale; `website` is deliberately empty pending official source verification. We copy only factual labels, not third-party descriptions. Source URLs and `source-listed-unverified` status are stored on each record.

**Local data:** SQLite under `~/.schoolvis/` never leaves your Mac. Seed imports use `INSERT OR IGNORE`, so subsequent runs do not clobber reviewed records. A limited reviewed alias set helps resolve known naming variants. This release does not automatically crawl sites, scrape directories, or certify entities, and the registry is not yet a general editing interface. It does not automatically attach historical audit evidence to a registry identifier. Future work: official-site verification, richer fields, manual review queue, linked audit records, and external identity mapping. Back up `~/.schoolvis/` when archiving research.

## v0.6: Source-backed local registry and audit links

The original 118 seed records remain intact. SchoolVis adds a dated **public AIMS directory snapshot** (https://www.aimsmddc.org/mpage/EBS_memberschools, reviewed 2026-10-22) with 58 source names, reconciled by exact and explicitly reviewed variant names. Unmatched names remain in a review queue; nothing is automatically inserted as a verified new school. A listing only establishes that a name appeared on this publicly accessible directory at review time; it does **not** prove current membership, institutional operation, grades served, or website ownership. This snapshot is not represented as the association's full current membership list.

In the registry, **Review source** lets a local user enter an official school HTTPS website, select whether grades 9–12 are served, and optionally link the page establishing grade coverage. Entries are marked `user-reviewed-not-independently-audited`; URLs are **not fetched, crawled, or independently validated**. Blank grade evidence with an asserted grade status is possible and should be considered incomplete; provide a supporting page when available. Reviews persist in `~/.schoolvis/schools.sqlite`, not in Git.

Stored audit records can now be linked by stable registry identifiers. A successful new audit records linked tracked schools and discovered candidates. Opening a saved archive also attaches links to older v0.3–v0.5 archives **without rewriting** the evidence files. An unrecognized name is deliberately left unmatched. The read-only endpoint `/api/audits/<audit-id>/links` returns `tracked` versus `discovered-candidate` links; `/api/registry/reconciliation` exposes unmatched official-list names. These link types never imply verified recommendations.

This release is a **data-quality workflow**, not automated third-party site verification. Before using records for paying customers, verify source identity, investigate unmatched association schools, reconcile campuses and closures, and require independent review of claimed characteristics.

## v0.7 (retired)

Paid OpenAI website-search code introduced in v0.7 was removed in v0.8. Existing locally stored suggestions are retained for historical integrity but are no longer used.

## v0.8 directory-sourced school websites (2026-10-22)

School website lookup no longer uses OpenAI. The code and API route for paid AI website discovery have been removed. A curated, source-backed initial set of 34 public website links is stored in `data/public-websites.mjs`, keyed against stable school IDs in local SQLite `website_sources`. Every record has a public source URL, capture date, and explicit directory-published-unverified status. A URL listed in a directory is not a verified or currently operational official website. Records without a supported source remain unresolved. Human-reviewed sites take precedence; previously archived user reviews and AI website candidates are preserved in local SQLite for data integrity, but the AI candidates are no longer surfaced or used. OpenAI remains solely for opt-in AI visibility audits. Do not misrepresent 34 website records as 118 verified websites.

**Source citations:** [BEST Baltimore member-school directory](https://www.besttrust.org/about-us/member-schools/), [SERA regional school directory](https://www.seraconsulting.com/school-database), and [Baltimore Magazine 2026 admissions guide](https://www.baltimoremagazine.com/special/baltimore-independent-school-admission-guide-open-house-guide-2026/).

## v0.8.1: Registry card and audit prefilling fixes

Registry cards use stacked information with their action buttons in a dedicated footer, keeping titles and source links readable. **Add to audit** inserts both the school name and its reviewed or published HTTPS website into the audit form, and updates an existing row for the same school. If the registry has no website, it asks for source review rather than inserting a fake placeholder URL. Directory-published websites still require confirmation before a paid audit. No API calls are made by adding a school to the audit form.

## v0.8.2: Competitive landscape presentation

The discovery section now presents school candidates as compact two-column cards with appearance counts, visual bars, and tracked/discovered distinctions. A separate evidence review panel summarizes directory-link provenance and displays unverified numerical claim excerpts. The known name variants `Bryn Mawr School` and `The Bryn Mawr School` are grouped for display; because legacy discovery summaries do not record per-school per-answer IDs, grouped counts are explicitly marked as potentially overlapping and are **not** treated as verified unique-response totals. Exact duplicate claim excerpts are suppressed in the visible list but retained in saved evidence. Neither the underlying extraction engine nor saved audit records is changed.

## v0.8.3: competitive landscape filters

The Discovered competitive landscape offers combinable enrollment (boys/girls/co-ed), religious affiliation, region (Baltimore city+county / DC / other Maryland counties / unknown), and individual county filters, with Reset. The categories are **provisional editorial classifications**, not independently verified institutional facts; unclassified schools remain visible under the Unknown options. Filtering applies to the exploratory discovery list, not the underlying captured responses or metrics, and requires no paid API requests. See `lib/landscape-filters.mjs` for the provisional lookup. Review and attach authoritative school sources before publishing any demographic or affiliation claims.

## v0.8.4: Simplified landscape location filters

The Discovered competitive landscape panel now combines Region and County into a single Location selector. It includes all 23 Maryland counties (even counties not represented in current results), Baltimore City, Washington DC, a Baltimore-metro grouping, statewide Maryland, and Unknown location. Filters are applied to provisional data without new API requests. Empty matches display an explicit message. Enrollment and affiliation controls are unchanged.


## Dark editorial theme

The interface uses **Crimson Text** for headings and key figures and **Work Sans** for body text, controls, and data. It uses a dark palette and accessible focus outlines. Fonts load from Google Fonts (`fonts.googleapis.com` and `fonts.gstatic.com`); if offline, Georgia and system sans-serif fallbacks are used. Font assets are delivered under the [SIL Open Font License](https://openfontlicense.org/), distinct from the Apache-2.0 application code. Loading Google Fonts makes a third-party network request; for a future fully offline build, self-host reviewed OFL font files and document their license. No npm dependencies are added.

## v0.8.6 dashboard layout

The overview uses an approximately 42/58 responsive split: audit controls and report filters on the left; live/demo visibility KPIs, comparison bars and topic-level appearance bars on the right. Charts derive exclusively from the active dataset; no synthetic trends or fabricated multi-topic results are introduced for five-question audits. At narrow widths the columns stack.

## v0.8.7: Neutral console interface

This release replaces Crimson Text and Work Sans webfonts with a locally available system sans stack (Inter if installed, system UI otherwise) and a graphite, low-chroma dashboard inspired by professional developer consoles. Headings and metrics use moderate weights; small labels and cards are brighter for readability. No third-party font requests are made and the server CSP stays strict. The school registry, five-question API audit, original records, and dashboard behavior are unchanged. The missing `data/aims-seed.mjs` server asset route remains corrected.

## v0.8.8: Workbench layout

The UI separates navigation and search/audit configuration from results and evidence. Blue is the single visual accent for active navigation, selections, and selected-school chart data. Public-facing chrome omits repository and license marketing, while the Apache-2.0 LICENSE, NOTICE, and contributor requirements remain intact. No application data or collection semantics changed.


## v0.9.0: Competition graph pilot

Competition Discovery now includes a local SVG co-appearance network, constructed from archived per-response candidate records (or labeled fictional demo observations). An edge means two candidate schools appeared in the **same recorded response**, not that they are proven competitors. Edge counts retain question IDs for auditability. Conservative name normalization merges leading `The`; a proper canonical registry crosswalk is still future work. Use the school chips to select 2–5 nodes, then **Use selected schools in audit** to prefill the audit form from locally available published or reviewed websites. Missing websites remain explicit `REVIEW` placeholders and must be verified prior to a paid audit. Filtering changes visible nodes; the selected comparison set persists until page refresh. No graph library, external requests, or paid API calls are required to explore the graph. The overview is not a claim of independent verification.

## v0.9.1 Interactive Competition Graph

The node network supports draggable labeled nodes, pan and zoom, an integrated evidence inspector, and selection of 2–5 schools for the audit. Relationships are derived from captured co-appearances, not independent evidence of competition. No external graph dependencies.

## v0.9.2 graph exploration

The Competition Graph has 1- and 2-layer breadth-first neighborhoods from the focused school, an inspector that can collapse, and separate **focus** versus **Add to comparison** interactions. Recorded edges remain co-appearances, not verified competitive claims. Relationship question evidence is expandable; older archives may not contain a detailed excerpt for every discovered-school candidate.

## Four-step navigation (v0.9.3)

The UI separates the existing registry search, observed competitor graph, audit configuration, and intelligence reports into four navigable steps. All element IDs, audit request handling, graph controls, and saved local records remain unchanged. Moving through steps does not persist a separate named comparison group; the graph's existing transfer-to-audit behavior is retained.

### v0.9.4 school search UX
Step 1 provides locally ranked school-name suggestions populated from the registry API, with an explicit selection and optional audit-prefill when a recorded website exists. Step 2 contains the previous full school registry search and existing competitor filters and graph. Classifications and websites remain provisional.

### v0.9.5 workflow placement

Step 3 (Configure an audit) contains the discovered-school enrollment, affiliation, and location filters. Step 4 (Explore intelligence) contains the discovered competitive landscape, graph, relationship inspector, and evidence. Control IDs and data-processing behavior are unchanged. The selected-school transfer action navigates back to Step 3.

## v0.10 — Discoverability dashboard reset

The customer UI is now one dashboard with optional school/audit setup. Search ranking and website-health categories explicitly report “Not measured” until suitable collectors are implemented. Existing AI audit and local registry behavior is retained. Earlier graph and academic-analysis controls are retained in the code for archive compatibility, but are not exposed as marketing features.

## v0.11 website checks

Opt-in HTTPS homepage metadata and robots.txt checks can be run locally. No AI requests are used. Requests are DNS-pinned and block private or unsupported address ranges; redirects are never followed. The result is a snapshot, not a search ranking, indexing verification, Lighthouse audit, or security certification. Search rankings remain unavailable pending a vetted provider.

## v0.11.6 Maryland/DC regional competitor discovery pilot

Uses the existing historical AIMS-derived Maryland/DC regional school list, *not* Google Places, NCES, or Wikidata. This is not a verified current AIMS membership roster.

The dashboard provides a home-school selector, straight-line 10/15/25/50-mile radius, nearby list, manual selection of peers, and local browser storage for the selection. If the home school has no sourced coordinates, all regional schools remain available for manual selection. Chosen peers do not yet modify the independent AI audit pipeline.

**Coordinates must be sourced, never invented.** The original registry doesn't include complete street addresses, so first create a CSV with columns `school_id,address,city,state,zip,address_source_url`. Obtain `school_id` from `/api/geo-schools`; provide a publicly sourced institutional street address and an HTTPS citation URL. Then run:

```bash
python3 scripts/import-mdc-locations.py ~/Downloads/mdc-school-addresses.csv --geocode
```

The script calls the public US Census Geocoder (no API key, subject to service availability and usage policy), rejects ambiguous matches, stores source URLs and method in local `~/.schoolvis/schools.sqlite`, and labels all results `geocoded_unverified`. Alternatively, CSV columns `lat,lon,geocode_source` can be supplied without `--geocode` where externally validated coordinates are available. Nothing overwrites previously saved audit results. Coordinate coverage is clearly indicated in the UI. This is an honest partial-coverage pilot until address enrichment is completed.

### v0.11.6 Baltimore location starter cohort

The file `data/locations/baltimore-sourced-addresses.csv` contains **19 address candidates** matched to the regional registry by stable school ID, supported by institutional websites, the Maryland State Department of Education nonpublic-school directory, or the AIMS public member page. They include Mount Saint Joseph, Gilman, McDonogh, Loyola Blakefield, Bryn Mawr, and other Baltimore-area institutions. Addresses are evidence-backed but **not geocoded yet** and may require institutional review. No latitude/longitude values have been invented.

After running `npm start` at least once to initialize the local school registry, stop the server and run:

```bash
python3 scripts/import-mdc-locations.py data/locations/baltimore-sourced-addresses.csv --geocode
```

This calls the U.S. Census Geocoder for each address (no API key), accepts only unique matches within the pilot bounds, and saves matching coordinates and original address source URLs into `~/.schoolvis/schools.sqlite`. Then run `npm start` again and choose Mount Saint Joseph in the Nearby Schools picker. The output explicitly reports skipped/unmatched addresses. Google Maps, Wikipedia ShareAlike data, and the discontinued national import are not required.

The remaining regional schools need additional sourced addresses, and the Maryland/DC dataset is a partial pilot, not a complete verified member roster. Distances are straight-line, not driving distances.
