# AGENT Instructions — SchoolVis

This repository contains **SchoolVis**, an Apache-2.0 open-source prototype for measuring how independent schools appear in AI-generated recommendations to prospective families. Treat accuracy, verifiability, privacy, security, and permissive licensing as release requirements, not follow-up tasks.

## Product and Measurement Integrity

1. **Never invent measurements or portray simulated results as observed.** Synthetic demo fixtures must remain clearly marked as fictional in the UI, exported data, tests, examples, and documentation.
2. Distinguish **a recorded response** from **a parent-facing AI search session**. Provider APIs and consumer chat/search UIs may behave differently; do not claim equivalence without evidence.
3. Every measurement must be traceable to its question, platform, collection method, capture time, tracked entities, and (when available) the answer excerpt and cited source URLs. Preserve raw evidence where policy and consent permit.
4. Rates use the number of captured responses as the denominator, not the number of prompts when multiple platforms or repetitions are included. Never imply a statistical certainty not supported by sample size or procedure.
5. For future live connectors, record model/version, geography and locale, prompt set version, repetitions, citation status, and collection method. Note any access restrictions or terms of service.
6. Do not treat a school being omitted from a sample as proof it is undiscoverable. Do not infer educational quality, student outcomes, or actual enrollment conversion from visibility alone.
7. Avoid school ranking language unless the ranking is clearly scoped to the measured prompt sample. Comparisons must use identical collection conditions or document their limitations.

## Security and Privacy — Mandatory

- Default to **no personal data**, especially student, parent, or applicant records. Public school/program details are sufficient for this prototype.
- Never put provider API keys or other secrets in browser-side code, client storage, URLs, logs, screenshots, or version control. Any future live collection must use a server-side credential boundary.
- Accept only explicitly validated structured inputs. Enforce size and schema limits; reject unsafe URL schemes and malformed records. Render imported text with `textContent`, not HTML interpolation or `innerHTML`.
- Keep a restrictive Content Security Policy, safe navigation targets (`rel="noopener noreferrer"`), `nosniff`, no-referrer behavior, and no network telemetry by default. Review security headers after deployment; static hosts may not preserve server headers.
- Do not implement arbitrary URL fetching or proxying from untrusted user input. If added later, defend against SSRF, DNS rebinding, redirect traversal, local-address access, and resource exhaustion.
- Treat all AI outputs as untrusted content. Never execute retrieved text as code or instructions; prevent prompt injection from altering audit behavior.
- Threat-model authentication, tenant separation, authorization, rate limiting, key rotation, and audit logging **before** introducing multi-tenant SaaS features. This prototype is single-user and local-first; it is not a production SaaS.
- Report security issues privately following `SECURITY.md`; do not commit secrets or publish vulnerabilities before remediation.

## Dependency and Licensing Policy

- Entire repository is **Apache-2.0**. Preserve `LICENSE`, `NOTICE`, copyright notices, and SPDX identifiers.
- Only **MIT** or **Apache-2.0** licensed dependencies are allowed, including transitive packages, build tools, and bundled code. No GPL, AGPL, LGPL, MPL, proprietary, unknown, dual-licensed-with-nonpermissive-default, or unreviewed packages.
- Prefer Node built-ins and plain browser JavaScript. The v0.1 prototype deliberately has **zero third-party npm dependencies**.
- Before introducing any package, inspect its declared license, the exact version's upstream license file, transitive dependency tree, and lockfile integrity. Record approvals in `docs/DEPENDENCIES.md`. Keep `scripts/check-licenses.mjs` passing, but do not confuse a self-declared license attestation with independent verification.
- Do not install or execute dependency-provided lifecycle scripts without explicit security review.
- Before introducing GitHub Actions or other tooling, review their licenses and pin actions to immutable commit SHAs.

## Running and Testing

1. Use **Node.js 22+**.
2. `npm ci --ignore-scripts` — installs reproducibly; currently installs no third-party packages.
3. `npm test` — run Node's built-in test suite.
4. `npm run lint` — syntax-check JavaScript without third-party linters.
5. `npm run check:licenses` — enforce the repository's MIT/Apache-2.0 dependency policy.
6. `npm run check` — run syntax, tests, and license gate.
7. `npm audit --audit-level=high` — attempt network-backed vulnerability assessment when network access is available. Report connectivity failures rather than treating them as clean scans.
8. `npm start` — serve the static demo on http://127.0.0.1:4173. Optionally use an ordinary static host, but account for `/schoolvis/` paths on GitHub Pages.

Always run checks after code changes. Explain any unrun test or audit and its error in the PR. Do not assert that security or license compliance is verified when checks were skipped.

## Development and Change Review

- Keep the application accessible (semantic HTML, keyboard interaction, readable contrast, mobile layout).
- Add tests for metric changes, input validators, and any new risk-bearing paths. Prefer deterministic fixtures.
- Changes to measurement semantics require updating `docs/METHODOLOGY.md` and tests; schema changes require a version bump and migration guidance.
- Changes to dependency policy require updating the approved inventory and CI guard.
- No external provider calls or data collection may be enabled without explicit opt-in, cost controls, provider-terms review, and transparent provenance labels.
- In PR descriptions include: user-visible behavior, data/provenance impact, security/privacy impact, dependency/license changes, commands run with results, and known limitations.

## v0.2 Worksheet Workflow

- Generate the collection worksheet using `lib/worksheet.mjs`. Convert completed rows with `npm run import:worksheet -- <filled.csv> <schools.json> <output.json>`.
- The provided school identities in `schools.json` must be independently curated, and real observed data must never be analyzed against fictional default school identities.
- Preserve strict limits and CSV injection protections; CSV inputs are untrusted. Output must never silently overwrite previous recordings.
- Do not claim manual recordings represent typical consumer AI responses without repeated and documented collection.

## Current Scope and Known Gaps

- v0.1 only visualizes fictional demonstration data or **user-supplied, self-reported** JSON observations. It does not contact OpenAI, Google, Perplexity, or any other AI provider.
- It has no account system, persistent database, hosted tenant isolation, real search benchmarking, billing, or scheduled monitoring.
- Examples under `example.org` are placeholders, not verified school references.
- Track the production gaps in `docs/ROADMAP.md`; do not silently imply that planned features are complete.

## Local live-API pilot (v0.3)

- Live API requests run only from a loopback-bound Node server at `127.0.0.1`; never bundle the key with frontend assets.
- `OPENAI_API_KEY` may come from the local environment or ignored `.env`; do not log, commit, or send it to any endpoint other than `api.openai.com`.
- Only explicitly triggered batches of five requests are permitted in the pilot. Keep the provider endpoint fixed, and disclose paid API/web-search usage before initiation.
- Preserve separate local archives for response text and provider metadata; ensure no student data. Results displayed to schools require careful validation and disclosure of API-versus-consumer differences.
- An HTTP mock test is NOT verification that a current paid provider model supports the selected web-search tool. Confirm against official API documentation and a live opt-in call before describing live compatibility as verified.
