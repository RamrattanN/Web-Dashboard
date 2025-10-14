# CHANGELOG

## v1.5.0 — 2025-10-13

### Changed
- Version constant updated to `v1.5.0` and wired to visible labels so the Settings footer stays correct.

### Fixed
- Hardened Bing daily wallpaper.  Fetch the metadata, preload the image, then apply only on success.  Previous background is kept on failure.
