# Hike TSV Import Format Specification

A tab-separated values file with exactly **2 columns** and **28 rows** (1 header + 27 data rows). Each row is a `Label\tValue` pair.

## File Format

- **Encoding**: UTF-8
- **Line endings**: `\n` (LF)
- **Field separator**: `\t` (tab, U+0009)
- **Escaping**: literal tabs, newlines, and backslashes in values must be escaped:
  - `\` → `\\`
  - tab → `\t`
  - newline → `\n`

## Row Specification

Every row must have exactly one tab character separating the label from the value. Lines without a tab are ignored.

| # | Label | Value | Required | Type | Description |
|---|-------|-------|----------|------|-------------|
| 1 | `Label` | `Value` | — | — | Header row (skipped on import) |
| 2 | `Trail Name` | `Anderson Lake State Park` | **yes** | string | Full trail name (must be non-empty) |
| 3 | `Short Name` | `And_Lk_TR` | no | string | Short/abbreviated name. Falls back to `Trail Name` if empty |
| 4 | `Distance` | `5` | no | number | Base trail distance in miles |
| 5 | `Distance Extended` | `7.1` | no | number | Extended route distance in miles |
| 6 | `Elevation Start` | `250` | no | integer | Starting elevation in feet |
| 7 | `Elevation Max` | `600` | no | integer | Maximum elevation in feet |
| 8 | `Difficulty` | `Easy to Mod` | no | enum | One of: `Easy`, `Easy to Mod`, `Moderate`, `Mod to Diff`, `Difficult`. Defaults to `Unknown` |
| 9 | `Parking` | `Discover` | no | enum | Parking pass required: `Discover`, `Nat'l Park/Golden`, `NW Forest/Golden`, `Am Beau/Golden`, `N/A`, or empty |
| 10 | `Range` | `30` | no | integer | Distance from parking lot in minutes (used for ride cost) |
| 11 | `Best Season` | `Spring / Summer` | no | string | Preferred season. Values are normalized (e.g., `Spring/Summer` → `Spring / Summer`) |
| 12 | `Jan` | `Y` | no | flag | Put any non-empty value to mark January as available |
| 13 | `Feb` | `` | no | flag | Put any non-empty value to mark February as available |
| 14 | `Mar` | `Y` | no | flag | Put any non-empty value to mark March as available |
| 15 | `Apr` | `Y` | no | flag | Put any non-empty value to mark April as available |
| 16 | `May` | `` | no | flag | Put any non-empty value to mark May as available |
| 17 | `Jun` | `` | no | flag | Put any non-empty value to mark June as available |
| 18 | `Jul` | `` | no | flag | Put any non-empty value to mark July as available |
| 19 | `Aug` | `` | no | flag | Put any non-empty value to mark August as available |
| 20 | `Sep` | `` | no | flag | Put any non-empty value to mark September as available |
| 21 | `Oct` | `` | no | flag | Put any non-empty value to mark October as available |
| 22 | `Nov` | `` | no | flag | Put any non-empty value to mark November as available |
| 23 | `Dec` | `Y` | no | flag | Put any non-empty value to mark December as available |
| 24 | `Description` | `Head to the Tamanowas Rock Sanctuary...` | no | string | Full trail description (multi-line content must escape `\n`) |
| 25 | `Pros` | `Sacred, interesting rocks.` | no | string | Planner notes about trail pros |
| 26 | `Other` | `Usually a Wed. hike.` | no | string | Additional info (parking tips, facilities, warnings) |
| 27 | `Leaders` | `Matt, Pat` | no | string | Comma-separated list of regular trail leader names |
| 28 | `Alternate Names` | `AndLkODT, Anderson DNR` | no | string | Comma-separated alternate names for schedule matching |

## Complete Example

```
Label	Value
Trail Name	Anderson Lake State Park
Short Name	And_Lk_TR
Distance	5
Distance Extended	7.1
Elevation Start	250
Elevation Max	600
Difficulty	Easy to Mod
Parking	Discover
Range	30
Best Season	Spring/Summer/Winter
Jan	Y
Feb	Y
Mar	Y
Apr	Y
May	Y
Jun	Y
Jul	Y
Aug	Y
Sep	Y
Oct	Y
Nov	Y
Dec	Y
Description	Head to the Tamanowas Rock Sanctuary (Sacred Rock) via Split Rock from the Savage Memorial Trail, Cascade Trail, and San Juan Trail, on the west side of the lake.  Many possible loops in this state park.
Pros	Sacred, interesting rocks.  The other one off of the Cascade Trail is called:  Peregrine Rock, the largest erratic rock in Jefferson County?
Other	Usually a Wed. hike.  Slot rock is the 1st trail past the Priv. Property sign.
Leaders	Matt, Pat
Alternate Names	AndLkODT
```

## Import Behavior

- If a trail with the same `Trail Name` already exists, the importer prompts to **update**, create a **new** copy, or **cancel**
- `notes` is auto-populated as the first 200 characters of `Trail Name`
- `difficultyOrder` is computed automatically from `Difficulty`
- `availableMonths` is built from whichever month fields have non-empty values, stored as 1-indexed month numbers
