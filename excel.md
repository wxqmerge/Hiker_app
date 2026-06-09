# Hike TSV Import Format Specification

This format mirrors a single trail sheet from `Hike Data BaseM.xls`. Each trail has its own sheet with data laid out in specific rows and columns. The TSV exports this as a 2-column `Label \t Value` table.

## File Format

- **Encoding**: UTF-8
- **Line endings**: `\n` (LF)
- **Field separator**: `\t` (tab, U+0009)
- **Escaping**: literal tabs, newlines, and backslashes in values must be escaped:
  - `\` → `\\`
  - tab → `\t`
  - newline → `\n`

## Source: Excel Sheet Cell Layout

The TSV labels correspond to these exact cell positions on an individual trail sheet:

```
  A                          B                    C    D                F               G                H    I
0 Trail Name
1
2 Miles                    Distance              0    Distance Extended  Elevation      Elevation Start  0    Elevation Max
3 0                        Parking                                           Season     Best Season
4 0                        Difficulty                                        Range      Range
5 General Information
6 Description (spans multiple rows if needed)
7
8
9
10
11
12
13 Pros                   Pros text
14
15
16 Other                  Other text
17
18
19 Leaders                Leader names (comma-separated)
```

Monthly availability (Jan–Dec) is derived from the Index sheet quarterly markers and included in the TSV for completeness.

## TSV Row Specification

Every row has exactly one tab separating the label from the value. Lines without a tab are ignored.

| # | Label | Excel Cell | Required | Type | Description |
|---|-------|------------|----------|------|-------------|
| 1 | `Label` | — | — | — | Header row (skipped on import) |
| 2 | `Trail Name` | A0 | **yes** | string | Full trail name (must be non-empty) |
| 3 | `Distance` | B2 | no | number | Base trail distance in miles |
| 4 | `Distance Extended` | D2 | no | number | Extended route distance in miles |
| 5 | `Elevation Start` | G2 | no | integer | Starting elevation in feet |
| 6 | `Elevation Max` | I2 | no | integer | Maximum elevation in feet |
| 7 | `Parking` | B3 | no | string | Parking pass: `Discover`, `Nat'l Park/Golden`, `NW Forest/Golden`, `Am Beau/Golden`, `N/A`, or empty |
| 8 | `Best Season` | G3 | no | string | Preferred season. Normalized on import (e.g., `Spring/Summer` → `Spring / Summer`) |
| 9 | `Difficulty` | B4 | no | enum | `Easy`, `Easy to Mod`, `Moderate`, `Mod to Diff`, `Difficult`. Defaults to `Unknown` |
| 10 | `Range` | G4 | no | integer | Distance from parking lot in minutes (ride cost calculation) |
| 11 | `Jan` | Index | no | flag | Non-empty = available in January |
| 12 | `Feb` | Index | no | flag | Non-empty = available in February |
| 13 | `Mar` | Index | no | flag | Non-empty = available in March |
| 14 | `Apr` | Index | no | flag | Non-empty = available in April |
| 15 | `May` | Index | no | flag | Non-empty = available in May |
| 16 | `Jun` | Index | no | flag | Non-empty = available in June |
| 17 | `Jul` | Index | no | flag | Non-empty = available in July |
| 18 | `Aug` | Index | no | flag | Non-empty = available in August |
| 19 | `Sep` | Index | no | flag | Non-empty = available in September |
| 20 | `Oct` | Index | no | flag | Non-empty = available in October |
| 21 | `Nov` | Index | no | flag | Non-empty = available in November |
| 22 | `Dec` | Index | no | flag | Non-empty = available in December |
| 23 | `Description` | A6 | no | string | Full trail description (from "General Information" section). Escape `\n` for multi-line |
| 24 | `Pros` | B13 | no | string | Planner notes about trail pros |
| 25 | `Other` | B16 | no | string | Additional info (parking tips, warnings, facilities) |
| 26 | `Leaders` | B19 | no | string | Comma-separated trail leader names |
| 27 | `Alternate Names` | — | no | string | Comma-separated alternate names for schedule matching |

## Complete Example

```
Label	Value
Trail Name	Anderson Lake State Park
Distance	5
Distance Extended	7.1
Elevation Start	250
Elevation Max	600
Parking	Discover
Best Season	Any
Difficulty	Easy to Mod
Range	30
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
