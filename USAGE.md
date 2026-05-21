# SOTHH Hike Scheduler — Usage Guide

## Getting Started

Open `dist/index.html` in a browser (or serve it with any web server). The app loads all trail data and schedules from embedded JSON files.

## Browse Trails

The default view shows all 178 trails. Use the filters at the top to narrow the list:

- **Search** — matches trail name, hike name, and notes
- **Distance / Elevation** — range sliders
- **Difficulty** — select one or more levels
- **Best Season** — select months

Click any trail card to see its full details (description, pros, cons, leader info).

### Editing Trail Data

Each trail detail page has editable fields. Changes are saved to IndexedDB immediately and persist across sessions and app rebuilds. Use **Trail Manager** (`/trails`) to manage trails with search, index numbers, and CRUD operations.

### Trail Manager

Navigate to **Trail Manager** (`/trails`) to:
- **View** all trails with index numbers, distance, and difficulty
- **Search** by trail name, full name, or ID
- **Add** new trails with the "New Trail" button
- **Edit** trails (navigates to trail detail page)
- **Delete** trails with confirmation
- **Import/Export** trail data as JSON for backup or Excel export

## Schedule Builder

Navigate to **Schedule Builder** to plan hikes for upcoming months.

### Layout

The Schedule Builder has two panels:

- **Left panel (80%)** — Available hikes (all 178 trails, filterable)
- **Right panel (20%)** — Wed/Fri dates for the selected month

### Creating a Schedule

1. **Select a month** using the dropdown at the top
2. **Filter hikes** (optional) — same filters as browse mode
3. **Drag a hike** from the left panel and **drop it on a date** in the right panel
4. To **unassign** a hike, drag it back to the left panel, or click the **X** button on a date card
5. To **reschedule**, drag a hike from one date to another (or to the "Scheduled" section cards)

### Assigned Hikes Section

Click the **Scheduled (N)** button to show all currently assigned hikes in a grid. These cards are also draggable — drag them to a different date to reschedule, or to the left panel to unassign.

### Per-Month Schedules

Each month has its own independent schedule. Switching months shows that month's dates and assignments. Schedules are stored in your browser's local storage.

### Exporting a Schedule

1. Click **Export to Text File** at the bottom
2. A `.txt` file is generated with the format:

```
Over-the-Hill Hike Descriptions -- June, 2026
Wednesday, June 3    [Trail Name]
  Distance: X mi
  Elevation: X ft
  ...

Friday, June 5       TBD
```

Unassigned dates show "TBD".

### Import/Export All Data

Click the **gear icon** in the top bar to access:

- **Export All** — Downloads your complete schedule data as JSON (all months)
- **Export Hike Edits** — Downloads your trail edits as JSON
- **Import Hike Edits** — Imports trail edits from a JSON file
- **Import** — Imports schedule data from a JSON file (merged with existing)
- **Clear All Data** — Removes all schedules and edits

### Debug Mode

Enable **Debug Mode** from the gear menu to see:
- Trail index numbers on cards (left panel)
- Hike count totals in the header
- Detailed console logging when you type in the search box

Debug mode is controlled by a localStorage key and does not affect functionality.

## Data Persistence

Trail data is stored in IndexedDB (`hiker-trails` database). Schedule data is stored in localStorage:

| Storage | Key/DB | Content |
|---------|--------|---------|
| IndexedDB | `hiker-trails` | Trail data and edits (persists across rebuilds) |
| localStorage | `hiker-schedule` | Per-month schedule data (all months) |
| localStorage | `hiker-schedule-debug` | Debug mode toggle (`true`/`false`) |

Clearing browser data will remove all schedules and trail data. Use Export before clearing.

## Technical Notes

- The app uses **MemoryRouter** — it works with `file://` protocol (no web server required)
- Drag and drop uses the native HTML5 API (no external libraries)
- Wed/Fri dates are computed automatically from the selected month
- Each hike replaces any existing assignment on a date (no conflicts)
