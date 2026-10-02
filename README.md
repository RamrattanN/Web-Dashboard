# WebDashboard - v1.5.1

A customizable single-page browser dashboard with tiles, groups, search, wallpaper, and layout settings.  This release builds on the v1.4.7 recovery starting point (`b08b98b`).  The owner accepted the final four-provider dashboard in Chrome on macOS at `9d172f1` on 2026-10-01.

## Run it

1. Download [`index.html`](https://github.com/RamrattanN/Web-Dashboard/blob/v1.5.1/index.html) from the versioned baseline, or download and extract the Source code ZIP from the [v1.5.1 release](https://github.com/RamrattanN/Web-Dashboard/releases/tag/v1.5.1).
2. Open the file in a browser.  Configure tiles and layout using the Settings dialog.
3. If you serve it from a web server, replace its `index.html` with this file and reload the page.

There is no build step or package installation.  See the [Wiki](https://github.com/RamrattanN/Web-Dashboard/wiki) for settings, icons, troubleshooting, and baseline details.

## Network and privacy

The visual refresh uses Arial/Helvetica system fonts and embedded application assets, without Google Fonts or a runtime dependency on Ramrattan Rentals.  Tile icons are requested from the saved site itself and then from Google, DuckDuckGo and icon.horse icon services (for ChatGPT, OpenAI's own icon file first); a custom icon URL on a tile is used instead of any lookup.  Search, remote wallpaper, and opening a tile contact the selected providers or sites.  Review the URLs and browser requests if you need an offline setup.  Browser settings and dashboard data are stored locally in your browser.

## Group filters and search

The group bar starts with **All**, followed by one button per group.  All is
highlighted when no filter is set and shows every link up to the tile limit.
Choosing a group shows only that group; clicking the selected group again, or
clicking All, clears the filter.  The choice is remembered across reloads.

There are four separate search boxes: Google, Bing, DuckDuckGo and
Perplexity.  Nothing is sent until you press Enter in a box.

- Each box opens its result in a new tab with the query encoded by the
  browser.  The dashboard tab and the typed text stay as they are.
  DuckDuckGo is an ordinary web search at `https://duckduckgo.com/?q=…`.
- An empty box opens nothing and shows a message.
- Perplexity also has an ordinary **Open** link that opens it without a
  question.  The companion button on the Google and Bing boxes hands the
  typed query to Perplexity, as before.

**Reordering.**  Drag a box by the grip at its left edge, or focus the grip
and press Enter for **Move earlier** and **Move later** (the arrow keys also
move it).  Typed text stays in each box.  The order is saved, survives a
reload, and is included in backups as `providerOrder`; backups and settings
without it use the default order.  It is separate from the order of the
shortcut tiles.

The Settings option **Show DuckDuckGo and Perplexity** (stored as
`showExtraSearch`, as before) shows or hides those two boxes.  Google and
Bing are always shown.

An earlier unreleased build of this branch had six boxes, adding Duck.ai,
ChatGPT and Claude with a copy-and-paste workflow.  Those three were removed
from the search section.  An order saved by that build is read safely: the
Duck.ai position becomes DuckDuckGo, ChatGPT and Claude entries are dropped,
and the rest keep their relative order.  Shortcut tiles, including a ChatGPT
tile, are not affected.

## Wallpaper and data

A pale solid colour is the fresh-install default.  Existing wallpaper choices are preserved. Static URLs and local images are
preloaded before they replace the background. A failed request preserves the
background already displayed on the page, but that previous image is not
cached across reloads. A failed wallpaper is tried again when you Save
Settings or reload, not on every redraw. The legacy Unsplash keyword option
is retained for existing settings but its external endpoint is not guaranteed
to work.

**Picsum daily** shows an online photo from `https://picsum.photos`, loaded
as an ordinary image with no API key, proxy or backend. The picture is chosen
by a seed made from your local calendar date, so opening or reloading the
dashboard on a new day requests that day's photo; there is no background
timer. **Change picture** in the header asks for a new seed each time; Picsum
may return the same photo for different seeds, so a different picture is not
guaranteed. The seed of the last photo that loaded is saved with its date:
reloading on the same day shows it again, including one you chose with Change
picture, and a backup carries it. A photo that fails to load is never saved:
the background already on screen stays, a message with **Try again** appears,
and on a fresh load with no photo available the solid colour is shown. In
this mode the browser contacts `picsum.photos` and the image host it
redirects to.

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

Functional acceptance was completed on 2026-10-01 for Chrome on macOS using the local `file://` dashboard, with complementary Linux Chromium CI coverage.  That record applies to the functional version at `443a334`.  The visual refresh, the All group button and the Duck.ai row were visually accepted by the owner at `327ff8c`; a later tile-icon fix was accepted by the owner at `0c22c32`, and the Picsum daily wallpaper at `fd8b37e`.  Safari, Windows and real touch devices are not accepted platforms yet.

See [DESIGN_BASELINE.md](DESIGN_BASELINE.md) for the Ramrattan Rentals visual specification.  See [BASELINE.md](BASELINE.md) for recovery provenance, the evidence sources and verification limits, and a repeatable Mac checklist with a 16-link fixture. See
[CHANGELOG.md](CHANGELOG.md) for changes and [SECURITY.md](SECURITY.md) for
private vulnerability reporting. The v1.5.1 baseline contains the accepted recovery, visual refresh, Picsum wallpaper and four-provider search section.  [GitHub Release v1.5.1](https://github.com/RamrattanN/Web-Dashboard/releases/tag/v1.5.1) was published on 2026-10-02 at `901807f`.
