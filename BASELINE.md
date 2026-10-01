# Recovery baseline — v1.5.0-dev (unreleased)

## Provenance and scope

Recovery starts from `origin/main` at `b08b98b` (v1.4.7). Reviewed
`origin/feature/next` at `035d5bc`: recovered the Bing mode and image-preload
intent, but not its overlapping wallpaper scripts, guessed storage keys,
Bing default, or older privacy claims. `SECURITY.md` is preserved unchanged.
The v1.5.0 tag on that unfinished branch is not a verified release baseline.

The application is still one `index.html`, opened directly or served as a
static file. No build, runtime package install, proxy, or backend is required.
Node and Playwright are developer-only regression tools.

## Behaviour under test

- One click opens a tile in a new tab. Layout lock disables dragging while
  preserving opening and menu actions.
- Pointer dragging works between rows in both directions. Reordering replaces
  only visible array slots. Other groups and links beyond `maxTiles` keep
  their exact positions and content; no hidden entries are dropped.
- Settings use `startpage.settings.v1`; links use `startpage.links.v1`.
  Save persists; Close, Cancel, and Escape discard dialog edits, including
  a selected local wallpaper. Pointer cancellation does not open or reorder.
- One wallpaper implementation handles all modes. Images are preloaded before
  replacement; network/HTTP/JSON/image failures retain the currently displayed
  image or color. Loading times out after 15 seconds; stale requests cannot
  replace a newer selection. Failed selections retry on a subsequent Save or
  reload, not on unrelated renders. Bing daily is disabled in Settings until
  live loading is verified; a saved Bing mode is kept and only a market code
  (`xx-XX`) can be sent to the provider.
- Each wallpaper mode keeps its own value (`savedValues` holds the inactive
  modes). A storage failure on Save shows an error and changes nothing.
- Only one pointer can drag at a time; additional pointers are ignored and
  cancellation removes the ghost and placeholder. An order is saved only if
  it is a complete rearrangement of the stored links.
- The previous image is retained **in the current page only**. There is no
  persistent Bing image cache; after reload a failed request leaves the base
  color. The saved mode remains Bing even when its request fails.
- Export includes all links, settings, groups, icons, order, and local image
  data, including hidden links. Import validates structure before writing;
  invalid backups leave existing data intact. Storage limits still apply.

## Verification record

On 2026-10-01, [CI run 36889588364](https://github.com/RamrattanN/Web-Dashboard/actions/runs/36889588364)
passed **16 deterministic checks** using Chromium 145.0.7632.6 on Linux at
application/test commit `388663f`. The live diagnostic is skipped in that
suite and runs separately; it also passed its fallback assertion.

The actual Bing archive request from the local-file origin (`null`) was
blocked by CORS: the response lacked `Access-Control-Allow-Origin`. The
previous local image remained displayed. Successful Bing loading is covered
with controlled browser responses; **live Bing image success was not verified**.
No browser security settings were changed. This recovery does not solve Bing's
cross-origin restriction. A proxy/backend would need a separate discussion.

Inline JavaScript syntax, dependency audit (zero reported vulnerabilities),
and `git diff --check` also passed at that commit.

Functional-fix commit `443a334` changed the application and extended the
suite (drag overlap and order validation, per-mode wallpaper values, Bing
market validation and deferral, retry behaviour, storage errors, and the
three-of-six acceptance scenarios). The figures above predate it. On
2026-10-01 both CI runs for `443a334`
([36897323749](https://github.com/RamrattanN/Web-Dashboard/actions/runs/36897323749),
[36897318872](https://github.com/RamrattanN/Web-Dashboard/actions/runs/36897318872))
ran 28 tests: **27 passed, 1 skipped, 0 failed**. The skipped test is the
opt-in live Bing probe; in its own step it passed its fallback assertion
(Bing blocked the request by CORS and the previous image remained). Later
commits on the branch change documentation only.

## Functional acceptance record — 2026-10-01

Each result names its source. **CI** is Playwright driving Chromium on Linux
with intercepted network requests, at `443a334`. **Owner** is Nilesh
Ramrattan testing by hand in normal Chrome on macOS, in the Dashboard Test
profile, with the dashboard opened from a local `file://` path on the fixed
version (`443a334`). The Chrome version was not recorded. No result comes
from agent-driven browser testing: local Chrome automation was not run, and
attempted browser-sidebar checks were blocked and provide no evidence.

| Check | Result | Source |
| --- | --- | --- |
| Tile drag ordering, including persistence after reload | Passed | Owner; CI |
| Work-group reordering leaves other tiles in place, persists after reload | Passed | Owner; CI |
| Layout lock blocks dragging; single click opens one tab; More menu and right-click menu work while locked; lock persists after reload | Passed | Owner; CI for locking and opening |
| Solid colour wallpaper, including reload | Passed | Owner |
| Saved local image returns when switching back to Local image file, including reload | Passed | Owner; CI |
| Local image upload, including reload | Passed | Owner; CI for staging and Save |
| Export/import restoration | Passed | Owner (before the fixes, at `d35b513`); CI at `443a334` |
| Imported tiles, settings and order persist after reload | Passed | CI |
| Cancelling a tile edit keeps the original values (Cancel button) | Passed | CI |
| Cancelling a tile edit with Escape keeps the original title | Passed | Owner |
| Cancelling Settings (Close and Escape) keeps saved values and appearance, including a staged local image | Passed | CI |
| Six links with a three-tile cap: reordering keeps every hidden link, with and without a group filter | Passed | CI |
| Failed static wallpaper request keeps the working background | Passed | Owner (real request to `https://example.com/missing-wallpaper.png`); CI (intercepted request) |
| Bing daily is greyed out and cannot be selected | Passed | Owner; CI |
| Bing failures keep the previous background; only a market code is sent | Passed | CI (controlled responses) |
| Bing loads a real image | **Not achieved** | CI live probe: blocked by Bing's CORS policy; feature deferred |
| A second pointer during a drag is ignored; invalid orders are not saved | Passed | CI (synthetic second pointer); not tested on a touch device |
| Oversized local image shows a storage error and keeps settings | Passed | CI (simulated full storage); not tested with a real oversized file |

Not verified in any browser: Safari, Windows, and touch devices. Duck.ai
prompt transfer through DuckDuckGo's `!ai` route was tested by the owner and
**failed** (ordinary search results opened), so that panel change is deferred.
The steps below are the original checklist, kept for repeating acceptance in
another browser.

## Exact Mac acceptance steps

1. Export your existing dashboard first. Use a separate Chrome profile for
   this check so your normal dashboard data is untouched. In Terminal:
   ```sh
   cd /Users/nileshramrattan/Projects/Web-Dashboard
   git switch recovery/wallpaper-and-regressions
   open -a "Google Chrome" index.html
   ```
   In Chrome press Command+0 for 100% zoom. Verify Settings shows
   `WebDashboard v1.5.0-dev`.
2. Import `tests/fixtures/mac-acceptance.json` using Import. It contains 16
   disposable example.com links, alternating Work/Other groups, a local
   wallpaper, three columns, and a six-tile display cap. Confirm six tiles
   appear and a single click opens exactly one new tab.
3. Drag Tile 0 after Tile 5 across rows. Export: the complete title order must
   be `1,2,3,4,5,0,6,7,8,9,10,11,12,13,14,15`, prefixed by `Tile `.
   Drag Tile 0 back before Tile 1 and confirm the original order.
4. Click Work. Drag Tile 0 after Tile 10. Export: the complete order must be
   `2,1,4,3,6,5,8,7,10,9,0,11,12,13,14,15`. In particular Other links
   and hidden Work links 12 and 14 must be unchanged. Click Work again
   to return to All. Reimport the fixture to reset test data.
5. Settings: set Lock layout to Yes and Save. Verify dragging does nothing,
   single-click still opens one tab, and the More menu opens. Reload and
   confirm the lock and six-tile limit persist. Unlock and Save.
6. Change the tile limit and choose a local wallpaper file, then Close.
   Reopen Settings: neither change should be saved. Repeat with Escape.
   Add link → Cancel with an empty URL must close immediately; edit a tile's
   title → Cancel must retain its original title. Repeat using Save and
   reload to confirm saved edits persist.
7. Reimport the fixture and open Settings. Bing daily must be greyed out and
   not selectable. Change Wallpaper mode to Static image URL: the value field
   must become empty, not show the local image data. Change back to Local
   image file: the image data must return. Close without saving.
8. Reimport the fixture. In Settings choose Static image URL, enter
   `https://example.com/missing-wallpaper.png`, and Save. The previous
   wallpaper must stay visible. Open Settings, choose Local image file, and
   Save: the fixture wallpaper must still be shown and survive a reload.
9. Save a local image, Export, reimport the fixture, then Import that export.
   Verify settings, wallpaper, order, groups, icons, and all 16 links restore.
   Import a JSON file containing `{"links":[null]}`: expect an error and no
   changes. A cancelled file picker must do nothing.
10. In Terminal, optional developer checks (Node 20+ and Chrome installed):
    ```sh
    npm ci
    npm test -- --workers=1
    LIVE_BING=1 npx playwright test --grep 'live Bing browser probe'
    ```
    Repeat steps 2–9 in Safari if Safari support is required. Report browser
    version and results before treating that browser as accepted.
