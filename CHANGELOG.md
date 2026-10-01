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
- Fix: a second pointer during a drag, or a drag that never ended, could
  leave a placeholder behind and save an order with a missing link. Only one
  pointer drags at a time, cancellation cleans up, and an order is saved only
  when it is a complete rearrangement of the stored links.
- Fix: switching wallpaper mode no longer reuses another mode's value, so a
  local image or URL can never be sent to Bing as the market. Each mode keeps
  its own saved value; the Bing market must be a code such as `en-US`.
- Fix: a failed wallpaper is retried on Save or reload, not on every redraw.
- Fix: a local image too large for browser storage shows an error on Save
  and leaves existing settings unchanged.
- Bing daily is deferred: the option is disabled in Settings because Bing
  blocks browser requests and a real image has never loaded. Saved Bing
  settings are kept. No proxy or backend added.
- Visual refresh to the Ramrattan Rentals baseline (see DESIGN_BASELINE.md):
  navy brand header with the Ramrattan shield and the editable title; white
  cards with pale borders; navy primary and outlined secondary buttons; 2px
  form controls with a blue focus treatment; Arial/Helvetica instead of
  Google Fonts, which is no longer loaded.
- Emoji controls replaced by outline SVG icons with accessible names and
  hover/focus tooltips. Add link, Import, Export and Settings moved into the
  header. Group filters are now buttons, so they can be reached by keyboard.
- Settings grouped into Dashboard, Layout and Wallpaper, with a scrolling
  body and a pinned header and Close/Save footer. Every setting keeps its
  behaviour and stored key.
- The tip text now sits on its own surface and is readable on any wallpaper.
  The dark vignette over wallpapers was removed because the title no longer
  sits on the wallpaper.
- A genuinely new profile starts on the pale Rentals surface (`#f3f7fa`).
  Existing profiles keep their saved wallpaper; profiles with saved links
  but no saved settings keep the previous dark default.
- Tests: the suite's "block all https" rule only matched URLs ending in `/`,
  so favicon and image requests reached the network. It now blocks every
  https request. A visual-review spec checks overflow, contrast, focus
  indicators, control names and dialog scrolling, and uploads screenshots as
  a CI artifact. Owner visual acceptance on macOS is still pending.
- Group bar: an explicit **All** button comes first, is highlighted when no
  filter is set, and clears the filter in one click. Only the selected group
  is highlighted otherwise; a second click on it still returns to All. A
  saved filter for a group that no longer exists can now be cleared with All.
- The DuckDuckGo search row is replaced by **Duck.ai**. No prompt-transfer
  address is verified, so the row copies the prompt and opens Duck.ai for
  pasting, keeps the typed text, reports clipboard and blocked-tab failures,
  and offers a plain Open Duck.ai link. The Perplexity companion button is
  removed from this row; Google, Bing and Perplexity routing is unchanged.
- Fix: tile icons were requested with an anonymous CORS requirement although
  they are only displayed. That discarded icons from the site itself and from
  Google's and DuckDuckGo's icon services, leaving one service whose answer
  for `chat.openai.com` is a generated grey letter. Icons are now requested
  without CORS. Legacy `chat.openai.com` tiles look up the icon for
  `chatgpt.com`, starting with OpenAI's own icon file, and keep their saved
  URL. Images under 32px (blank pixels and "no icon" placeholders) are
  skipped, two dead icon services are removed, and a cached source that fails
  or is blank is looked up again. Custom icons and the letter monogram are
  unchanged. The default ChatGPT tile for new profiles points to
  `https://chatgpt.com`.
- Correction to the icon fix above: the minimum icon size is 16px, not 32px.
  The 32px limit rejected legitimate 16x16 favicons, including ones already
  cached, and sent them back through lookup. Only images smaller than 16px,
  such as 1px blanks, are now skipped. This does not detect every "no icon"
  placeholder a service may return: a 16px placeholder is shown like a real
  16px favicon. Source order and the ChatGPT icon handling are unchanged.
- New wallpaper mode **Picsum daily**: an online photo from picsum.photos
  chosen by a seed from the local calendar date, loaded as an ordinary image.
  A header **Change picture** button asks for a new seed. The seed of the
  last photo that loaded is saved with its date, so a same-day reload and a
  backup keep it. Failures keep the current background, show a message with
  Try again, and are never saved; slow responses cannot replace a newer
  picture or another mode. Other wallpaper modes are unchanged and Bing
  daily stays disabled. Accepted by the owner on the real dashboard at
  `fd8b37e` (Chrome on macOS, `file://`).
- Settings layout: paired fields now keep their controls level when one
  label wraps, which fixes the wallpaper value input sitting lower than the
  solid colour input. Fields still stack on narrow screens. Visually accepted
  by the owner at `814a2cd` (Chrome on macOS), separately from Picsum.
- Search section: six provider boxes (Google, Bing, Duck.ai, Perplexity,
  ChatGPT, Claude) with more space between the header and the boxes. Google
  and Bing now open in a new tab, like Perplexity, leaving the dashboard and
  the typed query in place; an empty box opens nothing. ChatGPT and Claude
  are new and, like Duck.ai, use Copy & open because no documented and
  verified web address accepts a prompt. Perplexity gains an Open link in
  place of two disabled buttons.
- Provider boxes can be reordered with a grip (drag), a Move earlier / Move
  later menu, or the arrow keys. The order is saved as `providerOrder`,
  survives reload and travels in backups; tile order is unaffected.
- The "Show secondary search row" setting is renamed "Show AI providers" and
  hides Duck.ai, Perplexity, ChatGPT and Claude together. Its stored key and
  its effect on Duck.ai and Perplexity are unchanged.
- The search-section changes above await owner acceptance.
- Owner visual acceptance of the refresh, the All button and the Duck.ai row
  was given on 2026-10-01 at `327ff8c` (Chrome on macOS). The ChatGPT icon
  fix was accepted by the owner at `0c22c32`.

## v1.4.7 — 2025-10-13
### Added
- Robust version labels injected at runtime so they are always visible regardless of previous markup.

### Cosmetic
- Title spacing increased, with extra margin below the title.

### Integrity
- Kept tile logic and drag code untouched from the last known good build.
