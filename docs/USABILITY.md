# Usability and accessibility check (P18)

Checked against CLAUDE.md section 8 on 28 Sep 2026. Every page was rendered in headless Chrome at 360 px width in English, Hindi and Gujarati, and the source was scanned for the patterns below.

| Check | Result | Notes / fix |
|---|---|---|
| Hardcoded English strings | Pass | All UI text comes from `web/src/i18n/*.json`. Only example placeholders remain ("HP", "LED, Sodium" in the type builder). |
| Status shown by colour alone | Pass | `StatusBadge` always shows icon + colour + word. Charts and map have a legend of badges with numbers. |
| Touch targets ≥ 48 px | **Fixed** | 11 links were 40 px (`min-h-10`); all raised to 48 px. Public buttons are 56–64 px. |
| Text size | Pass | Staff body 16 px, public pages 18 px (`text-lg`) and larger. All sizes in rem, so they follow the phone's font setting. |
| Labels and aria-labels | Pass | Every input uses the shared `Field` component (visible `<label>`, hint and error linked with `aria-describedby`). Icon-only buttons have `aria-label`. |
| Keyboard and focus | Pass | Native buttons, links, selects and `<dialog>` (focus trap, Esc to close). 3 px amber focus ring on every element. "Skip to main content" link. |
| 360 px layout | Pass | No page scrolls sideways (checked automatically on every screenshot). Tables become cards on phones. |
| Technical words shown to users | Pass | Errors are translated by code; enum names never shown; "404" shown as "We couldn't find this asset…". |
| Bundle size | Pass | Public first load ~100 KB gzipped JS. Staff pages are lazy chunks; charts (105 KB) and map (45 KB) load only when opened. |
| Gujarati / Hindi review | **Open** | Drafted without a native speaker. Needs a native reader (see `_TODO` at the top of `hi.json` and `gu.json`). |

Known small gaps (not fixed, low impact): the icon picker's `aria-label` uses the English icon name; the Leaflet map itself is not screen-reader friendly (the asset list and nearby list are the accessible alternatives).
