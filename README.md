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
