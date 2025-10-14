# CHANGELOG

## v1.4.9 — 2025-10-13
### Added
- **Bing daily** wallpaper provider with market selection via “Image URL or keyword” (for example `en-US`).  
- First-run default now selects Bing daily so a background is visible immediately.

### Fixed
- Better resilience when a wallpaper provider is unreachable.  The previous background is retained.

### Changed
- Settings footer always shows the current version label at runtime.

## v1.4.8 — 2025-10-13
### Added
- Version label injected in the Settings dialog header and footer so it always appears regardless of markup.

### Cosmetic
- Increased title spacing and a clearer gap below the title for readability.

## v1.4.7 — 2025-10-13
### Added
- Robust version labels injected at runtime so they are always visible regardless of previous markup.

### Cosmetic
- Title spacing increased, with extra margin below the title.

### Integrity
- Kept tile logic and drag code untouched from the last known good build.
