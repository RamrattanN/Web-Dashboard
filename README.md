# WebDashboard — v1.5.0-dev (unreleased)

A customizable single-page browser dashboard with tiles, groups, search, wallpaper, and layout settings.  The released-code starting point for this recovery is v1.4.7 (`b08b98b`); this branch is unreleased development.  No GitHub Release ZIP is currently published.

## Run it

1. Download [`index.html`](https://github.com/RamrattanN/Web-Dashboard/blob/main/index.html) from this repository.
2. Open the file in a browser.  Configure tiles and layout using the Settings dialog.
3. If you serve it from a web server, replace its `index.html` with this file and reload the page.

There is no build step or package installation.  See the [Wiki](https://github.com/RamrattanN/Web-Dashboard/wiki) for settings, icons, troubleshooting, and baseline details.

## Network and privacy

The page loads Google Fonts and may request favicons from saved sites or external favicon services.  Search, remote wallpaper, and opening a tile contact the selected providers or sites.  Review the URLs and browser requests if you need an offline setup.  Browser settings and dashboard data are stored locally in your browser.

## Wallpaper and data

Bing daily is optional: select it in Settings and enter a market such as
`en-US` (blank uses `en-US`). The browser contacts Bing directly. Provider
availability and cross-origin policy can prevent loading; no proxy or backend
is included. Failed requests preserve the background already displayed on the
page, but that previous image is not cached across reloads. Static URLs and
local images use the same preload-before-replace path. Solid color is the
first-run default. The legacy Unsplash keyword option is retained for existing
settings but its external endpoint is not guaranteed to work.

Settings save only with Save. Close/Escape discard edits, including newly
selected local files. Export backs up all links (including those hidden by
filters or the tile limit) and settings. Imported backups replace links and
merge supplied settings. Keep backups private if they contain personal URLs
or embedded local images; browser storage has size limits and is tied to the
browser profile and file location/site origin.

## Development and verification

Normal users need only `index.html`. Developer checks use Node 20+:

```sh
npm ci
npm test
```

On macOS these checks use installed Google Chrome; CI installs Chromium.
The deterministic suite intercepts remote requests. A separate opt-in live
Bing diagnostic reports whether the provider loaded or the fallback remained:

```sh
LIVE_BING=1 npx playwright test --grep 'live Bing browser probe'
```

See [BASELINE.md](BASELINE.md) for recovery provenance, verification limits,
and exact Mac acceptance steps with a 16-link fixture. See
[CHANGELOG.md](CHANGELOG.md) for changes and [SECURITY.md](SECURITY.md) for
private vulnerability reporting. No release is published by this recovery.
