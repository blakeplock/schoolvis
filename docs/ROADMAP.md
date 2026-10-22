# Roadmap

## Delivered in v0.1

- Fictional 50-prompt sample across 10 topics / 3 illustrative platform labels
- Per-school appearance rates and comparison, categorized strengths, evidence explorer
- Local JSON import with validation and explicit self-reported provenance
- CSV export, mobile dashboard, zero-dependency static site and localhost server
- Apache-2.0, AGENTS.md, dependency policy, security guidance, tests and basic CI

## Delivered in v0.2

- Downloadable 150-row parent-question collection worksheet
- Strict local CSV-to-JSON converter for manually captured observations and public school profiles
- Four worksheet and validation regression tests; no third-party dependencies

## Before live customer pilots

- Define fixed prompt versioning and school entity identity/disambiguation policy
- Implement secure, server-side provider adapters for permitted APIs with keys outside browser
- Document differences between API and consumer search, provider terms, and costs
- Add repetitions, provenance fields, sample-stability/uncertainty metrics and raw evidence archives
- Improve taxonomy and program/claim verification against authoritative school sources
- Publish a measurement-quality rubric and independent audit procedure

## Before real SaaS subscriptions

- Tenant isolation, role-based access, authentication, authorization tests, data retention and deletion
- Secrets management, queue/work scheduling, audit logging, alerting and incident response
- Payment processing through an appropriately reviewed provider (never store payment card data)
- Baseline reports, subscriptions, trend monitoring, competitor set management and export controls
- Load testing, security review, privacy/legal review and independent accessibility evaluation

**No future feature should be shown as operational before its implementation and verification.**

## Delivered in v0.3 (local-first pilot)

- Local-only server integration with fixed OpenAI Responses API endpoint and five sequential college-preparation prompts
- School name, official URL and geographic context setup (no automatic web crawling or verification)
- Conservative literal full-name extraction, provider citation capture, timestamps and raw answer archive
- Credential stored in ignored `.env` file on the Mac; archive under `~/.schoolvis/audits` with owner-only file permissions
- Reload most recent recorded audit into the existing dashboard; mocked tests and zero third-party packages
- Known gaps: no repeats, browser-consumer equivalence, verified school identity, full-run cost estimate or per-answer confidence

## Delivered in v0.4

- Extract candidate schools from linked answer lists, including competitors not configured in the audit (heuristic; manual review required)
- Differentiate candidate recommendations from generic mentions without claiming verification
- Flag numeric claims and Google Maps search links as unsupported evidence, and distinguish API results from ChatGPT
- Display local discovery analyses with archived audits and improve readable response excerpts

## Next measurement-quality work

- Human annotation and labeled accuracy evaluation for entity matching and recommendation classification
- Verify official school sources before presenting any claim as substantiated
- Model alternative school names and preserve entire provider responses for evidence review
- Add prompt-scope categories (independent-only vs open search) and cross-response contradiction detection

## Delivered in v0.5 (local registry foundation)

- Local SQLite file with 118 preliminary Maryland/DC school candidates sourced from the public association-related list
- Persistent deterministic IDs, stored provenance and explicit unverified status
- County/search and grades 9–12 filtering in the dashboard; add-to-audit workflow requiring official website verification
- Conservative reviewed naming aliases and lookup API for audit-discovered candidates
- No automated assertion of current AIMS membership, official websites, demographics or school programs

## v0.6 data quality work

- Verify the current AIMS directory against association data; reconcile missing/stale listings
- Verify campus identities, official URLs, high-school grade ranges, and entity aliases with per-field source dates
- Add explicit human review and revision-history workflow and attach archived audit observations to stable registry IDs
- Improve candidate extraction and offer ranked match suggestions without silently coalescing entities

## Delivered in v0.6 — directory reconciliation and local review

- 58-name dated AIMS public directory snapshot as an *additional provenance source*, not authoritative membership certification
- Source assertions and explicitly reviewed name crosswalk, plus unresolved-name list
- Per-school source status and user-submitted HTTPS website/grade review (no automated fetch or verification)
- Persistent, non-destructive links from archived AI audits to stable school IDs; tracked vs discovered candidate
- Tests covering snapshot reconciliation, idempotent linkage, provenance, and review validation

## Still required for institutional data quality

- Obtain and maintain a complete current AIMS list through an authorized directory/export arrangement
- Independently verify official domains and school-offered grades, record page evidence and last-checked timestamps
- Build a first-class unmatched-name and identity-conflict review UI, including closed/renamed institutions and campuses
- Display linked audit history per school with time-series provenance; audit links exist in SQLite but history UI is pending
- Compare API search answers with actual consumer interfaces and assess confidence; do not claim equivalence

## Delivered in v0.7

- Opt-in OpenAI web-search discovery of website **candidates** for up to five selected registry schools per run.
- Local SQLite capture of suggested homepage, evidence pointers, provider/model, and timestamp; conservative URL validation.
- Candidate display and review handoff; never automatically overwrite user-reviewed authoritative fields.
- Explicit paid-API warning, no arbitrary candidate fetching, and strict input validation.

## Next data-quality work

- Independent domain ownership and website-to-institution verification, with safe DNS/redirect defenses before live site fetching.
- Authoritative association directory and trusted link reconciliation to supplement model-generated candidate addresses.
- Provider usage budget/cost estimates and queue-based batch processing with operator cancellation.
- Explicit human adjudication and school-profile evidence review.

## v0.8 directory-sourced school websites (2026-10-22)

School website lookup no longer uses OpenAI. The code and API route for paid AI website discovery have been removed. A curated, source-backed initial set of 34 public website links is stored in `data/public-websites.mjs`, keyed against stable school IDs in local SQLite `website_sources`. Every record has a public source URL, capture date, and explicit directory-published-unverified status. A URL listed in a directory is not a verified or currently operational official website. Records without a supported source remain unresolved. Human-reviewed sites take precedence; previously archived user reviews and AI website candidates are preserved in local SQLite for data integrity, but the AI candidates are no longer surfaced or used. OpenAI remains solely for opt-in AI visibility audits. Do not misrepresent 34 website records as 118 verified websites.
