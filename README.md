# WebDashboard

A fast, private, single-file start page for your browser.  Save and organize dozens of sites, search from multiple engines, and personalize the look without installing anything.  Everything runs locally.  Nothing is sent to a server unless you choose to open a site or use a search provider.

**Current baseline:** `v1.5.0`  
**Author:** Nilesh Ramrattan  
**Solution concept and implementation assisted by ChatGPT (OpenAI)**

## Highlights

- Single `index.html` you can open directly.  No build step.  
- Smooth drag and drop with Google-like tile swapping.  
- Four compact search bars.  
- Multiple wallpaper modes, including Bing daily.  
- Private by design using localStorage with Export and Import.

## v1.5.0

- Bumped the version constant to `v1.5.0` and ensured the Settings footer always reflects the active version.  
- Bing daily wallpaper path hardened.  The page fetches Bing JSON, preloads the image, and only swaps after a successful load.  Failures preserve the previous wallpaper.

