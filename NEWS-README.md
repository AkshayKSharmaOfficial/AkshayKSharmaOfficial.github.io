# Cyber News – how it works and how to run it

The news page collects articles from official RSS feeds, stores them, and shows them on the website.
There is **no scraping**, **no API key** and **nothing to `npm install`** (it uses only what Node.js already includes).

## Sources
| Source | Type | Status (checked 29 Oct 2026) |
|---|---|---|
| The Hacker News | media | feed worked |
| BleepingComputer | media | feed worked |
| KrebsOnSecurity | media | feed worked |
| Dark Reading | media | feed worked |
| SecurityWeek | media | **not verified** – the check was blocked by bot protection. Run `npm run diagnose`. |
| CISA advisories | **official** | **not verified** – could not be fetched in the test environment. Run `npm run diagnose`. |
| CERT-In | official | **not included** – no official RSS/API feed could be confirmed, and URLs are never guessed. Add it in `news-tools/sources.mjs` when you have the real URL. |

## Run it on your computer
1. Install Node.js LTS (version 20.12 or newer): https://nodejs.org
2. Open a terminal in this folder (where `index.html` is).
3. Start: `npm start`   (Windows: double-click `START-NEWS.bat`)
4. Open http://localhost:8080/cyber-news/
Leave the window open. News is fetched at start and then every 15 minutes. Open pages update themselves every 5 minutes without reloading.

## Check that real news is arriving
- `npm run diagnose` – tests every feed once and prints OK / PROBLEM / FAILED with the real HTTP status.
- http://localhost:8080/api/health – shows `"status":"ok"`, the number of articles and how many sources worked.
- http://localhost:8080/api/news – the raw JSON used by the page (title, summary, url, source, published, categories, official/media).
- On the news page, "Last updated" shows the time of the last successful fetch. If a feed is down, a notice names it and the older articles stay visible.

## Settings (optional)
Copy `.env.example` to `.env`: `PORT`, `HOST` (use `0.0.0.0` on a server), `NEWS_INTERVAL_MIN` (minimum 5, default 15).

## Static hosting (Netlify / GitHub Pages / Vercel)
A static host cannot run the server. Use the included GitHub Action (`.github/workflows/update-news.yml`, every 15 minutes):
push this folder to a GitHub repository, enable Actions, and let your host auto-deploy from the repo. The page then reads `assets/news.json`
(the page tries `/api/news` first and falls back to `assets/news.json`). It is only verified once you see fresh articles on the live site.

## Tests
`npm test` – 38 automatic tests (parsing, duplicates, unsafe URLs/scripts, categories, one feed failing, the /api endpoints, search/filter logic).

## Files
- `news-tools/sources.mjs` – the list of feeds. `news-tools/lib.mjs` – parsing, cleaning, categories. `news-tools/job.mjs` – fetch/merge/store.
- `news-tools/serve.mjs` – web server + `/api/news` + `/api/health` + 15-minute refresh.
- `assets/news.js` – the page script. `assets/news.json` / `news-data.js` – stored articles.

## Limits
- Headlines and summaries are shown in the publisher's language (English). They are not machine-translated; the interface and category names are in English and Hindi.
- Dates are the publisher's own. If a feed gives none, none is shown.
- Please read each publisher's terms of use. Only the headline, a short excerpt, the date and a link to the original are shown.

## Quiz certificates (already in this site)
The quiz/certificate registry is in `news-tools/certs.mjs` (separate from the news code). With `npm start` it saves results to `data/certificates.json` (private, never served), `/verify/` checks a certificate ID, and you can download all participants at `http://localhost:8080/api/admin/export.csv?token=YOUR_TOKEN` after setting `ADMIN_TOKEN` in `.env` (see `.env.example`). It also needs the server, so on a static host certificates are created but cannot be verified.
