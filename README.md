# WebDashboard — v1.5.0-dev (unreleased)

A customizable single-page browser dashboard with tiles, groups, search, wallpaper, and layout settings.  The baseline starting point for this recovery is v1.4.7 (`b08b98b`); this branch is unreleased development.  No GitHub Release ZIP is currently published.

## Run it

1. For this unreleased recovery, download [`index.html`](https://github.com/RamrattanN/Web-Dashboard/blob/recovery/wallpaper-and-regressions/index.html) from the recovery branch.  The file on `main` is the earlier baseline and does not include this work.
2. Open the file in a browser.  Configure tiles and layout using the Settings dialog.
3. If you serve it from a web server, replace its `index.html` with this file and reload the page.

There is no build step or package installation.  See the [Wiki](https://github.com/RamrattanN/Web-Dashboard/wiki) for settings, icons, troubleshooting, and baseline details.

## Network and privacy

The visual refresh uses Arial/Helvetica system fonts and embedded application assets, without Google Fonts or a runtime dependency on Ramrattan Rentals.  The page may request favicons from saved sites or external favicon services.  Search, remote wallpaper, and opening a tile contact the selected providers or sites.  Review the URLs and browser requests if you need an offline setup.  Browser settings and dashboard data are stored locally in your browser.

## Group filters and search

The group bar starts with **All**, followed by one button per group.  All is
highlighted when no filter is set and shows every link up to the tile limit.
Choosing a group shows only that group; clicking the selected group again, or
clicking All, clears the filter.  The choice is remembered across reloads.

The Google, Bing and Perplexity rows submit the typed text to those sites.
The **Duck.ai** row works differently, because no way of passing a prompt to
Duck.ai in its address has been verified (DuckDuckGo's `!ai` route was tested
and did not carry the prompt).  Pressing Enter or **Copy & open** copies the
prompt to the clipboard and opens `https://duck.ai/` in a new tab; you then
paste it there.  The typed prompt stays in the box.  If the browser refuses
the copy, Duck.ai is not opened and a message says so; if the new tab is
blocked, a message points to **Open Duck.ai**, an ordinary link that opens
Duck.ai without a prompt.  Duck.ai may show a welcome screen before it
accepts a paste.  Nothing typed in this row is sent anywhere by the dashboard.

## Wallpaper and data

A pale solid colour is the fresh-install default.  Existing wallpaper choices are preserved. Static URLs and local images are
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

CI installs Chromium and is the current automated verification route.  Earlier automated Chrome launches on the owner's Mac aborted before the dashboard loaded; do not repeat those launches in that environment.  Manual Mac checks use normally opened Chrome in the separate Dashboard Test profile.  Other developer environments may run the commands above where browser launch is supported.
The deterministic suite intercepts remote requests. A separate opt-in live
Bing diagnostic reports whether the provider loaded or the fallback remained:

```sh
LIVE_BING=1 npx playwright test --grep 'live Bing browser probe'
```

Functional acceptance was completed on 2026-10-01 for Chrome on macOS using the local `file://` dashboard, with complementary Linux Chromium CI coverage.  That record applies to the functional version at `443a334`; the subsequent visual refresh still requires owner visual acceptance.  Safari, Windows and real touch devices are not accepted platforms yet.

See [DESIGN_BASELINE.md](DESIGN_BASELINE.md) for the Ramrattan Rentals visual specification.  See [BASELINE.md](BASELINE.md) for recovery provenance, the evidence sources and verification limits, and a repeatable Mac checklist with a 16-link fixture. See
[CHANGELOG.md](CHANGELOG.md) for changes and [SECURITY.md](SECURITY.md) for
private vulnerability reporting. No release is published by this recovery.
