# TODO — Remaining Cleanup

Work through these top-to-bottom. After each item, run the listed verification and wait for user verification before starting the next item.

Status legend:
- `[ ]` pending
- `[~]` in progress
- `[x]` done and verified

## 1. Normalize schedule entry shapes

Status: `[x]`

### Explanation
The schedule code currently supports two related but different shapes because of the two deployment models:

- Sothh-style schedules use different hike days, e.g. `[3, 5]` for Wed/Fri. A date usually has one entry:

```js
{
  January: {
    7: { trail_id: 'a', leader: 'X' }
  }
}
```

- Ramblers-style schedules can have two hikes on the same day, e.g. `[1, 1]` for Mon A / Mon B. A date can have multiple entries:

```js
{
  January: {
    5: [
      { trail_id: 'a', leader: 'X' },
      { trail_id: 'b', leader: 'Y' }
    ]
  }
}
```

The server schedule can also arrive in two shapes:

```js
// flat array format
{ Jan: [{ day: 5, slot: 0, trail_id: 'a' }] }

// day-keyed object format
{ Jan: { 5: entryOrArray } }
```

This is why several places use ad-hoc `Array.isArray()` checks. The likely cleaner model is to normalize the internal client store to always use arrays per day:

```js
{
  January: {
    5: [
      { trail_id: 'a', leader: 'X' }
    ]
  }
}
```

Even single-hike days would use an array of length 1.

### Proposed change
- Make `serverScheduleToStore()` always produce array-shaped day entries.
- Add focused helpers in `src/utils/scheduleFormat.js` or `src/utils/array.js`, such as:
  - `getDayEntries(monthData, day)`
  - `setDayEntry(monthData, day, slot, entry)`
  - `normalizeServerMonthEntries(entries)`
- Update `src/hooks/useScheduleDragDrop.js` to use those helpers instead of repeated `Array.isArray()` branches.
- Update `src/contexts/ScheduleSettingsContext.jsx` entry counting and server verification to use the same normalization.
- Keep `storeToServerSchedule()` output unchanged: flat array of `{ day, slot, trail_id, early_start, leader }`.

### Files
- `src/utils/scheduleFormat.js`
- `src/utils/array.js`
- `src/hooks/useScheduleDragDrop.js`
- `src/contexts/ScheduleSettingsContext.jsx`
- `src/test/utils/scheduleFormat.test.ts`
- `src/test/hooks/useScheduleDragDrop.test.ts`
- `src/test/components/ScheduleSettingsDropdown.test.tsx`

### Verification
- `npx vitest run src/test/utils/scheduleFormat.test.ts src/test/hooks/useScheduleDragDrop.test.ts src/test/components/ScheduleSettingsDropdown.test.tsx --reporter=dot`
- `npm run test:run`
- Manual check: sothh-style single-hike days still display/edit correctly.
- Manual check: ramblers-style same-day slots still preserve slot 0 and slot 1.

## 2. Refactor `useGpxActions` for per-trail state and remove `ScheduleBuilder` duplication

Status: `[x]`

### Explanation
`src/hooks/useGpxActions.js` currently holds a single `gpxDownloading` boolean for one trail. That works for `TrailCard`, `NextHikeBanner`, and `TrailDetail`, but `src/pages/ScheduleBuilder.jsx` still has its own GPX/trailhead action logic because it may need per-trail downloading state and callbacks.

The hook currently accepts a trail object:

```js
useGpxActions(trail)
```

and returns:

```js
{
  gpxDownloading,
  handleGpxDownload,
  handleTrailhead,
  handleGpxShare
}
```

`ScheduleBuilder` needs something closer to:

```js
const gpxActions = useGpxActions();
gpxActions.handleDownload(trailId, trailName);
gpxActions.isDownloading(trailId);
```

or a per-trail factory.

### Proposed change
- Refactor `useGpxActions` to support either:
  - current single-trail usage, or
  - a trail-agnostic mode with per-trail state keyed by trail ID.
- Move `ScheduleBuilder` GPX download/trailhead handling onto the shared hook.
- Remove duplicate `getGpx`, `downloadBlob`, `openGoogleMapsTrailhead`, and `sanitizeFilename` logic from `ScheduleBuilder` if it is no longer needed.
- Preserve existing behavior for `TrailCard`, `NextHikeBanner`, and `TrailDetail`.

### Files
- `src/hooks/useGpxActions.js`
- `src/pages/ScheduleBuilder.jsx`
- `src/components/TrailCard.jsx`
- `src/components/NextHikeBanner.jsx`
- `src/pages/TrailDetail.jsx`
- `src/test/hooks/useGpxActions.test.ts`
- `src/test/pages/ScheduleBuilder.test.tsx`

### Verification
- `npx vitest run src/test/hooks/useGpxActions.test.ts src/test/pages/ScheduleBuilder.test.tsx src/test/pages/TrailDetail.test.tsx --reporter=dot`
- `npm run test:run`
- Manual check: GPX download in `ScheduleBuilder` shows the correct per-trail busy state.
- Manual check: trailhead buttons still open Google Maps for valid coordinates.

## 3. Add GPX share support to `NextHikeBanner`

Status: `[x]`

### Explanation
`useGpxActions` now exposes `handleGpxShare`, and `TrailDetail` uses it for its GPX share button. `NextHikeBanner` currently uses `handleGpxDownload` and `handleTrailhead`, but does not expose a share action.

This item is optional unless we want the next-hike banner to support sharing GPX files directly.

### Proposed change
- Destructure `handleGpxShare` from `useGpxActions(trail)` in `NextHikeBanner`.
- Add a share button to `TrailActionButtons` or `NextHikeBanner` only if the UI has room and the behavior is desired.
- Ensure the share action stops event propagation so it does not trigger the card link or weather action.
- Update tests to verify the share button calls `shareGpxFile` with the expected GPX and trail name.

### Files
- `src/components/NextHikeBanner.jsx`
- `src/components/shared/TrailActionButtons.jsx`
- `src/test/components/NextHikeBanner.test.tsx`

### Verification
- `npx vitest run src/test/components/NextHikeBanner.test.tsx --reporter=dot`
- `npm run test:run`
- Manual check: sharing from the next-hike banner does not navigate or trigger other card actions.

## 4. Centralize API-key storage writes

Status: `[x]`

### Explanation
API-key reads are now centralized in `src/utils/apiKey.js`:

```js
API_KEY_STORAGE_KEY
getStoredApiKey()
hasStoredApiKey()
```

However, `src/contexts/TrailActionsContext.jsx` still writes the literal `localStorage` key in `saveApiKey`. That leaves one more place that can drift from the shared constant.

### Proposed change
- Add a setter helper in `src/utils/apiKey.js`, for example:

```js
export function storeApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}
```

- Update `TrailActionsContext.saveApiKey` to use `storeApiKey()`.
- Optionally clear the key through a helper if an empty value is saved.
- Keep the existing `apiKey` state behavior unchanged unless item 5 is also done.

### Files
- `src/utils/apiKey.js`
- `src/contexts/TrailActionsContext.jsx`
- `src/test/hooks/useApiKey.test.ts`

### Verification
- `npx vitest run src/test/hooks/useApiKey.test.ts --reporter=dot`
- `npm run test:run`
- Manual check: saving an API key from the UI still persists to `localStorage` and is picked up by `getStoredApiKey()`.

## 5. Make `useApiKey` reactive to `localStorage` changes

Status: `[x]`

### Explanation
`src/hooks/useApiKey.js` currently returns a memoized initial value:

```js
useMemo(() => hasStoredApiKey(), [])
```

That means if the API key is added, removed, or changed after the component mounts, the hook will not update until the component remounts or the page reloads.

This may be fine if API-key changes always happen before the relevant component mounts, but it is a subtle behavior.

### Proposed change
Choose one of these approaches:

1. Minimal approach: document that `useApiKey` is intentionally initial-only.
2. Reactive approach: listen for `storage` events and/or context updates so the hook reflects current `localStorage` state.
3. Preferred long-term approach: move API-key state into a React context or store, similar to `TrailActionsContext`, and have `useApiKey` read from that shared state.

The context/store approach is cleaner because `TrailActionsContext.saveApiKey()` can update both `localStorage` and React state in one place.

### Files
- `src/hooks/useApiKey.js`
- `src/contexts/TrailActionsContext.jsx`
- `src/utils/apiKey.js`
- `src/test/hooks/useApiKey.test.ts`

### Verification
- `npx vitest run src/test/hooks/useApiKey.test.ts --reporter=dot`
- `npm run test:run`
- Manual check: saving or clearing the API key in the UI updates components that depend on `useApiKey()` without a full page reload.

## 6. Address production build chunk-size warning

Status: `[x]`

### Explanation
`npm run build` currently succeeds but warns that a chunk is larger than 500 kB after minification:

```text
dist/assets/index-*.js  ~597 kB  gzip: ~178 kB
```

This is not a functional failure, but it can affect initial load performance.

### Proposed change
Options, in rough order from safest to more invasive:

1. Raise or configure `build.chunkSizeWarningLimit` if the size is acceptable.
2. Improve code splitting by lazy-loading large routes or components.
3. Move large dependencies into separately imported chunks.
4. Audit unused dependencies and remove anything no longer needed.

The safest first step is to identify what is in the large chunk, then decide whether to split it or accept the warning.

### Files
- `vite.config.js`
- `package.json`
- `src/App.jsx`
- large route/component files as needed

### Verification
- `npm run build`
- Compare `dist/assets` sizes before and after.
- Manual check: app still loads correctly at `/`, `/browse`, `/schedule`, and `/trail/:id`.

## 7. Make the app installable as a phone web app and reduce network use with caching

Status: `[x]`

### Explanation
The app should be installable on a phone as a web app, ideally behaving like a native app when added to the home screen. This should also reduce network use because:

- trail data does not change often
- schedule data changes less often than a typical web page
- tide predictions for a particular day/hike/station are stable once fetched
- the app shell and static assets only change on deployment

Currently the app has no PWA manifest, no service worker, and no explicit offline caching strategy.

### Goals
- Allow “Add to Home Screen” / install on Android and iOS.
- Launch in standalone mode without browser chrome.
- Load the app shell offline after the first visit.
- Serve cached trail, schedule, and config data when offline or when the network is slow.
- Cache tide predictions aggressively because they are stable for a given date/station.
- Avoid stale schedule surprises after edits by invalidating or refreshing schedule caches on successful writes.

### Proposed approach
1. Add a web app manifest:
   - `name`
   - `short_name`
   - `start_url` respecting `import.meta.env.BASE_URL`
   - `scope` respecting subpath deployments
   - `display: standalone`
   - theme/background colors
   - 192px and 512px icons, plus maskable icons if feasible

2. Add a service worker:
   - register only in production
   - scope it to the app base path so subpath deployments like `/sothh-dev/` work correctly
   - precache or stale-while-revalidate the app shell/static assets
   - provide an offline fallback to `index.html` for SPA routes

3. Cache read-only API data:
   - `/api/config` can use short-TTL or stale-while-revalidate caching.
   - `/api/trails` and trail details can use cache-first or stale-while-revalidate caching.
   - schedule reads should probably be network-first with cache fallback, because users edit schedules.
   - after successful schedule writes, update or invalidate the cached schedule so the UI does not show stale data.
   - never cache write endpoints such as `PUT`, `POST`, or `DELETE` as if they were read data.
   - never store API keys in cache names or cached payloads.

4. Cache tide predictions:
   - cache by station/trail coordinates plus date
   - treat a given date’s tide prediction as stable after the first successful fetch
   - keep weather forecasts short-TTL or network-first because forecasts change
   - consider Cache Storage or IndexedDB for tide JSON

5. Add basic offline UX:
   - show an “offline” or “last updated” indicator when serving cached data
   - allow browsing cached trails/schedule without network
   - avoid promising offline schedule editing unless write changes are queued and synchronized later

### Deployment considerations
- The same build is used for multiple subpath deployments, so cache names and service worker scope should include the base path or deployment identifier.
- `start_url` and `scope` must work for both root and subpath deployments.
- Icons and manifest must be served from the correct base path.
- Service worker updates should not strand users on an old app shell after deployment.

### Files
- `index.html`
- `public/manifest.webmanifest`
- `public/icons/`
- `public/sw.js` or a Vite-built service worker entry
- `src/App.jsx` or `src/main.jsx` for service worker registration
- `src/api/client.js` for API read caching
- `src/utils/io.js` for tide caching
- `vite.config.js` for base-path behavior
- `src/test/api/client.test.js`
- `src/test/utils/io.test.ts`

### Verification
- `npm run build`
- Run `npm run preview` or deploy to a staging subpath.
- Confirm the browser offers install/Add to Home Screen.
- Confirm the app launches standalone on a phone.
- Use DevTools offline mode and confirm the app shell still loads.
- Confirm trails/schedule render from cache when offline.
- Confirm tide data for a previously viewed date works offline.
- Confirm schedule edits refresh the cached schedule and do not show stale entries after reload.
