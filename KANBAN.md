# Kanban

Current baseline: v1.5.1.  Final four-provider dashboard accepted by the owner at `9d172f1` on 2026-10-01; PR #3 merged at `5ab4c00`; [GitHub Release v1.5.1](https://github.com/RamrattanN/Web-Dashboard/releases/tag/v1.5.1) published on 2026-10-02 at `901807f`.  Historical accepted commits are recorded in BASELINE.md.

## Delivered in v1.5.1

- Functional recovery: safe tile ordering, layout lock, dialog cancellation and wallpaper handling.
- Rentals visual refresh, grouped Settings, paired-field alignment and explicit All filter.
- ChatGPT favicon recovery and 16px icon-size correction (CI verified).
- Picsum daily wallpaper, Change picture, reload persistence and failure/retry handling.
- Google, Bing, DuckDuckGo and Perplexity search in new tabs; provider drag/keyboard ordering and backup migration.


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

- Status: Partly implemented in the visual refresh on 2026-10-01 and accepted by the owner at `327ff8c`.  Settings are grouped into Dashboard, Layout and Wallpaper, as authorised for that work.  Still in Backlog: showing or enabling mode-specific wallpaper controls only where relevant, which would change behaviour.
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


### Functional follow-ups from the PR #3 review

- Status: Backlog.  Recorded 2026-10-01; none of these block the recovery.
- Bing daily wallpaper: disabled in Settings until a real Bing image is shown to load in a browser.  Bing blocks the request by CORS; re-enabling needs a verified approach and a separate decision on any proxy or backend.
- Group filter with no matching group (review finding F5): after an import, or after removing or editing the last tile in the active group, the grid is empty.  The All button added on 2026-10-01 now clears such a filter in one click.  Still in Backlog: falling back to All automatically.
- Import of hand-edited backups (review finding F6): numeric settings written as strings, such as `"maxTiles": "3"`, are rejected.  Backups written by the dashboard are unaffected.  Any change must keep validation strict rather than loosen it.
- Duck.ai search panel: delivered on 2026-10-01 as a copy-and-open flow and accepted by the owner at `327ff8c`; later removed at the owner's direction when DuckDuckGo web search was restored (see "Search section: four providers").  Direct prompt transfer to Duck.ai is no longer planned.  For the record: DuckDuckGo's `!ai` route failed this on 2026-10-01 in Chrome on macOS (`https://duckduckgo.com/?q=%21ai+dashboard+prompt+test+12345` opened ordinary search results) and must not be used; DuckDuckGo search parameters also do not carry over (`duckduckgo.com/chat?q=…` redirects to `duck.ai/chat` without the text).

Entries marked Backlog record future work only: export destination selection, recent activity, the remaining functional follow-ups (including the F5 fallback and F6) and Bing daily are not implemented.






## Delivery history

### Visual refresh: adopt the Ramrattan Rentals design baseline

- Status: Implemented on the recovery branch and visually accepted by the owner on 2026-10-01 at `327ff8c` (Chrome on macOS).  Evidence and limits are recorded in BASELINE.md.  Included in the v1.5.1 baseline.
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

### Group bar: explicit All button

- Status: Implemented on the recovery branch and accepted by the owner on 2026-10-01 at `327ff8c`.
- Requested: 2026-10-01.  Selecting General showed its two links and clicking it again cleared the filter, which made navigation confusing.
- Delivered: All comes first, is highlighted when no filter is set, and clears the filter in one click.  The second-click toggle is kept.

### Tile icons: ChatGPT icon and CORS requirement

- Status: Implemented on the recovery branch and accepted by the owner on 2026-10-01 at `0c22c32` (ChatGPT icon shown after Refresh icon and after reload; other tile icons unchanged).
- Reported: 2026-10-01.  The ChatGPT tile showed a grey letter instead of its icon.
- Delivered: icons are requested without a CORS requirement, legacy `chat.openai.com` tiles use the `chatgpt.com` icon without changing the saved URL, undersized images are skipped, and stale cached sources recover.  Details and evidence are in BASELINE.md.
- Corrected after acceptance on 2026-10-01: the minimum icon size was lowered from 32px to 16px so that real 16x16 favicons are kept.  Covered by CI; not separately checked by the owner.

### Wallpaper: Picsum daily

- Status: Implemented on the recovery branch and accepted by the owner on 2026-10-01 at `fd8b37e` (loading, same-photo reload, Change picture with persistence, offline failure and retry, switching back to the local image).  The new-day change of photo is covered by CI only.
- Background: the owner's isolated investigation showed Picsum images load directly in Chrome on macOS from `file://` and localhost.
- Delivered: a Picsum daily mode seeded by the local date, a Change picture button, same-day persistence of the loaded picture, failure retention with Try again, and backup compatibility.  Bing daily remains disabled and unchanged.  Details and evidence are in BASELINE.md.

### Search section: six providers, spacing and reordering

- Status: Superseded on 2026-10-01 by "Search section: four providers" below.  The owner reported that everything worked, but requested replacement of the AI interaction design.  Kept as a record.
- Requested: 2026-10-01.
- Delivered at the time: more space under the header; ChatGPT and Claude boxes added; Google and Bing open in a new tab; Copy & open for Duck.ai, ChatGPT and Claude; an Open link for every AI provider; drag, menu and arrow-key reordering saved as `providerOrder`.  Details and evidence are in BASELINE.md.
- No longer planned in the search section: Duck.ai, ChatGPT and Claude boxes were removed by the owner's later instruction.

### Search section: four providers

- Status: Implemented and accepted by the owner at `9d172f1` on 2026-10-01 (overall confirmation: "All looks good").  Included in v1.5.1.
- Requested: 2026-10-01.  Supersedes the six-provider section above.
- Delivered: Google, Bing, DuckDuckGo (restored as ordinary web search) and Perplexity; all open the encoded query in a new tab; empty input shows a message; Duck.ai, ChatGPT and Claude boxes and the Copy & open workflow removed; reordering, persistence and backups kept; saved six-box orders migrated; visibility setting relabelled "Show DuckDuckGo and Perplexity" with its key unchanged.  Details and evidence are in BASELINE.md.
