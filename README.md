# Hizbul-Azam — v10

Complete GitHub Pages / PWA package for the Hizbul-Azam daily reading and listening experience.

## v10 UX improvements
- Arabic remains the primary reading experience.
- English translation is opened from the fixed audio bar, so it remains available throughout long PDF reading on mobile and desktop.
- Translation opens as a side drawer on desktop and a bottom sheet on mobile.
- Translation preserves its own reading position for each day instead of repeatedly returning to the top.
- The drawer shows the current Arabic PDF page as reading context.
- Translation does not replace or split the Arabic PDF into a permanent two-column view.
- Dark mode, PDF.js rendering, custom audio progress, playback speed, offline saving and existing day navigation are retained.
- PWA install flow is hardened: stable manifest id, explicit GitHub Pages scope/start URL, cache-busted icons/assets, service-worker cache v10, and a manual installation fallback when `beforeinstallprompt` is unavailable.
- Service worker registration uses `updateViaCache: none` and its precache list matches the v10 assets.
- New cache-busted app icons use the v2 icon files.

## Upload
Replace the contents of the existing GitHub Pages repository with the contents of this folder. Keep `audio/`, `pdfs/`, `icons/`, and `translations/` together with the HTML, CSS, JS, manifest and service worker files.
