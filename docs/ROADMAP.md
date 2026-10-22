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
