# SchoolVis Measurement Methodology (Prototype v0.1)

## Purpose

A school may be mentioned, omitted, or described inaccurately in answers to families' questions about independent high schools. SchoolVis measures **appearance in a defined set of recorded responses**, not actual AI search market share, educational quality, or enrollment outcomes.

## Calculation

For a selected school and selected platform set:

`appearance rate = recorded answers mentioning that school / total recorded answers in that selection`.

One answer may mention multiple schools; rates do not sum to 100%. For a combined-platform view, each question/platform observation counts as one denominator unit. The prototype supports only **one observation per question/platform pair**, and thus does **not** estimate uncertainty across repeated model runs. Repetition support is a future milestone.

A program is designated an **unmentioned strength** only when the school record lists a published strength tagged to a topic, the sample contains at least one response to that topic, and zero sampled topic answers mention the school. This indicates an opportunity to investigate; it does not show that AI systems fail to know the program.

## JSON import format

Minimal example (replace values with documented captures before representing as observed):

```json
{
  "schemaVersion": "1.0",
  "kind": "observed",
  "generatedAt": "2026-10-22T14:00:00Z",
  "schools": [
    {"id":"school-a","name":"School A","strengths":[{"topic":"Robotics","description":"Published robotics program","sourceUrl":"https://example.org/robotics"}]},
    {"id":"school-b","name":"School B","strengths":[]}
  ],
  "questions": [{"id":"q1","topic":"Robotics","prompt":"Which area schools offer competitive robotics?"}],
  "observations": [{"questionId":"q1","platform":"ChatGPT","method":"manual","capturedAt":"2026-10-22T14:00:00Z","schoolIds":["school-b"],"responseExcerpt":"Example excerpt provided by the importing analyst.","sourceUrls":[]}]
}
```

**Security note:** the `kind: observed` flag and `method` values are claimed by the importing analyst. The prototype validates shape but cannot authenticate origin. Do not present imported results as independently confirmed.

Allowed platform identifiers: `ChatGPT`, `Gemini`, `Perplexity`. Allowed methods: `synthetic`, `manual`, `api`. `kind: synthetic` must contain only synthetic methods; `kind: observed` must not contain synthetic methods. This is deliberate provenance separation, not proof of accuracy. An HTTP(S) source should be recorded only when supplied by a provider or manually verified; no sources are invented by the analysis layer.

## What a defensible live benchmark requires

A production benchmark needs: documented geographic context, a versioned prompt suite, collection dates, model/product versions, direct capture of full outputs/citations, consistent extraction rules, repeated runs, confidence intervals or stability bands, comparison of API-versus-consumer experiences, provider-terms compliance, and procedures for handling schools with ambiguous names.

Claims in the UI and reports must use precise language such as **"mentioned in 18 of 50 sampled ChatGPT answers"**, never **"ChatGPT recommends this school 36% of the time"** unless representative consumer usage has been established independently.

## v0.3 local API pilot

Five **college preparation** questions (q01–q05), one request each, run against the OpenAI Responses API with `web_search_preview` and a short geographic context. The model is `gpt-4.1-mini` unless changed in server code after checking provider compatibility. These answers are **API web-search outputs** and must never be represented as consumer ChatGPT search results. Cost is incurred per request and for web search; the API billing dashboard is authoritative. Each request uses `store: false`; the local application stores audit responses on disk.

School detection is deliberately conservative: exact full school names only, case-insensitive and with word boundaries. Abbreviations, alternate names, or descriptions without names may be missed. The school websites identify entities but are NOT fetched or verified by SchoolVis. Citations are captured only from URL citation annotations present in the API output. A lack of citation is not evidence that the answer had no sources. The current schema records the first 1,500 response characters as a display excerpt; local archive metadata includes the extracted longer answer and provider model information.

The five questions are not a representative estimate of visibility across all parent intents. No repeated sampling, automated school disambiguation, or verification of claims is included. If one of five calls fails, the run is not archived and its earlier API requests may still incur charges.

## v0.8 directory-sourced school websites (2026-10-22)

School website lookup no longer uses OpenAI. The code and API route for paid AI website discovery have been removed. A curated, source-backed initial set of 34 public website links is stored in `data/public-websites.mjs`, keyed against stable school IDs in local SQLite `website_sources`. Every record has a public source URL, capture date, and explicit directory-published-unverified status. A URL listed in a directory is not a verified or currently operational official website. Records without a supported source remain unresolved. Human-reviewed sites take precedence; previously archived user reviews and AI website candidates are preserved in local SQLite for data integrity, but the AI candidates are no longer surfaced or used. OpenAI remains solely for opt-in AI visibility audits. Do not misrepresent 34 website records as 118 verified websites.
