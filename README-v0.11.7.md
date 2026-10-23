# SchoolVis v0.11.7 — Geographic selection → AI audit

Apply these changed files on top of the merged Maryland/DC pilot. **Do not replace your existing local SQLite database.**

1. Select a home school and 1–4 nearby competitors.
2. Click **Prepare competitive visibility audit**. This resolves each selected regional school against the existing, sourced website registry, populates the existing audit form, and opens the configuration pane.
3. Confirm each HTTPS website. A school without a sourced website remains an incomplete entry and cannot pass server validation.
4. Click **Run 5-question audit** in the existing configuration to consent to the paid OpenAI API requests.
5. The existing measured dashboard updates with the captured audit and saves it in the local archive.

This release does not collect search rankings, infer recommendation rates, or auto-run paid requests. It caps the tracked set at 5 schools including home; extra selected peers are flagged and omitted from the audit preview. The existing API still performs actual 2–5 school validation.

Note: the source registry exposes published website *candidates* and manually reviewed website entries. SchoolVis does not independently verify domain ownership.
