# Aria-label review

I added `aria-label`, `aria-pressed`, `aria-expanded`, `aria-live`, `role`, and decorative `aria-hidden` attributes to interactive and visually-encoded controls.

Every label below could be inferred from surrounding context, so no labels required user input. The controls listed here were the ambiguous ones because their visible text is an icon, abbreviation, or generic phrase.

| Control | File | Label added | Why it was ambiguous |
|---|---|---|---|
| Settings gear button | `src/components/ScheduleSettingsDropdown.jsx` | `Schedule settings` | Icon-only button. |
| Copy trail name button | `src/components/TrailCard.jsx` | `Copy {trail} name` / `{trail} name copied` | Icon-only button. |
| Popularity score circle | `src/components/TrailCard.jsx` | `Popularity score: {score}` | A bare number in a colored circle. |
| Weather link on trail card | `src/components/TrailCard.jsx` | `Forecast for {trail}: {temp}°F, {rain}% rain` | Icon plus short numeric text. |
| Tide link on trail card | `src/components/TrailCard.jsx` | `Low tide for {trail} at {time}: {height} ft` | Icon plus short numeric text. |
| `TH` button | `src/components/shared/TrailActionButtons.jsx` | `Open trailhead for {trail} in Google Maps` | Two-letter abbreviation. |
| `W` button | `src/components/shared/TrailActionButtons.jsx` | `Open weather forecast for {trail}` | Single-letter abbreviation. |
| `GPX` / `Share` buttons | `src/components/shared/TrailActionButtons.jsx` | `Download GPX for {trail}` / `Share GPX for {trail}` | Visible text does not identify the trail. |
| Wilderness pill `◆` | `src/components/FilterPanel.jsx` | `Filter wilderness trails` | Symbol-only pill. |
| Non-wilderness pill `◆ off` | `src/components/FilterPanel.jsx` | `Sort non-wilderness trails first` | Symbol plus terse text. |
| Distance/elevation sliders | `src/components/DualRangeSlider.jsx` | `Trail distance range in miles` / `Trail elevation range in feet` | Visible labels are only `Dist` and `Elev`. |
| Month filter buttons | `src/components/FilterPanel.jsx` | `Toggle {month} filter` | Buttons show abbreviated month names only. |
| `ES` checkbox | `src/pages/ScheduleBuilder.jsx` | `Toggle early start` | Two-letter abbreviation. |
| GPX/trailhead/tide/web/remove icon buttons | `src/pages/ScheduleBuilder.jsx` | Trail-specific action labels | Icon-only buttons. |
| Early-start badge | `src/components/ScheduledCards.jsx` | `Early start` | Emoji-only badge. |
| `Dup` button | `src/pages/TrailDetail.jsx` | `Duplicate this trail as a new entry` | Three-letter abbreviation. |
| `Del` button | `src/pages/TrailDetail.jsx` | `Delete this trail` | Three-letter abbreviation. |
| `TSV` / `HTML` export buttons | `src/pages/TrailDetail.jsx` | `Export this hike as TSV` / `Export this trail as HTML` | File-format text does not say the action applies to the current trail. |
| `Get Maps` link | `src/components/GPXHelp.jsx` | `Get a maps app for GPX files` | Generic link text. |
| Monthly score cells | `src/components/MonthlyScoreGrid.jsx` | `{month}: {hikes} hikes -> score {score}` | Small colored cells rely on `title` text. |
| Year/month/day selects | `src/components/Selector.jsx` | `Select year` / `Select month` / `Select day` | Native selects had only `title`, which is not a reliable accessible name. |
