# SchoolVis v0.12.1 — YouTube rankings UI

- Selected schools appear in compact, aligned rows with confirmation status.
- Optional technical channel IDs moved into collapsible Channel settings.
- Confirmed IDs persist **in this browser** via localStorage, keyed by registry school ID; not synchronized to SQLite or other devices.
- The paid YouTube audit is disabled until at least one selected school has a confirmed channel ID.
- School ownership is never inferred from video titles or channel names.
- No changes to DataForSEO endpoints, fees or ranking methodology.

Install by copying these files onto the v0.12.0 project and restart with `npm start`.
