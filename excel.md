# Hike TSV Format — Individual Trail Sheet

This format mirrors a single trail sheet from `Hike Data BaseM.xls` exactly. Each trail is one sheet with a fixed row/column layout. The TSV is a direct dump of the cells — tabs separate columns, newlines separate rows.

## File Format

- **Encoding**: UTF-8
- **Line endings**: `\n` (LF)
- **Column separator**: `\t` (tab)
- **Rows**: exactly 20 rows (row 0 – row 19)
- **Columns**: 9 columns per row (A – I), separated by 8 tabs
- **Empty cells**: empty string between tabs
- **No header row** — the layout is positional

## Cell Layout

```
Row  Col A                    Col B          Col C  Col D             Col F            Col G            Col H  Col I
0    Trail Name
1    (empty)
2    Miles                    Distance       to     Distance Extended  Elevation        Elevation Start  to     Elevation Max
3    Parking                  Parking Value                     Season         Best Season
4    Level                    Level Value                       Range          Range Value
5    General Information
6    Description text (spans to row 12 if long)
7    (empty or continuation)
8    (empty)
9    (empty)
10   (empty)
11   (empty)
12   (empty)
13   (empty)
14   Pros                     Pros text
15   (empty)
16   Other                    Other text
17   (empty)
18   (empty)
19   Leaders                  Leader names (comma-separated)
```

## Field Descriptions

| Row | Cell | Field | Required | Description |
|-----|------|-------|----------|-------------|
| 0 | A | **Trail Name** | **yes** | Full trail name. Must be non-empty. |
| 2 | B | **Distance** | no | Base trail distance in miles (number) |
| 2 | D | **Distance Extended** | no | Extended route distance in miles (number) |
| 2 | G | **Elevation Start** | no | Starting elevation in feet (integer) |
| 2 | I | **Elevation Max** | no | Maximum elevation in feet (integer) |
| 3 | B | **Parking** | no | Parking pass required (see enum below) |
| 3 | G | **Best Season** | no | Preferred season (see values below) |
| 4 | B | **Level** | no | Trail difficulty (see enum below) |
| 4 | G | **Range** | no | Distance from parking lot in minutes (integer, used for ride cost) |
| 6 | A | **Description** | no | Full trail description from "General Information" section |
| 14 | B | **Pros** | no | Planner notes about trail pros |
| 16 | B | **Other** | no | Additional info (warnings, parking tips, facilities) |
| 19 | B | **Leaders** | no | Comma-separated trail leader names |

## Enumerations

### Parking (Row 3, Col B)

| Value | Description |
|-------|-------------|
| `Discover` | Discover Pass required |
| `Nat'l Park/Golden` | National Park Annual Pass or Golden Age/Lifetime Pass |
| `NW Forest/Golden` | Northwest Forest Pass or Golden Age/Lifetime Pass |
| `Am Beau/Golden` | America the Beautiful Pass or Golden Age/Lifetime Pass |
| `Limited 4` | Limited 4-hour parking permit |
| `N/A` or `n/a` | No parking pass required |
| *(empty)* | Not specified |

### Level (Row 4, Col B)

| Value | Description |
|-------|-------------|
| `Easy` | Flat, well-maintained trail |
| `Easy to Mod` | Mostly easy with some moderate sections |
| `Moderate` | Moderate elevation gain or terrain |
| `Mod to Diff` | Mostly moderate with some difficult sections |
| `Difficult` | Steep, rough, or technically challenging |
| *(empty)* | Unknown difficulty |

### Best Season (Row 3, Col G)

Free-form text. Common values observed in the database:

| Value | Notes |
|-------|-------|
| `Any` | Year-round |
| `All` | Year-round |
| `Spring`, `Summer`, `Fall`, `Winter` | Single season |
| `Spring/Summer`, `Summer/Fall`, `Fall/Winter`, etc. | Multi-season (slash-separated) |
| `Fall/Spring/Summer` | Three seasons |
| `Low Tide` | Tide-dependent |
| Month names (`Jun`, `Jul`, `Aug`, `Sep`, `Nov`, `May`) | Specific months |
| `Any except Jan.` | Seasonal restriction |
| `July/Aug`, `June/July`, `July/Sept.`, etc. | Month ranges |

### Leaders (Row 19, Col B)

Comma-separated list of names. Each name is trimmed of whitespace.

## Complete Example (Barnes Creek)

```
Barnes Creek
								(to be represented as: "Barnes Creek\t\t\t\t\t\t\t\t\n\nMiles\t7.5\tto\t9\t\tElevation\t1640\tto\t2000\n...")
```

Full TSV content:
```
Barnes Creek
								(empty row)
Miles	7.5	to	9		Elevation	1640	to	2000
Parking	Nat'l Park/Golden				Season	Fall/Spring/Summer
Level	Mod to Diff				Range	51
General Information
Pass turn-off to Marymere Falls @ about 3/4 mi. & proceed up the valley along Barnes Creek, crossing 3 bridges and some old-growth, giant trees. At ~ 3.75 miles, pass Dismal Draw Camp and proceed on up to the Aurora Divide junction at ~4-1/2 miles and @ 2,050', which is a good turn-around point.  Views of Mt. Storm King.
								(empty rows 7-13)
Pros
								(empty row)
Other	Slippery bridges--1st one w/o handrail @ ~ 1.4 mi.  Two-three slides which could present a problem. 3,300 cumulative?
								(empty rows 17-18)
Leaders	Pat, Paul
```

## Import Behavior

- **Trail Name** (row 0, col A) is the primary identifier. If a trail with the same name already exists, the importer prompts to **update**, create a **new** copy, or **cancel**
- `notes` is auto-populated as the first 200 characters of the trail name
- `difficulty` is mapped from `Level`: `Easy` → 1, `Easy to Mod` → 2, `Moderate` → 3, `Mod to Diff` → 4, `Difficult` → 5
- `availableMonths` is NOT included in individual trail sheets — it comes from the Index sheet
- Empty `Level` defaults to `Unknown`
- `altNames` is NOT stored on individual sheets — managed separately in the app
