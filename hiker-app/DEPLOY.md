# Deployment Guide - Hike Database Web App

This guide covers deploying the hiking trail database app.

---

## Quick Deploy Options

### Option 1: Vercel (Easiest)

```bash
# Install Vercel CLI
npm i -g vercel

# Login (first time only)
vercel login

# Deploy
cd hiker-app
vercel --prod
```

Output will give you a URL like: `https://hiker-app.vercel.app`

---

### Option 2: Netlify Drop (No CLI needed)

1. Go to https://app.netlify.com/drop
2. Drag and drop the `dist` folder from `hiker-app/dist`
3. Get your URL instantly!

---

### Option 3: GitHub Pages

```bash
# Install gh-pages
npm install -D gh-pages

# Update package.json with these lines:
"homepage": "https://YOUR_USERNAME.github.io/hiker-app",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}

# Deploy
npm run deploy
```

---

## Local Testing Before Deploy

### Test the build locally:

```bash
cd hiker-app
npm run build
npm run preview
```

This serves the production build at `http://localhost:4173`

### Run Tests

```bash
cd hiker-app
npm run test
```

### Run Linter

```bash
cd hiker-app
npm run lint
```

---

## What Gets Deployed

```
hiker-app/dist/
├── index.html          (~587 KB)  - Entry point with embedded data
```

**Total size: ~587 KB** (gzipped to ~144 KB)

---

## Updating After Deploy

### To add/update trails:

1. Edit `Hike Data Base.xls`
2. Run extraction:
   ```bash
   python D:\hiker\extract_trails_xls.py
   ```
3. Match schedule hikes to trails:
   ```bash
   python D:\hiker\match_schedule.py
   ```
4. Copy new data files:
   ```bash
   copy D:\hiker\exported_data\*.json D:\hiker\hiker-app\public\data\
   ```
5. Rebuild and redeploy:
   ```bash
   cd hiker-app
   npm run build
   vercel --prod  # or your deploy method
   ```

---

## Environment Variables (Not Needed)

This app is fully static - no environment variables required!

---

## Custom Domain

### Vercel:
1. Go to project settings → Domains
2. Add your custom domain
3. Update DNS as instructed

### Netlify:
1. Go to site settings → Domain management
2. Add custom domain
3. Update DNS as instructed

---

## Troubleshooting

### Build fails with Tailwind error:
```bash
npm install @tailwindcss/postcss
```

### Data not loading:
- Check that `public/data/trails.json` exists
- Verify JSON is valid
- Check browser console for 404 errors

### Filters not working:
- Clear browser cache
- Check that data was extracted correctly

### Schedule Builder issues:
- Verify `schedule.json` was copied to `public/data/`
- Check browser console for errors
- Clear localStorage if schedule data is corrupted: `localStorage.removeItem('hiker-schedule')`

---

## Build Pipeline

```
Excel Files → extract_trails_xls.py → exported_data/*.json
              ↓
match_schedule.py → updated trails.json + schedule.json
              ↓
copy to hiker-app/public/data/
              ↓
npm run build → dist/index.html (~587 KB)
```
