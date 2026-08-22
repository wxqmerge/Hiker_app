# deepseek.md — UI Cohesion & UX Improvement Plan

This app was built incrementally (browse → detail → manager → schedule), so the UI
feels disjointed: each page solved its problem in isolation and then the codebase
diverged. This document lists **actionable, file-referenced suggestions** to make
the interface feel like one product instead of four different apps.

The unifying goal: **one visual language, one feedback model, one navigation story,
and no duplicated logic.** Each suggestion is self-contained and ordered by effort.

---

## 0. Quick wins (low effort, high impact)

1. **Stop using browser `alert()` / `confirm()` / `prompt()`.**
   There are **72 native-dialog call sites** in production code, while a proper
   `Toast` system already exists (`src/components/Toast.jsx`, `src/hooks/useToast.js`)
   but is only used ~10 places. Native dialogs block the browser, look broken on
   mobile, and are the single biggest "this app was built in stages" signal.
   - Replace informative `alert()` → `showToast(msg, 'success' | 'error')`.
   - Replace destructive `confirm()` → a shared `<ConfirmDialog>` modal (you already
     have a modal pattern in `src/components/SwapConfirmationModal.jsx` to model it on).
   - Replace `prompt()` for leader names (`src/utils/scheduleActions.js:7`) and new
     trail names (`src/pages/TrailManager.jsx:154`) with small inline edit forms.
   - Files: `src/pages/Calendar.jsx:67`, `src/pages/ScheduleBuilder.jsx` (~25 sites),
     `src/pages/TrailManager.jsx` (~40 sites), `src/utils/scheduleActions.js`.

2. **Stop hardcoding the year `2026`.** It appears in 9+ production files and will
   silently break every page in January.
   - Add `export const CURRENT_YEAR = new Date().getFullYear()` in
     `src/utils/constants.js` and replace all of these:
     `src/pages/Calendar.jsx:24`, `src/pages/ScheduleBuilder.jsx:118`,
     `src/components/MonthSelector.jsx:9`, `src/components/DaySelector.jsx:4`,
     `src/components/Layout.jsx:57`, `src/hooks/useDayWeather.js:8`,
     `src/hooks/useScheduleWeather.js:8`, `src/hooks/useNextHike.js:14`.
   - Caveat: season boundaries (Wed/Fri-of-2026) are real schedule data, so keep the
     hike-year configurable via `/api/config` (server is the source of truth) rather
     than only replacing with `new Date().getFullYear()`.

3. **Remove production debug logging.**
   `src/pages/ScheduleBuilder.jsx` calls `console.clear()` on every search change
   (`debugLogSearchChange`, lines 39–54, 199–203) and logs save payloads. This pollutes
   the console for every user. Gate behind the existing `debugMode` flag or delete it.

4. **Delete dead/confusing state.** `isSaving` in `ScheduleBuilder.jsx:64` is set but
   never rendered (`// eslint-disable-line no-unused-vars`) — the user gets **zero
   feedback** that a schedule is saving. Either render it (see §8) or remove it.

---

## 1. One visual design language

The app mixes at least three "skins":

| Where | Look | Inconsistent with |
|---|---|---|
| `NextHikeBanner.jsx` | Full-bleed green gradient, huge white buttons, `text-3xl` | every other page (flat white/gray, small green accents) |
| `TrailManager.jsx` | Dense data table | card-based pages |
| `TrailDetail.jsx` | Hero header + stat tiles | list/card pages |

Suggestions:

1. **Extract shared primitives** under `src/components/ui/` and use them everywhere:
   - `Button` (variants: primary / ghost / danger / icon-only), `Card`, `Badge`,
     `Modal`, `EmptyState`, `Select`, `FieldLabel`, `Spinner`.
   - Today the same button markup (`px-3 py-1.5 rounded-lg text-sm ... hover:bg-*`)
     is copy-pasted across every file, and each page styles "pills" slightly
     differently (`PillButton.jsx` vs inline `px-2.5 py-1 rounded-md` in
     `TrailManager.jsx:572` vs inline month buttons in `FilterPanel.jsx:141`).
   - `FilterPanel.jsx`, `ScheduleBuilder.jsx`, and `TrailManager.jsx` are the best
     candidates to convert first since they share the most controls.

2. **Harmonize the `NextHikeBanner`** (§1 above): keep it visually special, but reuse
   the shared `TrailStats`, `TrailActionButtons`, and `Button` primitives and drop the
   custom `btnClass` (lines 56, 100–110). It currently re-implements a whole card.

3. **Standardize the "green = primary" palette.** Green is used for: primary actions,
   active filters, success toasts, *and* scheduled-hike cards. That makes "is this
   interactive or just highlighted?" ambiguous. Suggest:
   - Green = primary/interactive accent only (buttons, links, active state).
   - Scheduled/assigned = blue or a distinct tint.
   - Danger (delete, clear) = red (already mostly consistent).
   - Early start = orange (already consistent — keep it).

4. **Unify icon usage.** Several hand-rolled SVGs duplicate each other (e.g. the
   pencil/edit icon appears in `TrailDetail.jsx`, `TrailManager.jsx`, `TrailCard.jsx`).
   Add one tiny `Icon` component wrapping the inline SVGs so stroke-width/size are
   consistent.

---

## 2. Navigation & header (currently fragile)

`src/components/Layout.jsx` header crams nav + month selector + day selector + gear +
group name into one `flex items-center justify-between` row (lines 67–111).

1. **Make the header responsive.** Today on a phone it will overflow. Add:
   - A hamburger/collapsible nav for `sm` and below (or a horizontal-scroll nav row).
   - Move `MonthSelector` + `DaySelector` into the page body instead of the header;
     they belong to the content, not the chrome.
2. **One month picker.** Month selection currently lives in the header dropdown
   (`MonthSelector.jsx`) *and* appears again inside the ScheduleBuilder right panel.
   Pick one source of truth for month and keep the other as a display.
3. **Rename nav labels for clarity** (`constants.js` `NAV_LINKS`):
   `Calendar` → "Schedule", `Browse Trails` → "Hikes", `Trail Manager` → "Manage",
   `Schedule Builder` → "Plan". And make the active tab visually obvious (the current
   `text-sm` vs `text-lg` jump is jarring and re-flows the nav).
4. **Fix route/docs mismatch**: `src/App.jsx:94` maps `/` → `Calendar`, but
   `README.md:183` and `USAGE.md:213` say `/` is Browse Trails. Align code and docs.
5. **Unify trail navigation behavior.** `TrailCard.jsx:68-74` opens trail detail in a
   **new tab** (`target="_blank"`), while `TrailManager`/`ScheduledCards`/`NextHikeBanner`
   navigate in-place. Pick one (recommend in-app navigation; keep new-tab only for
   external links like AllTrails/NOAA).

---

## 3. Feedback & loading states (the app feels "mute")

1. **Persistent save indicator.** `ScheduleBuilder` autosaves (debounced 1s, line 107).
   There is no "Saved"/"Saving…" indicator. Render `isSaving` as a small status pill in
   the header and show a success toast when a save completes.
2. **Polling flicker.** `useSchedulePolling({ setSchedule }, 5000)` runs in both
   `Calendar.jsx:44` and `ScheduleBuilder.jsx:78`. When the server data changes, both
   pages re-render and can override a user's in-progress drag/drop. Consider:
   - One shared polling hook instance.
   - Pause polling while a drag is active or the user is mid-edit.
3. **Weather fetching feedback.** `fetchWeatherForAll` (`ScheduleBuilder.jsx:308`)
   shows only a final `alert`. Show a progress bar/toast ("Fetching 3/18…") instead.
4. **Empty states.** Standardize via a shared `EmptyState` component:
   - `ScheduledCards.jsx:68` ("No hikes assigned…") is plain text; give it the icon +
   - guidance treatment used in `TrailList.jsx:6` and `ScheduleBuilder.jsx:963`.

---

## 4. TrailCard is overloaded (core surface)

`src/components/TrailCard.jsx` renders ~9 pieces of data plus weather, tide, leader,
popularity badge, action buttons, and a Report footer — and wraps the *entire card* in
an `<a href target="_blank">` (lines 68–74). Consequences:
- Clicking anywhere on the card navigates, so it's hard to drag/select text.
- Nested interactive elements inside an anchor is fragile (they work around it with
  `onClick stopPropagation` everywhere).

Suggestions:
1. Make the **title** the only link; keep the body non-interactive.
2. **Progressive disclosure**: show distance/elevation/difficulty on the card; move
   parking, ride cost, seasonal months, and full description behind an expandable
   chevron or into the detail page.
3. **Explain the popularity badge.** The blue circle with a 0–9 number (lines 183–190)
   is cryptic. Add a small "Pop" label or a legend, and make the tooltip text the
   formula (it already exists: `Quarter + Month + Schedule`).
4. **One Report button style** and one "copy/name" affordance; `handleCopy` and
   `handleCopyName` are two near-identical concepts.

---

## 5. FilterPanel is a wall of controls

`src/components/FilterPanel.jsx` puts search + 2 dual sliders + 5 difficulty pills +
6 sort pills + wilderness + GPX pills + Tide pills + 12 month buttons + reset into one
wrapping row (lines 67–166). On narrow widths it becomes an unordered pile.

1. **Group by section** with labels: Search / Difficulty / Distance & Elevation /
   Months / Availability (GPX, Tide, Wilderness) / Sort.
2. **Collapse "advanced" filters** (tide, GPX, wilderness, sort) behind an "More" /
   "Sort" popover; keep search + difficulty + months always visible.
3. **Live result count** already exists ("N of M trails") — make it sticky and include
   it in the collapse header so it's visible even when filters are collapsed.
4. **Reset** currently sits at the tail of a wrapping flex row (lines 157–165); give it
   a fixed position in the panel header next to the count.

---

## 6. Schedule Builder: two inconsistent "gears"

The Schedule Builder (`ScheduleBuilder.jsx`) and Trail Manager (`TrailManager.jsx`)
each have their own dropdown of overlapping admin/import/export actions
(`ScheduleSettingsDropdown.jsx` vs `AdminMenu` in `TrailManager.jsx:18`). They even
share a "Reload Schedule" action duplicated in both.

1. **Consolidate** import/export/validate/clear actions into one shared
   `AdminDropdown` component parameterized by which actions apply to the current page.
2. **Use the `ScheduleSettingsContext` for all of it** instead of two bespoke
   `useState` menus (`showSettings` in ScheduleBuilder, `open` in TrailManager).

---

## 7. Accessibility & polish pass

1. **`aria-label` on icon-only buttons.** There are dozens of SVG-only buttons whose
   only text is a `title` (e.g. `TrailCard.jsx:78`, `ScheduleBuilder.jsx:1100+`,
   `TrailManager.jsx:655-686`). Add `aria-label` matching the `title`.
2. **Focus states.** Most interactive elements only style `hover`; add visible
   `focus-visible:` rings (Tailwind 4 makes this cheap).
3. **Keyboard support for drag-and-drop.** The whole schedule is HTML5 DnD
   (`useScheduleDragDrop.js`) — inaccessible to keyboard users. At minimum add
   "Swap" buttons beside each scheduled hike (reuse `removeHike`/swap modal) as a
   keyboard fallback. This is also a good mobile fallback since HTML5 DnD doesn't
   work on touch.
4. **Color contrast on difficulty badges** (`DIFFICULTY_COLORS` in `constants.js:32`)
   — `bg-lime-200`, `bg-yellow-200` with light text on some are borderline.
5. **Reduced motion**: the `hover:shadow-md transition-all` on cards and rotating
   chevrons could respect `prefers-reduced-motion`.

---

## 8. Consistency checklists (mechanical, easy wins)

These are grep-able one-by-one fixes:

- [ ] Replace all 72 `alert/confirm/prompt` sites (§0.1).
- [ ] Replace all 9+ hardcoded `2026` (§0.2).
- [ ] `aria-label` on every icon-only button (§7.1).
- [ ] Single `CURRENT_YEAR` constant (§0.2).
- [ ] Single source of truth for the API base: `getApiBase()` / `request()` are used
      everywhere already — good. Keep it that way; don't hardcode `/api/`.
- [ ] Remove `debugLog*` calls in `ScheduleBuilder.jsx` (§0.3).
- [ ] Align route labels in `README.md`/`USAGE.md` with `src/App.jsx` (§2.4).

---

## Suggested order of implementation

| Phase | Scope | Effort | Biggest payoff |
|---|---|---|---|
| 1 | Kill native dialogs, add save indicator, remove debug logging, hardcoded year | S | Feels polished immediately; kills "staged" smell |
| 2 | Shared `ui/` primitives + convert `FilterPanel`, header buttons, TrailManager controls | M | One visual language |
| 3 | Declutter `TrailCard`, harmonize `NextHikeBanner`, unify nav behavior | M | Core surface becomes usable |
| 4 | Responsive header, consolidate admin menus, drag-and-drop keyboard fallback | L | Works on mobile + accessible |
| 5 | Polling pause, weather progress, empty-state polish | M | Trust in the save pipeline |

Start with Phase 1 — it touches every page, is low risk (mostly swapping feedback
mechanisms), and immediately reads as "one product."

---

## Files most central to the work

| File | Role |
|---|---|
| `src/components/Layout.jsx` | Header/nav, month/day pickers — §2 |
| `src/components/TrailCard.jsx` | Core card surface — §4 |
| `src/components/FilterPanel.jsx` | Shared filters — §5 |
| `src/pages/ScheduleBuilder.jsx` | Schedule builder (largest page) — §0, §3, §6 |
| `src/pages/TrailManager.jsx` | Admin table — §6, §1 |
| `src/pages/Calendar.jsx` | Schedule calendar — §0, §3 |
| `src/components/SwapConfirmationModal.jsx` | Model for a shared ConfirmDialog — §0.1 |
| `src/components/Toast.jsx` + `src/hooks/useToast.js` | Existing toast system to extend — §0.1, §3 |
| `src/utils/constants.js` | `CURRENT_YEAR`, `NAV_LINKS`, palette — §0.2, §2 |
