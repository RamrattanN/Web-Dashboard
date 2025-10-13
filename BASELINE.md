# Baseline definition  v1.2.1

**Scope.** This baseline captures `index.html` plus minimal docs and ignore rules.  Functionally identical to v1.2.1 delivered above.  

**Supported.** Chrome 141 on Windows and macOS at 100 percent zoom.  

**Non goals.** No service worker, no build step, no external dependencies.  

**Regression checklist.**
- Tiles open in a new tab on single click.  
- Tiles can be reordered across rows with pointer drag.  
- Group filter does not misplace drops.  
- Settings persist in `localStorage`.  
- Import and Export work and preserve order, groups, icons, and wallpaper.  

**Tag.** `baseline-v1.2.1`.
