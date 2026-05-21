# Hiker Trail Browser

A static React web application for browsing and managing SOTHH trail data.

## Quick Start

### Run the App

Open `hiker-app/dist/index.html` in any browser. No server required - it works from `file://` protocol.

### Update Trail Data

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full data pipeline, scripts, and build process.

## App Features

- **Browse** all 178 trails with grid layout
- **Search** across trail names, notes, difficulty, parking, and hike names
- **Filter** by distance, elevation, difficulty, months
- **Sort** by Name, Popularity, Elevation (↑/↓), Distance (↑/↓), or Not Wilderness (non-◆ first, then alphabetical)
- **Trail Detail** pages with full information
- **Edit** trail details (description, notes, fullName, distance, elevation, difficulty, parking, range, pros, others, leaders, and more)
- **Trail Manager** - CRUD interface for adding, editing, and deleting trails with search and index numbers
- **Copy Report** - Generate formatted text for trail reports
- **Schedule Builder** - Two-panel drag-and-drop interface for planning hikes on Wed/Fri dates
- **Persistent Storage** - All trail edits stored in IndexedDB, persisting across sessions and rebuilds
- **Import/Export** - Export trail data as JSON for backup or Excel export

## Monthly Availability Display

The app shows monthly availability as text labels (e.g., "Apr, Jun, Jul, Dec"). Higher scores (more hikes) in the `seasonal` dict indicate more popular months.

## Sort Behavior

- **Name** — alphabetical by trail name (default)
- **Popularity** — sorted by sum of scores for selected months. When no months are selected, all 12 months are used.
- **Elevation ↑/↓** — sorted by `elevationStart` (ascending or descending)
- **Distance ↑/↓** — sorted by `distance` (ascending or descending)

## File Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full project layout.

## Troubleshooting

### Blank page on open
- The app works from `file://` protocol
- If blank, try hard refresh (Ctrl+Shift+R)

### CORS errors
- Ensure you're using the `dist/index.html` file, not the source files
- The app uses MemoryRouter for file:// compatibility

### Data not updating
- Run both scripts in order: extract first, then match
- Copy updated JSON files to `hiker-app/public/data/`
- Rebuild with `npm run build`
- **Note**: Existing trail edits in IndexedDB are preserved across rebuilds (smart merge)

### Export trail data to Excel
1. In Trail Manager (`/trails`), click "Export for Excel"
2. Run `python export_to_xls.py` to convert `export_for_excel.json` back to Excel format

## License

See LICENSE file for details.
