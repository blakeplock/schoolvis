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
