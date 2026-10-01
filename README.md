# WebDashboard — v1.5.0-dev (unreleased)

A customizable single-page browser dashboard with tiles, groups, search, wallpaper, and layout settings.  The baseline starting point for this recovery is v1.4.7 (`b08b98b`); this branch is unreleased development.  No GitHub Release ZIP is currently published.

## Run it

1. Download [`index.html`](https://github.com/RamrattanN/Web-Dashboard/blob/main/index.html) from this repository.
2. Open the file in a browser.  Configure tiles and layout using the Settings dialog.
3. If you serve it from a web server, replace its `index.html` with this file and reload the page.

There is no build step or package installation.  See the [Wiki](https://github.com/RamrattanN/Web-Dashboard/wiki) for settings, icons, troubleshooting, and baseline details.

## Network and privacy

The page loads Google Fonts and may request favicons from saved sites or external favicon services.  Search, remote wallpaper, and opening a tile contact the selected providers or sites.  Review the URLs and browser requests if you need an offline setup.  Browser settings and dashboard data are stored locally in your browser.

## Wallpaper and data

Solid color is the first-run default. Static URLs and local images are
preloaded before they replace the background. A failed request preserves the
background already displayed on the page, but that previous image is not
cached across reloads. A failed wallpaper is tried again when you Save
Settings or reload, not on every redraw. The legacy Unsplash keyword option
is retained for existing settings but its external endpoint is not guaranteed
to work.

**Bing daily is deferred and cannot be selected.** Bing does not allow
browser pages to read its image archive (the request is blocked by CORS), so
a real Bing image has never loaded in testing; only controlled responses
have. No proxy or backend is included. Dashboards already saved with Bing
daily keep that setting: the page still makes one direct request to Bing per
load and keeps the existing background when it fails. Only a market code
such as `en-US` is ever sent (blank uses `en-US`); an image or URL is never
sent as the market.

Each wallpaper mode keeps its own value. Switching mode in Settings shows
that mode's value, and the other modes' values, including a local image, stay
saved for when you switch back. A local image too large for browser storage
produces an error on Save and leaves existing settings unchanged.

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
