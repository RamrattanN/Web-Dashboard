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
- A profile with no saved links and no saved settings starts with the solid
  colour `#f3f7fa`. No other profile has its wallpaper settings rewritten.
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

## Visual refresh — accepted by the owner at `327ff8c`

The Ramrattan Rentals design in [DESIGN_BASELINE.md](DESIGN_BASELINE.md) was
applied after the functional acceptance above. The functional record above
describes `443a334` and is unchanged; it was not repeated by hand on the
restyled page. Visual acceptance was given by the owner on 2026-10-01; see
"Owner visual acceptance" below. The evidence table in this section records
what was known before that acceptance.

What changed is presentation only: header, tiles, menus, dialogs, icons,
fonts and colours. The script changes are limited to icon markup, accessible
names, group filters rendered as buttons, and the fresh-profile surface
colour. Storage keys, backup format, ordering, filtering, locking and
wallpaper handling are untouched. A new profile (no saved links and no saved
settings) starts on the pale surface `#f3f7fa`; any existing profile keeps
what it had. The shield logo is the Rentals asset embedded in the file, so
there is no runtime dependency on Rentals or on Google Fonts.

Evidence, by source:

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| All functional tests still pass on the restyled page (28 at the time of the refresh) | CI (Linux Chromium) | Behaviour is preserved under automation; not a manual Mac re-check |
| No horizontal overflow and header controls inside the viewport at 1440, 820 and 375 px wide, on pale, dark and image wallpapers | CI assertion | Layout arithmetic only |
| Text contrast of at least 4.5:1 for tip, tile title and description, group filters (normal and selected), engine labels, placeholders and the header label | CI assertion on computed colours | Measured against each element's own surface, which is opaque, so the wallpaper does not affect it |
| Every button has an accessible name, no emoji remain in controls, every icon control has a tooltip, and every keyboard stop shows a focus indicator (30 at the time of the refresh, 32 after the All button and Duck.ai row) | CI assertion | Presence of an outline or ring, not how it looks |
| Settings and Add link dialogs fit the viewport, scroll, and keep Close/Save on screen with each control focused, at 1440x700 and 375x600 | CI assertion | |
| Fresh profile gets the pale surface; saved links without saved settings keep the dark default; saved title, colour, filter, lock and tile limit are shown as saved | CI assertion | |
| Appearance of the header, tiles, hover and menu, selected filter, focus rings, tooltips and both dialogs | Agent inspection of the CI screenshots | Linux Chromium with Liberation Sans standing in for Arial, a synthetic wallpaper, and letter monograms instead of real favicons. Not the owner's Mac, wallpaper or fonts |
| Tooltip positioning, stacking of the tile menu, reduced-motion rule, narrow-width rules | Code review, partly confirmed by the screenshots | |

Safari was not checked by anyone.

## Group filter and Duck.ai row — accepted by the owner at `327ff8c`

Added after the visual refresh, at the owner's request.

- **All button.** The group bar starts with All. It is highlighted, with
  `aria-pressed="true"`, when no filter is set; otherwise only the selected
  group is. All clears the filter in one click and the tile limit still
  applies. A second click on the selected group still clears the filter.
  Stored data is unchanged: the filter is still `groupFilter`, with `All`
  meaning no filter.
- **Duck.ai row.** Replaces the DuckDuckGo row. DuckDuckGo documents no
  address parameter for passing a prompt to Duck.ai, `duckduckgo.com/chat?q=`
  redirects to `duck.ai/chat` without the text, and the `!ai` route failed the
  owner's browser test. The row therefore copies the prompt and opens
  `https://duck.ai/` for pasting. It never sends the typed text in an address.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| Work to All, News to All and General to All, each with reload; second-click toggle; tile limit; filtered drag keeps every link; stale filter cleared by All | CI (Linux Chromium) | Behaviour under automation |
| Copy, open, empty prompt, blocked tab and clipboard-failure messages; typed text kept; other providers' routing unchanged; no request made to Duck.ai or DuckDuckGo | CI with the clipboard and `window.open` replaced | The dashboard's own logic. Says nothing about Duck.ai |
| The prompt reaches the real clipboard and can be pasted, from a `file://` page and from a page served over plain `http` | CI (Linux Chromium, real clipboard, `window.open` replaced) | Copying works in Chromium in both contexts. Not macOS, not Safari |
| Duck.ai opens in a new tab and accepts the pasted prompt | Owner, Chrome on macOS, at `327ff8c` | Recorded under "Owner visual acceptance" below |

Known limits: Duck.ai may show a welcome or terms screen before a paste is
possible; a browser may refuse clipboard access or block the new tab, in
which case the row says so and the Open Duck.ai link still works; pasting is
a manual step.


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

## Owner visual acceptance — 2026-10-01, at `327ff8c`

Nilesh Ramrattan checked the following by hand in normal Chrome on macOS, in
the Dashboard Test profile, with the dashboard opened from `file://`, and
reported all seven as passed:

1. Header and wallpaper: navy bar, shield, title, four header buttons,
   wallpaper visible behind the tiles, readable tip line.
2. Group bar: All highlighted on load; General, News and Work each filter and
   return through All; a selected group persists across reload; a second
   click returns to All; filtered dragging leaves other tiles in place.
3. Duck.ai row: Copy & open copies the prompt and opens Duck.ai, the prompt
   pastes there, the typed text stays in the box, Open Duck.ai opens an empty
   chat, and an empty box opens nothing.
4. Tiles: hover state, menu items readable, drag appearance.
5. Tooltips and keyboard focus rings.
6. Settings: three groups, scrolling body, pinned Close and Save, native
   controls acceptable.
7. Narrow window: header wraps, search boxes stack, no sideways scrolling.

This acceptance covers `327ff8c`. The icon fix below came afterwards and has
its own owner check. Safari, Windows and touch devices are not covered.

## Tile icon fix — accepted by the owner at `0c22c32`

Reported by the owner: the ChatGPT tile showed a grey letter instead of its
icon. Cause, established by requesting each icon source directly:

- Icons were requested with `crossOrigin = 'anonymous'` although they are
  only displayed. Google's and DuckDuckGo's icon services hold the ChatGPT
  icon but send no `Access-Control-Allow-Origin` header, so those responses
  were discarded, as were sites' own icon files.
- `chat.openai.com` redirects to `chatgpt.com`.
- The one service that passed CORS returns a generated grey letter for
  `chat.openai.com`, and that result was cached.
- Two other listed services were dead: one no longer resolves, one answers
  with a 1x1 blank image.

The owner's saved tile and icon cache could not be read by the agent; the
default tile (`https://chat.openai.com`, no custom icon) matches the symptom.

Change: icons are requested without CORS; `chat.openai.com` looks up the icon
for `chatgpt.com` without changing the saved URL; OpenAI's own icon file
(`cdn.oaistatic.com`, confirmed to return the ChatGPT icon on 2026-10-01) is
tried first, then the site's paths, then Google, DuckDuckGo and icon.horse;
images under 32px are skipped; a cached source that fails or is blank is
looked up again; Refresh icon replaces a cached source that still loads.
The OpenAI file name contains a build hash and may change; the lookup then
continues to the next source.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| Which real sources hold the ChatGPT icon and which headers they send | Agent requests with curl, and viewing the returned images | The real services' answers on 2026-10-01. Not a browser |
| Official icon shown for a legacy tile with no CORS request and the saved URL unchanged; fallback to a service for `chatgpt.com`; placeholders skipped; monogram when nothing loads; custom icons untouched; Refresh icon and stale-cache recovery | CI (Linux Chromium) with every icon response supplied by the test | The dashboard's lookup logic. Nothing is fetched from the real services |
| The ChatGPT icon appears after Refresh icon and survives a reload; other tile icons unchanged | Owner, normal Chrome on macOS, Dashboard Test profile, at `0c22c32`, reported passed on 2026-10-01 | The owner's real tile, cache and network. One targeted check, not a repeat of the earlier seven |

### Correction after acceptance: minimum icon size 16px

The fix accepted at `0c22c32` skipped images under 32px. An external review
(Codex, of `c5d8db5`, using an isolated harness rather than a browser)
showed that this rejects legitimate 16x16 favicons, including cached ones.
The minimum is now 16px, so the statements above about "under 32px" and
"placeholders skipped" are superseded: only undersized images such as 1px
blanks are skipped, and a 16px "no icon" placeholder from a service is
shown like any real 16px favicon. Source order, the `chat.openai.com`
handling and the official ChatGPT icon source are unchanged.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| 32px minimum rejects real 16x16 favicons, including cached ones | Codex review, isolated harness | The defect. Not browser acceptance |
| 16x16 and 32x32 icons display and are cached with no later fallback; cached icons at both sizes are reused with no rediscovery; 1px and failed sources advance to the next valid source; exhausted sources show the monogram; custom icons unchanged; ChatGPT icon tests still pass | CI (Linux Chromium) with decodable PNG fixtures of exact sizes supplied by the test | The dashboard's logic. Nothing is fetched from real icon services |
| Effect on the owner's dashboard | Not separately checked by the owner | The owner's ChatGPT icon is 180px and is unaffected by the size limit |

## Picsum daily wallpaper — accepted by the owner at `fd8b37e`

Added after the acceptances above; none of them covers it. Its own owner
acceptance is recorded at the end of this section.

Behaviour: wallpaper mode `picsum` loads
`https://picsum.photos/seed/{seed}/1920/1080` as an ordinary image and
preloads it before replacing the background. The seed is `daily-YYYY-MM-DD`
from the local calendar date unless a picture was already saved for today.
Change picture requests a new `pick-…` seed. After a photo loads, its seed
and date are stored as `picsumSeed` and `picsumDate` in
`startpage.settings.v1`, so they travel in backups; older backups import
unchanged, and a seed that is not plain letters, digits, `_` or `-` is
ignored. On failure nothing is stored, the displayed background stays, a
message with Try again is shown, and unrelated redraws do not retry. The
solid colour is kept behind the photo and is what shows when no photo loads.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| Seed A displays, reload displays A, Seed B displays, a failed request preserves B, on `file://` and on localhost | Owner's isolated Picsum investigation, Chrome on macOS, before this implementation | That Picsum images load directly in the owner's browser. It did not exercise the dashboard. Browser version, image dimensions and timings were not recorded |
| Daily seed from the local date (including a timezone ahead of UTC); same-day reload; new day; Change picture and its persistence; failure keeps the background, shows the message, saves nothing and does not auto-retry; Try again; fresh load with no photo keeps the solid colour; slow responses cannot replace a newer picture or another mode; switching modes in Settings; export and import, older backups, malformed seeds | CI (Linux Chromium) with every picsum.photos response supplied by the test and the clock fixed | The dashboard's logic. Nothing is fetched from Picsum |
| Header with Change picture at 1440, 820 and 375 px, the failure message, and the Settings explanation | CI layout and contrast assertions, and agent inspection of the CI screenshots | Linux Chromium with a flat grey stand-in image |
| Picsum daily on the real dashboard: loading, Change picture, reload, failure retention, switching back | Owner, Chrome on macOS, at `fd8b37e` | Real provider, real browser and the owner's own data; see below |

Limits: a different seed does not guarantee a different photo; the photo for
a seed is whatever Picsum serves and may change if Picsum changes its
catalogue; there is no offline copy, so a reload without network shows the
solid colour; the day changes only when the dashboard is opened, reloaded or
redrawn, not on a timer.

### Owner acceptance — 2026-10-01, at `fd8b37e`

Nilesh Ramrattan checked the following by hand in normal Chrome on macOS, in
the Dashboard Test profile, with the dashboard opened from `file://`, and
reported all five as passed:

1. Initial loading: selecting Picsum daily and saving shows a photo and the
   Change picture button.
2. Reload shows the same photo.
3. Change picture loads a photo, and it is still shown after a reload.
4. With the network set to Offline, Change picture leaves the current photo
   in place and shows the message; Try again succeeds once back online.
5. Switching back to Local image file restores the saved local image.

This acceptance covers Picsum at `fd8b37e` in that browser and profile. Not
checked by the owner: the change of photo on a new calendar day (covered by
CI with a fixed clock only), a page served over `http`, and Safari, Windows
and touch devices. The 16px icon-size correction in the same head was not
separately checked by the owner.

## Settings field alignment — accepted by the owner at `814a2cd`

Reported by the owner after the Picsum acceptance and recorded separately
from it: in the Wallpaper group the "Image URL, keyword, or Bing market"
label wrapped to two lines and pushed its input out of line with the
adjacent "Solid color" input.

Change (`814a2cd`): side-by-side fields share a baseline, so a label that
wraps grows upwards and the paired controls stay level. Fields still stack
on narrow screens. No control or behaviour changed.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| For all six paired fields in Settings: control tops and bottoms level at desktop width with the wallpaper label wrapping to two lines, no label clipped, fields stacked at phone width | CI assertion (Linux Chromium) | Layout arithmetic in that browser and font |
| Desktop and phone screenshots of the Wallpaper group | Agent inspection of the CI screenshots | Linux Chromium rendering, not the owner's Mac |
| The alignment adjustment looks correct | Owner, Chrome on macOS, Dashboard Test profile, at `814a2cd`, 2026-10-01 | A visual confirmation of the adjustment as a whole. The owner did not report results for individual checklist steps |

## Search section: six providers, new tabs and reordering — implemented, owner acceptance pending

Added after every acceptance above; none of them covers it. The Duck.ai row
accepted at `327ff8c` keeps its behaviour and wording, with the provider name
now inserted by shared code.

Prompt-transfer findings (2026-10-01):

| Provider | Finding | Source | Result |
| --- | --- | --- | --- |
| Google, Bing | Standard `?q=` search address | Long-standing public behaviour; not re-verified in a browser here | Form opens a new tab; the browser encodes the query |
| Perplexity | `perplexity.ai/search?q=` answers with a redirect to `/search/new?q=` that keeps the query | Agent request with curl; previously in use on this dashboard | Unchanged, now with an Open link |
| Duck.ai | No address parameter documented by DuckDuckGo; `!ai` route failed in the owner's Chrome | DuckDuckGo help pages; owner test | Copy & open |
| ChatGPT | OpenAI's help documents its browser extension for address-bar search. `chatgpt.com/?q=` appears only in third-party articles and community posts, which also report it changing. The official article could not be fetched directly (HTTP 403), so its contents were read from search results | Web search, 2026-10-01 | Treated as unverified: Copy & open |
| Claude | Anthropic documents `claude://claude.ai/new?q=` for the Claude Desktop app, prefilled and not sent. No web address is documented; third-party reports say `claude.ai/new?q=` no longer works | Claude support article "Open Claude Desktop with a link"; web search | Copy & open to `https://claude.ai/new`. The desktop link is not used: it needs the app installed and the page cannot tell whether it opened |

Behaviour: six boxes in a two-column grid (one column under 760px), with
`clamp(24px, 10vh, 120px)` of space under the header. Search boxes are
ordinary forms with `target="_blank"`; copy boxes have no named field, so a
form submission cannot carry their text. Order is stored as
`settings.providerOrder`; unknown ids are ignored and missing providers
follow in default order. The grip is the only drag start. `showExtraSearch`
hides the four AI providers.

| Evidence | Source | What it does and does not show |
| --- | --- | --- |
| Google, Bing and Perplexity open a new tab whose `q` decodes to exactly what was typed, for spaces, accented and CJK text, emoji and punctuation; the dashboard URL and input are unchanged; blank input opens nothing | CI (Linux Chromium) with the destination sites intercepted | What the dashboard sends. Not how the sites respond |
| Duck.ai, ChatGPT and Claude: copy and open, copy refusal, blocked tab, empty input, typed text kept, no named field, no request to the provider | CI with the clipboard and `window.open` replaced | The dashboard's logic only |
| Reorder by grip forwards and backwards across rows; no reorder from the input, label or other controls; text selection in the input works; typed text preserved; cancelled drag restores; reload persistence; tile order untouched | CI with real mouse input | |
| Move earlier / Move later menu, arrow keys, disabled ends, focus kept, announcements, hidden providers keep their places | CI with real keyboard input | |
| Backups: order exported and imported; backups without an order; unknown and duplicate ids; malformed values rejected | CI | |
| Six boxes, 80–120px of room at desktop and tablet sizes and 16–40px on a phone, two columns then one, no horizontal overflow, focus indicator on all 47 keyboard stops, grip tooltip, move menu not covered | CI layout assertions | |
| Appearance of the new layout, grip tooltip and move menu | Agent inspection of the CI screenshots | Linux Chromium, not the owner's Mac |
| Real providers and the owner's browser: new tabs, encoding as seen by the sites, pasting into ChatGPT and Claude, dragging with a real pointer | **Pending owner acceptance** | |
