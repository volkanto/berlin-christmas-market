# Berlin Christmas market calendar

A compact mobile calendar with a sliding date strip, district sections, admission fees, inline OpenStreetMap maps, Google Maps navigation, and remembered light/dark themes.

## Run locally

Use Node.js **24 or later**:

```sh
npm ci
npm test
npm run build
npm run serve
```

Open `http://127.0.0.1:8080`. `PORT=8081 npm run serve` changes the local port.

To fetch fresh source data locally before building:

```sh
npm run refresh-data
npm run build
```

A failed `refresh-data` exits nonzero and leaves the previous dataset intact. A subsequent build can still publish saved data with the failure notice.

No production server is needed. The `dist/` directory is the complete static site. Relative asset URLs support both repository subpaths and account-level Pages sites.

## Light and dark modes

The moon/sun button follows the initial system preference, then remembers a manual choice in that browser. You can also link directly to `?theme=light` or `?theme=dark` on your deployed site.

Palette: copper `#DB9558`, cream `#FCF9EA`, olive `#97A87A`, sage `#A8BBA3`, with derived colors for readable text and dark surfaces.

## Files

| Path | Purpose |
| --- | --- |
| `.github/workflows/pages.yml` | Build, data refresh, cache, and Pages deployment |
| `public/` | Current calendar UI, themes, maps, browser refresh behavior, and fallback bootstrap |
| `data/markets.json` | Bundled fallback dataset |
| `lib/berlin-source.mjs` | Official-page fetching and HTML field extraction |
| `lib/update-markets.mjs` | Bounded-concurrency dataset refresh |
| `public/market-parser.js` | Date, weekday-hours, closure, and special-hours interpretation |
| `scripts/refresh-data.mjs` | Fetch and save data; write a readable Actions summary |
| `scripts/build.mjs` | Produce `dist/` and repository-specific update links |
| `tests/` | Schedule, update, validation, and static-export checks |

Change the cron expression in `pages.yml` to adjust or remove daily updates. Change `branches: [main]` if your default branch has another name. For a custom domain, add `public/CNAME` with the domain name and configure the repository’s Pages domain settings.

## Sources and attribution

- Market listings: [Berlin.de Christmas markets](https://www.berlin.de/en/christmas-markets/). Details link directly to their source listings. Treat the data as published information that can change; verify before visiting. No additional redistribution rights are granted by this export.
- Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Map attribution remains visible in each expanded map.
- Map library: [Leaflet 1.9.4](https://leafletjs.com), BSD-2-Clause. See `THIRD_PARTY_NOTICES.md`.
- Palette: [Color Hunt](https://colorhunt.co/palette/db9558fcf9ea97a87aa8bba3).
