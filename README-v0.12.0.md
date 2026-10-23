# SchoolVis v0.12.0 — Google school-only and YouTube organic rankings

Install these updated files over your current v0.11.9 project, preserving `.env`, `.git`, and local data. Run `npm run check` and `npm start`.

## Google

School-only rankings classify observed top-20 organic URLs using review-approved or source-listed MD/DC registry domains; school-only ranks count distinct recognized school domains per query. They are separate from Google's actual organic positions. Unrecognized pages are not guessed to be schools.

## YouTube

Enter confirmed official YouTube channel IDs (UC + 22 characters) for the selected schools. Blank IDs mean unmeasured ownership. YouTube audits use the DataForSEO YouTube Organic Live Advanced endpoint; provider fees apply. Results and partial failures are saved at `~/.schoolvis/youtube-audits`. 5-query pilot is recommended. No video is attributed to a school by a name in its title. Organic unpaid videos/channels/playlists are counted; ads excluded.

Google and YouTube results are not combined into one score. Results are snapshots, not an assertion of all-time rankings.
