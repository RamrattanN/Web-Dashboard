# Visual baseline: Ramrattan Rentals

Status: Approved visual direction; implementation pending functional recovery and acceptance.  Recorded 2026-10-01.

## Reference

Use the supplied US Rentals screenshot for visual composition and RamrattanN/ramrattan-rentals at commit `e8fc0604d9637d70f353448cc71a77a85af0afe7` for exact styling and assets.

- [Stylesheet](https://github.com/RamrattanN/ramrattan-rentals/blob/e8fc0604d9637d70f353448cc71a77a85af0afe7/app/globals.css)
- [SVG icon directory](https://github.com/RamrattanN/ramrattan-rentals/tree/e8fc0604d9637d70f353448cc71a77a85af0afe7/public/icons)
- [Ramrattan logo](https://github.com/RamrattanN/ramrattan-rentals/blob/e8fc0604d9637d70f353448cc71a77a85af0afe7/public/ramrattan-logo.png)

The tokens below were read from the stylesheet, rather than estimated from the screenshot.  Component dimensions are reference values to adapt to Web-Dashboard's tile sizing and density settings.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| navy | #173f63 | Primary buttons, icons, outlines |
| navy-deep | #0d2942 | Header gradient, headings |
| blue | #2f78b8 | Accent, hover and focus |
| blue-pale | #eaf3fa | Highlighted surfaces |
| ink | #17232e | Main body text |
| muted | #5e6c78 | Secondary text on light surfaces |
| line | #d6e0e8 | Card borders and dividers |
| white | #ffffff | Cards and header text |
| background | #f3f7fa | Default page surface |
| tile surface | #fbfdff | Inner task tiles |
| header secondary text | #d8ebf8 | Supporting text in header |

Header: linear-gradient(135deg, #0d2942, #173f63).
Default page: pale background with a subtle radial blue highlight, as in Rentals.

## Typography

- Arial, Helvetica, sans-serif, matching Rentals.  No Google Fonts dependency is needed for this baseline.
- Bold navy headings and control labels; regular muted supporting text.
- Rentals references: body line height approximately 1.5; tile title 1.05rem at line height 1.25; tile description 0.84rem at line height 1.4; group heading 1.15rem.
- Header title uses responsive sizing and tight spacing.  Adapt its size to Web-Dashboard without crowding search or controls.
- Keep the editable dashboard title and its persistence.

## Brand and icons

- Use the existing Ramrattan shield logo asset, preserving its proportions.  Do not redraw or substitute a new logo.
- Application action icons: consistent outline SVGs, navy on light backgrounds and white on the navy header.
- Reference SVG geometry: viewBox 0 0 64 64; stroke width 3.5; round caps and joins; no fill.
- Adapt existing icons when their meaning matches.  Create missing actions in the same style with meaningful labels and tooltips.
- Replace emoji application controls with SVG controls during the cosmetic phase.
- Saved-site favicons retain their original brand colours and custom-icon support.

## Surfaces and controls

- White cards with subtle navy-tinted shadows and pale borders.
- Rentals card reference: 16px radius, 1px border, shadow 0 12px 32px rgba(13, 41, 66, 0.08).
- Inner tile reference: 14px radius, 2px border, pale surface; blue border and pale-blue surface on hover.
- Button reference: 12px radius; navy primary button with white text; outlined navy secondary buttons.
- Header icon reference: 52px square, 28px icon, 12px radius, light outline.
- Form reference: 10px radius, 2px border; clear blue focus treatment.
- Reference spacing: section gaps 18-24px, inner gaps 12-14px, card padding 18-24px.
- Reference content width: 1120px, with responsive gutters.  Adapt width to existing dashboard column and tile-width controls; do not hardcode a layout that defeats them.
- Use a navy brand header and clearly grouped body areas for search, saved links, and future recent activity.

## Wallpaper and accessibility

- Preserve solid-colour, local-image and static-image wallpaper functionality and saved choices.
- Use the Rentals pale surface as the fresh-install visual default; do not overwrite existing users' wallpaper settings.
- Keep cards and search controls readable over arbitrary wallpaper.  Supporting text needs an appropriate contrasting surface or treatment.
- Correct the currently unreadable dashboard tip text.
- Give icon controls accessible names, visible keyboard focus, and hover/focus tooltips.
- Keep responsive wrapping and respect reduced-motion preferences.
- Avoid adding Rentals-specific roles, portfolio selectors, flags or sign-out controls to Web-Dashboard unless separately requested.

## Scope and verification

This is a design baseline, not an implementation change.  Apply it after functional fixes and acceptance are complete.

- Preserve link opening, ordering, filtering, layout locking, settings persistence, and import/export.
- Keep the standalone single-file, no-build setup; embed required assets where needed rather than depending on Rentals being available at runtime.
- Recent activity, export destination selection, and Settings regrouping retain their separately recorded scope and timing.
- Verify desktop and narrow-screen layouts, saved wallpapers, long titles, varying tile density and column settings, keyboard focus, and text contrast.
- Run relevant existing functional checks after styling changes and obtain manual visual acceptance before merging.
