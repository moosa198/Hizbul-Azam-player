# Hizbul-Azam — UX audio progress update

This version fixes the desktop audio player so the progress track, current time, duration, and seek control are visible and functional.

## Desktop audio controls
- Play / pause
- Visible progress track with moving position indicator
- Current time / total duration
- Click or drag the progress track to seek
- 1× / 1.5× / 2× speed control

## Mobile
Mobile keeps the compact native audio player and the separate speed button.

## GitHub Pages
Upload/replace the files in this package in the repository root. Keep the `audio/`, `pdfs/`, and `icons/` folders in place.

The day pages use versioned CSS/JS URLs and the service-worker cache version has been bumped so the updated player is not trapped behind the older cached assets.
