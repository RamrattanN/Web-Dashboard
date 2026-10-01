# Kanban

## Backlog

### Export backup: choose filename and destination

- Status: Backlog.  Deferred until after the current recovery and acceptance work.
- Requested: 2026-10-01.
- User need: Let users choose the backup filename and destination folder when exporting dashboard data, without requiring a change to browser-wide download settings.
- Acceptance criteria:
  - Offer a Save As picker from the Export action where the browser supports it.
  - Suggest a dated `.json` filename while allowing the user to change it.
  - Save the existing backup format to the selected destination.
  - Cancelling the picker leaves dashboard data unchanged and creates no download.
  - Unsupported browsers retain the current download flow with clear guidance that destination selection follows browser settings.
  - Confirm import compatibility and document supported browsers and any secure-context requirements.
- Implementation note: Evaluate browser file-picker support for both direct `file://` use and served pages before choosing the approach.  Keep the single-file application and no-build setup.

### Settings: group options logically

- Status: Partly implemented in the visual refresh on 2026-10-01; owner visual acceptance pending.  Settings are grouped into Dashboard, Layout and Wallpaper, as authorised for that work.  Still in Backlog: showing or enabling mode-specific wallpaper controls only where relevant, which would change behaviour.
- Requested: 2026-10-01 during manual Mac acceptance.
- User need: Make Settings easier to navigate by grouping related controls under clear section headings.
- Suggested groups: Layout and tiles; Wallpaper and appearance; Search and AI; Backup and data.
- Acceptance criteria:
  - Review all existing settings and place related controls together in a logical order.
  - Keep wallpaper mode, image URL or keyword, solid colour, and local upload controls together.
  - Show or enable mode-specific controls only where relevant, while preserving saved values.
  - Preserve existing setting behaviour, defaults, persistence, and import/export compatibility.
  - Keep headings, labels, keyboard navigation, and scrolling usable on narrow screens.

### Recent activity: expandable table and Chrome integration

- Status: Backlog.  Plan for the next feature phase after functional recovery and acceptance.
- Agreed: 2026-10-01.
- User need: Help users resume relevant browsing activity, including on first use.  Chrome browsing activity is more useful for this purpose than dashboard-only activity, which initially has no entries.

#### Shared presentation and behaviour

- Place a recent-items section below the dashboard tiles.
- Provide Show more / Show less to expand or collapse the section without changing saved tile layout.
- Display up to 10 unique URLs, newest activity first, in a table inside a card with a fixed maximum height and internal scrolling.
- Show site icon, title, domain, and last-viewed time.  Clicking a row opens its link in a new tab.
- Reopening a URL updates its activity timestamp and moves it to the top.
- Hide the entire section when there are no qualifying entries, with no empty card or reserved whitespace.
- Provide Clear recent items on the same screen within the card.

#### Timestamp-based clearing

- Clearing records a persistent clearedAt timestamp and immediately hides the card.
- Include only activity with a viewedAt timestamp strictly later than clearedAt.
- Reopening an older URL after clearing qualifies as new activity.
- The next qualifying activity makes the section reappear.
- Reloading preserves the clearing cutoff.
- Clearing affects the dashboard's recent-activity display only.  It does not delete saved tiles or Chrome browsing history.
- Pending activity reads must respect the latest cutoff so an older response cannot repopulate a cleared card.

#### Delivery modes

- Standalone dashboard: retain the single-file, no-build setup and record links opened through the dashboard.  Hide the recent-items section until activity exists.
- Chrome-integrated dashboard: plan an extension-based mode using permitted Chrome history access after the user grants permission.  Use existing recent history to populate the card on first use when available.
- Keep the standalone version available alongside Chrome integration.
- If history is empty, access is declined or revoked, or integration is unavailable, do not display blank placeholders or fabricate activity.  Use the standalone fallback where applicable.
- Do not promise synced cross-device tabs or history as part of this scope; the screenshot is a presentation reference.  Verify actual history API coverage during extension design.

#### Acceptance and implementation planning

- Verify first use with existing Chrome history, first use without history, and permission denial or revocation.
- Verify ordering, deduplication, the 10-item limit, internal scrolling, and keyboard access.
- Verify clearing, reload persistence, repeated clearing, and reopening a previously cleared URL.
- Verify new qualifying activity reappears after clearing, including while the dashboard stays open in integrated mode.
- Define refresh timing and extension packaging during implementation planning.
- Keep recent activity local.  Decide backup treatment explicitly so importing an older dashboard backup cannot unintentionally undo a clearing cutoff.
- Preserve existing tiles, settings, import/export, and drag behaviour.
- This entry documents the agreed design only; implementation is deferred.

### Visual refresh: adopt the Ramrattan Rentals design baseline

- Status: Implemented on the recovery branch on 2026-10-01; **owner visual acceptance pending**.  CI passes, and the validation evidence and its limits are recorded in BASELINE.md.  Not merged or released.
- Requested: 2026-10-01.
- User direction: Finish the existing Claude workload first.  Prepare the cosmetic implementation work order later.
- Specification: [DESIGN_BASELINE.md](DESIGN_BASELINE.md), containing the pinned Rentals source reference, exact palette, typography, icon style, brand asset, surfaces, controls, and verification requirements.
- Scope:
  - Adopt the navy header, pale page surface, white cards, rounded controls, and subtle shadows.
  - Use Arial, Helvetica, sans-serif and consistent outline SVG application icons.
  - Use the existing Ramrattan shield logo; retain saved-site favicons and custom icons.
  - Correct the unreadable dashboard tip text.
  - Preserve existing users' wallpaper choices and all functional behaviour.
- Acceptance: Verify desktop and narrow-screen presentation, contrast, keyboard focus, saved wallpapers, long titles, tile sizing and density controls, and existing functional regression checks.
- Implementation was authorised on 2026-10-01 after functional acceptance was completed.

### Functional follow-ups from the PR #3 review

- Status: Backlog.  Recorded 2026-10-01; none of these block the recovery.
- Bing daily wallpaper: disabled in Settings until a real Bing image is shown to load in a browser.  Bing blocks the request by CORS; re-enabling needs a verified approach and a separate decision on any proxy or backend.
- Group filter with no matching group (review finding F5): after an import, or after removing or editing the last tile in the active group, the grid is empty and no pill is shown to clear the filter.  Fall back to All, or show a way to clear it.
- Import of hand-edited backups (review finding F6): numeric settings written as strings, such as `"maxTiles": "3"`, are rejected.  Backups written by the dashboard are unaffected.  Any change must keep validation strict rather than loosen it.
- Duck.ai search panel: deferred.  Replace the DuckDuckGo panel only once an approach is verified in a browser to carry typed text into Duck.ai.  DuckDuckGo's `!ai` route failed this on 2026-10-01 in Chrome on macOS: `https://duckduckgo.com/?q=%21ai+dashboard+prompt+test+12345` opened ordinary search results, so that route must not be used.  DuckDuckGo search parameters also do not carry over (`duckduckgo.com/chat?q=…` redirects to `duck.ai/chat` without the text).

Entries marked Backlog record future work only: export destination selection, recent activity, the functional follow-ups (including F5 and F6), Bing daily and the Duck.ai panel are not implemented.
