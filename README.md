# WebDashboard

A fast, private, single-file start page for your browser.  Save and organize dozens of sites, search from multiple engines, and personalize the look without installing anything.  Everything runs locally.  Nothing is sent to a server unless you choose to open a site or use a search provider.

**Current baseline:** `v1.4.9`  
**Author:** Nilesh Ramrattan  
**Solution concept and implementation assisted by ChatGPT (OpenAI)**

---

## Why this exists

The default new-tab grid in most browsers is fixed and small.  That is limiting if you switch among many workspaces, clients, or projects.  WebDashboard gives you a clean, local, portable home page that behaves like a lightweight portal.  It stores your data in the browser, avoids accounts, and stays fast.

## What you get

- Single `index.html` you can open directly.  No build step.  
- Dozens of tiles with titles, descriptions, and groups.  
- Drag to reorder with smooth, Google-style swapping.  
- Compact search bars for Google, Bing, DuckDuckGo, and Perplexity.  
- Reliable icon fetching with graceful fallbacks.  
- Wallpaper modes: **Bing daily**, Unsplash keyword daily, static URL, local upload, or solid color.  
- Private by design using `localStorage`, plus export and import.  
- No external dependencies or frameworks.

## What is new in v1.4.9

- Added **Bing daily** wallpaper provider with simple market selection (for example `en-US`, `en-GB`, `fr-FR`).  
- First-run defaults to Bing daily so a background shows immediately.  
- The Settings footer shows the exact version label at runtime for clarity.

## Quick start

1. Download the latest release zip and extract it.  
2. Open `index.html` in your browser.  
3. Click **Add link** to create your first tiles.  
4. Optional: set this file as your browser’s startup or home page.

Tested on Chrome 141 and current Edge.  Core features also work in Safari and Firefox.

## Everyday use

- Edit the page title by clicking it.  Long titles are truncated with ellipses.  
- Use **Add link** to add a URL, title, optional description, and group.  
- Reorder by dragging.  The placeholder hops as you cross each neighbor’s midpoint.  
- Open a tile with a simple tap.  Any real drag will not open.  
- Use group pills to filter, then click again to return to All.  
- Open **Settings** to adjust columns, tile width, layout density, wallpaper, and more.

## Search bars

- Four compact providers: Google, Bing, DuckDuckGo, Perplexity.  
- Type a query and press Enter.  
- Mic and image buttons appear when your browser supports them.  
- The small AI icon can send the current query to Perplexity.

## Icons and logos

The app tries to show a square icon for each site in this order:

1. The site’s own favicon when available.  
2. A reputable favicon service as fallback.  
3. A clean monogram if nothing is found.  

You can paste a custom icon URL in the tile editor at any time.

## Wallpaper

Choose one of five modes in Settings:

- **Bing daily** (market code in “Image URL or keyword”, for example `en-US`).  
- Unsplash keyword daily using a theme like `mountains` or `cityscape`.  
- Static image URL.  
- Local upload stored as a data URL.  
- Solid color for a distraction-free look.

## Data model and privacy

- All data is stored in `localStorage` under three keys for links, settings, and icon cache.  
- Use **Export** to save a JSON backup.  Use **Import** to restore.  
- No analytics.  No network calls except opening your links, fetching icons, or wallpaper when you enable it.

## Keyboard shortcuts

- `/` focuses Google.  
- `b` focuses Bing.  
- `d` focuses DuckDuckGo.  
- `p` focuses Perplexity.  
- `Enter` submits the active bar.  
- `Esc` closes dialogs.

## Performance notes

- The grid comfortably handles dozens of tiles.  
- For very large collections, set **Maximum tiles to show** in Settings for smoother scrolling.  
- Icon results are cached locally.  Use the tile menu to refresh an icon if it changes.

## Troubleshooting

**Tiles vanished or buttons stopped working.**  
Replace `index.html` with a known good release and hard refresh with `Ctrl+F5`.  A partial edit can stop `render()` from running.

**A tile opens when I try to drag it.**  
The page treats tiny motions as a tap.  Any real drag will not open.

**Version label missing in Settings.**  
Hard refresh the page.  The version appears in the Settings footer at runtime.

## Repository structure

This project ships as a single file by design.  Optional support files:

- `README.md`  Overview and usage.  
- `CHANGELOG.md`  Release notes.  
- `BASELINE.md`  Pinned snapshot notes.  
- `Archive/`  Older zips you do not want Git to track.
