# Hike Database - Field Reference Documentation

This document describes all fields exported from the "Hike Data Base.xls" Excel file using pandas-based extraction.

---

## Table of Contents

1. [trails.json](#trailsjson) - Main trail database
2. [lookup.json](#lookupjson) - Reference/lookup data
3. [trail_details.json](#trail_detailsjson) - Extended trail information
4. [Source Field Mapping](#source-field-mapping) - Excel to JSON field mapping

---

## trails.json

**Purpose:** Main database containing all 178 trail records.

**Structure:** `"trails": [ {trail_object}, ... ]`

### Top-Level Fields

| Field | Type | Description | Example | Source |
|-------|------|-------------|---------|--------|
| `id` | string | URL-friendly unique identifier (slug) | `"360-rd"` | Generated |
| `name` | string | Short trail name/abbreviation | `"360 Rd"` | Index:S |
| `fullName` | string | Full trail description/name from notes | `"360 Road/Lookout Hill Rd..."` | Index:A |
| `distance` | number | Base trail distance in miles | `5.5` | Index:B |
| `distanceExtended` | number|null | Extended route distance in miles | `6.0` | Index:C |
| `elevationStart` | integer | Starting elevation in feet | `575` | Index:D |
| `elevationMax` | integer|null | Maximum elevation reached in feet | `934` | Index:E |
| `difficulty` | string | Trail difficulty rating | `"Easy"` | Index:R |
| `parking` | string | Parking information | `"Discover"` | Trail Sheet:B4 |
| `range` | string|null | Range identifier number | `"76"` | Trail Sheet:G5 |
| `notes` | string | Trail highlights, warnings, key notes (truncated to 200 chars) | `"360 Road/Lookout Hill Rd..."` | Index:A |
| `seasonal` | object | Seasonal availability information | See below | Index:H,O |
| `difficultyOrder` | integer | Numeric sort order for difficulty (1=Easiest, 5=Hardest) | `1` | Generated |

### `seasonal` Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `availableMonths` | number[] | Array of month indices (0=January through 11=December) when trail is available | `[3, 4, 5]` = April, May, June |
| `bestSeason` | string | Preferred season for hiking (often empty) | `""` or `"Fall"` |

### Difficulty Levels

| Value | Order | Description |
|-------|-------|-------------|
| `"Easy"` | 1 | Flat/minimal elevation change, beginner-friendly |
| `"Easy to Mod"` | 2 | Easy with some moderate sections |
| `"Moderate"` | 3 | Intermediate difficulty |
| `"Mod to Diff"` | 4 | Moderate with difficult sections |
| `"Difficult"` | 5 | Advanced hikers only, steep grades |

### Parking Values

| Value | Description |
|-------|-------------|
| `"Discover"` | Discover Pass required |
| `"Nat'l Park/Golden"` | National Park entry or Golden Hawk Pass |
| `"NW Forest/Golden"` | Northwest Forest Pass or Golden Hawk Pass |
| `"Am Beau/Golden"` | America the Beautiful pass or Golden Hawk Pass |
| `"Limited 4"` | Limited parking, arrive early |
| `"N/A"` or `"n/a"` | Not applicable / no special parking |

### Month Index Reference (availableMonths)

| Index | Month | Index | Month |
|-------|-------|-------|-------|
| 0 | January | 6 | July |
| 1 | February | 7 | August |
| 2 | March | 8 | September |
| 3 | April | 9 | October |
| 4 | May | 10 | November |
| 5 | June | 11 | December |

### Sample Record

```json
{
  "id": "bogachiel",
  "name": "Bogachiel",
  "fullName": "Bogachiel Trail",
  "distance": 6.0,
  "distanceExtended": 9.0,
  "elevationStart": 1200,
  "elevationMax": 2400,
  "difficulty": "Easy to Mod",
  "parking": "Nat'l Park/Golden",
  "range": "76",
  "notes": "Bogachiel Trail from Hurricane Ridge...",
  "seasonal": {
    "availableMonths": [5, 6, 7, 8, 9],
    "bestSeason": ""
  },
  "difficultyOrder": 2
}
```

---

## lookup.json

**Purpose:** Reference data for filtering and display.

### `difficulties` Array

Array of difficulty level objects with metadata.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `code` | string | Difficulty code matching trail.difficulty | `"Easy"` |
| `order` | integer | Sort order (lower = easier) | `1` |
| `label` | string | Display label | `"Easy"` |

**Example:**
```json
{
  "difficulties": [
    { "code": "Easy", "order": 1, "label": "Easy" },
    { "code": "Easy to Mod", "order": 2, "label": "Easy to Mod" },
    { "code": "Moderate", "order": 3, "label": "Moderate" },
    { "code": "Mod to Diff", "order": 4, "label": "Mod to Diff" },
    { "code": "Difficult", "order": 5, "label": "Difficult" }
  ]
}
```

### `parkingLevels` Object

Key-value pairs mapping parking codes to descriptions.

**Example:**
```json
{
  "parkingLevels": {
    "Discover": "Parking level: Discover",
    "Nat'l Park/Golden": "Parking level: Nat'l Park/Golden"
  }
}
```

### `months` Array

Full month names for display purposes.

**Example:**
```json
{
  "months": [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
}
```

---

## trail_details.json

**Purpose:** Extended information extracted from individual trail sheets.

**Structure:** Object keyed by trail ID: `{ "trail-id": {detail_object}, ... }`

### Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `fullDescription` | string | Complete trail description from sheet (includes Pros/Others) | Varies |
| `pros` | string|null | Planner notes about trail pros (NOT in report output) | `"None"` or description |
| `others` | string|null | Additional info (NOT in report output) | Parking tips, facilities info |
| `leaders` | string[] | Names of regular trail leaders | `["Pat", "Diane"]` |

**Example:**
```json
{
  "bogachiel": {
    "fullDescription": "Complete trail description text...",
    "pros": "None",
    "others": "Hike starts at the 'E' Loop @ about 1,400' elev. Restrooms available.",
    "leaders": ["Pat", "Diane"]
  }
}
```

**Notes:**
- All 178 trails have detail records (100% match rate using .xls extraction)
- `parking` and `range` are no longer in this file - they are now in the main `trails.json`
- `pros` and `others` are displayed on trail cards and detail pages but NOT included in Copy Report output

---

## Source Field Mapping

This section maps JSON fields back to their original Excel locations.

### Index Sheet Fields

The Index sheet contains summary data for all trails:

| Excel Column | Header | JSON Field | Notes |
|--------------|--------|------------|-------|
| A | (Notes) | `notes`, `fullName` | Trail highlights and name |
| B | Miles | `distance` | Base distance in miles |
| C | Miles + | `distanceExtended` | Extended route option |
| D | Elev | `elevationStart` | Starting elevation (feet) |
| E | Elev + | `elevationMax` | Maximum elevation (feet) |
| H | Q1 | `seasonal.availableMonths` | Spring availability (Mar-May) |
| I | Q2 | `seasonal.availableMonths` | Summer availability (Jun-Aug) |
| L | Q3 | `seasonal.availableMonths` | Fall availability (Sep-Nov) |
| O | Q4 | `seasonal.availableMonths` | Winter availability (Dec-Feb) |
| R | Level | `difficulty` | Difficulty rating |
| S | Name | `name` | Trail abbreviation |

### Individual Trail Sheet Fields

Each trail has its own sheet with detailed information:

| Cell | Field | JSON Field | Valid Values |
|------|-------|------------|-------------|
| A1 | Trail Name | Full trail name | Matches Index:A (may contain ◆︎ which is stripped) |
| B4 | Parking | `parking` | "Discover", "Nat'l Park/Golden", "NW Forest/Golden", "Am Beau/Golden", "Limited 4", "N/A" |
| G5 | Range | `range` | Numeric identifier (e.g., "76", "85") |
| A7+ | Description | `trail_details.fullDescription` | Trail description text |
| B14 | Pros | `trail_details.pros` | Planner notes about trail pros |
| B17 | Others | `trail_details.others` | Additional information |
| B20 | Leaders | `trail_details.leaders` | Leader names separated by ";" or "," |

### Seasonal Availability

The Index sheet uses quarterly indicators:

| Column | Quarter | Months Covered | Index Values |
|--------|---------|----------------|-------------|
| H | Q1 | March, April, May | 2, 3, 4 |
| I | Q2 | June, July, August | 5, 6, 7 |
| L | Q3 | September, October, November | 8, 9, 10 |
| O | Q4 | December, January, February | 11, 0, 1 |

A value of `"1"`, `"W"`, or `"Y"` indicates the trail is available during that quarter.

---

## Data Statistics

### trails.json Summary

| Metric | Value |
|--------|-------|
| Total trails | 178 |
| File size | ~92 KB |
| Distance range | 0.5 - 15 miles |
| Elevation range | 0' - 5,000'+ |

### Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| Easy to Mod | 63 | 35% |
| Mod to Diff | 46 | 26% |
| Easy | 29 | 16% |
| Moderate | 28 | 16% |
| Difficult | 12 | 7% |

### Parking Distribution

| Parking | Count | Percentage |
|---------|-------|------------|
| Nat'l Park/Golden | 45 | 25% |
| Discover | 41 | 23% |
| NW Forest/Golden | 34 | 19% |
| N/A + n/a | 26 | 14% |
| Am Beau/Golden | 2 | 1% |
| Limited 4 | 1 | <1% |

### Distance Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| < 5 miles | 38 | 21% |
| 5 - 10 miles | 115 | 64% |
| 10 - 15 miles | 22 | 15% |

### Elevation Distribution

| Range | Count | Percentage |
|-------|-------|------------|
| < 500' | 46 | 26% |
| 500' - 2,000' | 95 | 53% |
| 2,000' - 4,000' | 30 | 17% |
| > 4,000' | 3 | 2% |

---

## Geographic Coverage

The database covers trails in the **Olympic Peninsula, Washington** region, including:

- Olympic National Park (ONP)
- Dungeness Recreation Area
- Lake Crescent area
- Hurricane Ridge
- Sol Duc Valley
- Port Angeles vicinity
- Sequim/Dungeness area
- Quilcene Basin
- Port Townsend/Fort Worden
- Whidbey Island
- Victoria, BC (day trips)

---

## Report Format

The "Copy Report" feature generates text in this format:

```
Trail Name◆︎  [Difficulty]    distance / elevation    parking    ride-$X
[full description]
```

**Example:**
```
Heart of the Forest◆︎  [Easy to Mod]    5-5.5 / 650'-850'    Nat'l Park/Golden    ride-$5
This is a pleasant nature trail leaving from Loop "E" in the Heart of the Hills Campground @ ~ 1,400'. It offers beautiful, old-growth trees, plenty of fern varieties, and other flora in a rainforest-type ecosystem.  While hiking on this trail, carefully cross puncheon walkways, as they can be slippery.  Hikers go to a big, fallen tree above Lake Creek, which makes a good turn-around point before leaving the Natl. Park boundary.
```

**Format Details:**
- Header line contains tab-separated fields
- Description is on a new line (Pros and Others sections are stripped)
- Ride cost calculated from range: <30=ride-$3, <60=ride-$5, <90=ride-$7, ≥90=ride-$10

---

## Update History

| Date | Action |
|------|--------|
| 2024-03-15 | Initial extraction from Hike Data BaseM.xlsm |
| 2026-03-16 | Switched to .xls file with pandas-based extraction (178 trails, 100% detail match) |
| 2026-03-16 | Fixed: Trail IDs use full names from Index:A with uniqueness guarantee |
| 2026-03-16 | Fixed: Sheet name → short name → trail ID mapping for details |
| 2026-03-16 | Fixed: Double "◆︎" issue - stripped from 60 trail names + report generation |
| 2026-03-16 | Added: Pros (B14) and Others (B17) fields extracted from trail sheets |
| 2026-03-16 | Updated: Copy Report includes full description (Pros/Others stripped) |
| 2026-03-16 | UI: Combined Range + Ride Cost into single "Ride" stat |
| 2026-03-16 | UI: Combined Elevation Start + Max into single "Elevation Gain" stat |
| 2026-03-16 | UI: All stats displayed on one line (4 columns) |
| 2026-03-16 | UI: Navigation buttons moved to top of trail detail page |
| 2026-03-16 | UI: Metadata (Pros/Others/Leaders) hidden from browse cards |

---

## Notes on Data Quality

1. **Data source**: Uses `Hike Data Base.xls` (older format) for consistent sheet name → short name mapping
2. **Extraction method**: Pandas-based extraction (`extract_trails_xls.py`) provides reliable cell parsing
3. **Trail ID mapping**: Uses full names from Index:A with uniqueness guarantee via slugify()
4. **Details matching**: Sheet name → short name (Index:S) → trail ID provides 100% match rate
5. **Wilderness marker**: Some trail names contain "◆︎" - automatically stripped during extraction and report generation
6. **All trails have details**: 178 of 178 trails (100%) have complete detail records
7. **Pros/Others** fields appear on trail cards and detail pages but are excluded from Copy Report output
