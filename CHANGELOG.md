# CHANGELOG

## Unreleased — v1.5.0-dev recovery

- Recovered optional Bing wallpaper from the unfinished feature branch into
  one loader using `startpage.settings.v1`; removed the need for injected
  wrappers and guessed keys. Preload, timeout, and stale-request protection
  preserve the current background on failure. No proxy/backend added.
- Use a solid-color first-run default; existing settings remain in use.
- Replace competing drag paths with visible-slot ordering: capped and filtered
  collections retain hidden links and other groups at their existing positions.
- Keep tile opening enabled while layout is locked; cancel pointer gestures
  without opening links or saving an order.
- Make Close/Cancel non-submit buttons and stage local wallpaper uploads until
  Save. Restore the version header using the actual Settings heading.
- Validate backup structure before import and roll back failed storage writes.
- Add focused Playwright checks, browser CI, a live Bing diagnostic, and a Mac
  acceptance fixture. CI results do not establish Mac/Safari compatibility.
- Verification: 16 deterministic Chromium checks passed. A separate live Bing
  browser request was CORS-blocked and correctly retained the previous image;
  live Bing success and manual Mac/Safari acceptance remain unverified.
- Preserve main’s network/privacy guidance and security reporting policy;
  reconcile the stale v1.2.1 baseline document with recovery scope.

## v1.4.7 — 2025-10-13
### Added
- Robust version labels injected at runtime so they are always visible regardless of previous markup.

### Cosmetic
- Title spacing increased, with extra margin below the title.

### Integrity
- Kept tile logic and drag code untouched from the last known good build.
