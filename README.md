# Hizbul-Azam — v8

This package includes the complete Hizbul-Azam site.

## v8 additions
- Optional English translation on every daily reading page.
- Translation opens as a discreet side drawer on desktop and a bottom sheet on mobile, so the Arabic PDF remains the primary reading experience.
- The Arabic PDF is unchanged; translation is a separate content layer rather than a second PDF.
- English is extracted and cleaned from the user-supplied bilingual Hizbul-Azam edition.
- References contained in the supplied translation are retained where they can be cleanly identified.
- Translation files are cached with the site's offline content, so a saved day can be read with its English translation without internet access.
- Updated service-worker and asset cache versions.
- Existing light/dark mode and PDF.js dark-reading treatment are retained.

## Upload
Replace the contents of the existing GitHub Pages site with the contents of this folder, including `audio/`, `pdfs/`, `icons/`, and `translations/`.


Hizbul-Azam Translation v9 — UX fixes: translation control is present in the HTML (not injected only by JS), with explicit dark-mode styling for the translation control and playback-speed button. Asset/cache versions bumped to v9.
