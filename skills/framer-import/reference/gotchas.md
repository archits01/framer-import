# FramerExport gotchas & the fixes this skill applies

FramerExport (`github.com/danbenba/FramerExport`) is a good single-page mirror
tool, but it does **not** produce a working multi-page site out of the box. These
are the real failure modes and how `clone-framer.mjs` handles each.

## 1. One run exports ONE page

`npm run dev -- <url>` captures only that URL. The homepage export has only the
homepage's assets — `/pricing`'s unique images aren't downloaded.

**Fix:** export **each route individually** (`ORIGIN + route` per page). Every
run localizes that page's own assets. We then merge all asset folders — Framer
uses **content-hashed filenames**, so identical files have identical names and
merging is collision-free (dedupe by filename).

## 2. `--subpages` is half-baked (CDN-linked + unrouted)

The `--subpages` flag crawls internal links and saves `subpages/<slug>.html`, but:
- those HTML files still reference `framerusercontent.com` / `framer.com/edit`
  (assets NOT localized, editor bootstrap NOT stripped), and
- nothing routes `/pricing` → `subpages/pricing.html`. The bundled `serve.js`
  only does an SPA-fallback to `index.html`, so **`/pricing` serves the
  homepage** (and Framer's client router throws a hydration error #405).

**Fix:** don't use `--subpages` for the real build. Use it only (optionally) to
*discover* the link list; export each discovered route individually through the
full pipeline.

## 3. Relative asset paths break on nested routes

Exported HTML references assets relatively (`href="assets/..."`, nav `href="./x"`).
A page served at `/legal/privacy-policy` then resolves `assets/...` against
`/legal/`, → **404s**. The browser resolves relative URLs from the address-bar
path, not the file location, so physically moving files doesn't help.

**Fix:** inject `<base href="/">` into every page's `<head>`. Now all relative
asset refs AND `./route` nav links resolve from root regardless of URL depth —
one line, no brittle path rewriting. (Caveat: `<base>` also rewrites bare `#frag`
anchors to `/#frag`; Framer nav is JS-driven so this is a non-issue in practice.)

## 4. The `/404` route can't be exported normally

`/404` returns HTTP **404**, so the exporter's SSR fetch bails and never writes
`index.html`.

**Fix:** capture `/404` with puppeteer (render the DOM even on a 404 status),
remove the injected editor UI (`#__framer-editorbar`, `iframe[src*=framer.com/edit]`)
**in-browser before serializing**, localize its CDN asset refs against the merged
pool (download any missing), inject `<base>`, and also merge whatever module graph
the tool *did* download into `_ex/notfound/` (it downloads assets before failing
on the HTML write) so intra-module imports resolve.

## 5. Editor / badge / tracking leftovers

Raw puppeteer captures (used for the 404) bake in Framer's on-page **editor
pencil** and badge. Strip, before serialize:
`[id^="__framer-editorbar"], #__framer-badge-container,
iframe[src*="framer.com/edit"], script[src*="framer.com/edit"],
script[src*="events.framer.com"]`. The tool's normal pipeline already strips
these for regularly-exported pages — it's only the hand-captured 404 that needs it.

## 6. Verify by rendering, not by HTTP status

`curl /pricing` returns 200 even when it's serving the homepage fallback. The
only trustworthy check is a **headless render** asserting (a) the page's `h1`/text
differs from the homepage and (b) **zero failed requests**. That's what
`verify.mjs` does — treat a green run there as the gate before deploying.

## 7. Sandboxes block puppeteer's Chromium download

`npm install` may skip puppeteer's postinstall (Chromium). Check
`~/.cache/puppeteer/chrome/...`; a matching build is often already cached. If not,
`npx puppeteer browsers install chrome`. Puppeteer's `executablePath()` must
point at an existing binary before any capture step will work.
