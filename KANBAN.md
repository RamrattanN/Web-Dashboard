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

- Status: Backlog.  Deferred until after the current recovery and acceptance work.
- Requested: 2026-10-01 during manual Mac acceptance.
- User need: Make Settings easier to navigate by grouping related controls under clear section headings.
- Suggested groups: Layout and tiles; Wallpaper and appearance; Search and AI; Backup and data.
- Acceptance criteria:
  - Review all existing settings and place related controls together in a logical order.
  - Keep wallpaper mode, image URL or keyword, solid colour, and local upload controls together.
  - Show or enable mode-specific controls only where relevant, while preserving saved values.
  - Preserve existing setting behaviour, defaults, persistence, and import/export compatibility.
  - Keep headings, labels, keyboard navigation, and scrolling usable on narrow screens.

These entries record future work only.  Application behaviour is unchanged.
