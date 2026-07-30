# Boost Yourself — PWA Edition

## What's in this folder
- `index.html` — the whole app (UI + logic)
- `manifest.json` — makes the app installable (name, icons, theme color)
- `sw.js` — service worker, caches the app so it works offline
- `icons/` — app icons used for the home-screen icon and splash

## How to run it

### Quick preview (double-click)
Opening `index.html` directly works for the app itself, but browsers block
service workers on `file://` links for security reasons — so offline mode
and "Add to Home Screen" won't be available in that mode.

### Full PWA experience (recommended)
Serve the folder over HTTP so the browser treats it as a real installable
web app:

```bash
cd boost-yourself-pwa
python3 -m http.server 8080
# then open http://localhost:8080 in Chrome/Edge on your phone or computer
```

Or upload the folder as-is to any static host — GitHub Pages, Netlify,
Vercel, Cloudflare Pages — all work with zero configuration since it's
static files. Once it's on `https://`, opening it on Android Chrome will
show the "Install app" banner, and the app will cache itself for offline use.

## Turning it into a real `.apk` / Play Store release
This project is a static PWA — there's no build pipeline here that can
compile a signed Android package. To get an installable `.apk` or an
`.aab` for the Play Store, once the PWA is hosted at a public HTTPS URL:

1. **PWABuilder** (easiest, no coding): go to https://www.pwabuilder.com,
   paste your hosted URL, and it will generate a signed Android package
   (Trusted Web Activity) ready for the Play Console.
2. **Bubblewrap CLI** (Google's official tool): `npm i -g @bubblewrap/cli`,
   then `bubblewrap init --manifest=https://yourdomain.com/manifest.json`
   to generate and build the Android project locally.
3. Either path produces a package you can sign and upload to the
   Play Console under your own developer account.

## Notes on the "AI Coach" and notifications
- The **AI Coach** card on the dashboard is on-device, rule-based logic
  that looks at your last ~14 logged days and highlights your weakest
  and strongest habits — it doesn't call any external AI service, so it
  works fully offline and keeps your data on your device.
- **Notifications** use the browser's local Notification API — they fire
  while the app/tab is open (or running installed as a PWA), checked
  every 15 seconds against the reminder times you set in Profile →
  Notifications. True background push notifications (firing even when
  the app is fully closed) require a push server and aren't included,
  since this is a backend-free, zero-config app.

## Data & privacy
Everything (profile, daily entries, goals, reminders) is stored in the
browser's `localStorage` on your device only. Nothing is sent anywhere.
Use Profile → Export Data to back up as JSON, or Reset Challenge to
start over.
