# Security Policy

## Scope

SchoolVis v0.1 is a local-first, static prototype: **not a production multi-tenant SaaS**. There is no authentication, server-side collection, billing, remote persistence, or school/private-student data access. The default HTTP server binds to `127.0.0.1`.

## Reporting vulnerabilities

Please do **not** open public issues that expose exploitable vulnerabilities, credentials, or personal information. Use GitHub's **Security → Report a vulnerability** private reporting channel when enabled for this repository. If private reporting is unavailable, ask the maintainers through a non-sensitive public issue to enable a private channel; do not include exploit details.

## Baseline controls

- Node built-ins and browser APIs only; zero third-party runtime packages.
- An allowlisted static file server with GET/HEAD only and defensive HTTP headers.
- CSP disallows remote scripts, network requests, frames, inline scripts, and form submissions.
- JSON schema/length/type checking, URL protocol checks, no HTML injection.
- CSV values prefixed to resist spreadsheet formula injection.
- No telemetry, session storage, cookies, or student data.
- CI tests, syntax checks, and dependency license gate.

## Deployment warning

GitHub Pages serves static files but does not provide custom per-project HTTP security headers. The HTML includes a fallback CSP meta policy, but `frame-ancestors`, `X-Frame-Options`, and other server headers require a supporting host or reverse proxy. Re-evaluate security before any public production deployment, especially before adding user accounts, server requests, or secrets.

## Future risk review

Before implementing a hosted version, complete a threat model addressing tenancy, authentication/authorization, API key storage, audit logging, SSRF defenses for external link inspection, denial-of-service, rate limiting, vendor terms, AI prompt injection, supply chain risk, and incident response.
