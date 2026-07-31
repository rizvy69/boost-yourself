// Boost Yourself — Push Notification Backend
// Node.js + Express + web-push
//
// What this does:
//  - Stores each user's push "subscription" (created by the browser) + their
//    reminder times (sent from the app's Profile > Notifications screen)
//  - Every minute, checks: "does any subscription have a reminder time that
//    matches right now?" If yes, sends a real push notification — this works
//    EVEN IF the phone's browser/PWA is fully closed (as long as the device
//    is on and has internet), unlike the old local-only notifications.
//
// Storage: a single JSON file (db.json) — good enough for a personal project.
// Swap for a real database (Postgres/Mongo) later if you get many users.

const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- 1. VAPID keys (identify YOUR server to push services) ----------
// These came from `npx web-push generate-vapid-keys`. In production, put
// them in environment variables instead of hardcoding — see .env.example.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCoRLVan0jcBO63xJw5ZiKFvqQ8QdgshqEd_diXU60Cf35Gip9PZPIs5iS5XVGNVH2fJWaO0s-hklPTPJNRhijM';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'xoHfmmL2VdCu-ka-cEovBQlxneU_H1jEg1ODIOiRw5c';

webpush.setVapidDetails(
  'mailto:you@example.com', // change to your email
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ---------- 2. Tiny JSON "database" ----------
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { subscriptions: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
if (!fs.existsSync(DB_FILE)) writeDB({ subscriptions: [] });

// ---------- 3. Routes ----------

// Frontend calls this to know which public key to subscribe with
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Frontend sends { subscription, reminders } after the user grants
// notification permission. reminders = [{ id, label, time: "HH:MM" }, ...]
app.post('/subscribe', (req, res) => {
  const { subscription, reminders } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const db = readDB();
  const existingIndex = db.subscriptions.findIndex(
    (s) => s.subscription.endpoint === subscription.endpoint
  );

  const entry = { subscription, reminders: reminders || [], lastSentMinute: {} };

  if (existingIndex >= 0) db.subscriptions[existingIndex] = entry;
  else db.subscriptions.push(entry);

  writeDB(db);
  res.json({ ok: true });
});

// Frontend calls this whenever the user updates reminder times in Profile
app.post('/update-reminders', (req, res) => {
  const { endpoint, reminders } = req.body;
  const db = readDB();
  const found = db.subscriptions.find((s) => s.subscription.endpoint === endpoint);
  if (!found) return res.status(404).json({ error: 'Subscription not found' });
  found.reminders = reminders || [];
  writeDB(db);
  res.json({ ok: true });
});

// Frontend calls this when the user turns notifications off
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const db = readDB();
  db.subscriptions = db.subscriptions.filter((s) => s.subscription.endpoint !== endpoint);
  writeDB(db);
  res.json({ ok: true });
});

// NEW: fires an immediate real push to a given subscription — used by the
// "Test / Retry Push Setup" button so you get instant proof push delivery
// works, instead of waiting for a scheduled reminder time.
app.post('/send-test', async (req, res) => {
  const { endpoint } = req.body;
  const db = readDB();
  const found = db.subscriptions.find((s) => s.subscription.endpoint === endpoint);
  if (!found) return res.status(404).json({ error: 'Subscription not found' });

  const payload = JSON.stringify({
    title: 'Boost Yourself',
    body: 'Test push received! Real background notifications are working.',
  });

  try {
    await webpush.sendNotification(found.subscription, payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('Test push failed:', err.message);
    res.status(500).json({ error: err.message, statusCode: err.statusCode });
  }
});

app.get('/', (req, res) => res.send('Boost Yourself push server is running.'));

// ---------- 4. The scheduler — checks every minute ----------
// NOTE: on Render's free tier, this server goes to sleep after ~15 minutes
// of no incoming HTTP traffic. While asleep, this cron job does NOT run, so
// scheduled reminders will be silently missed. Use a free uptime pinger
// (e.g. cron-job.org or UptimeRobot) to hit this server's URL every 10
// minutes and keep it awake, or upgrade to a paid Render plan.
cron.schedule('* * * * *', async () => {
  const db = readDB();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const nowKey = `${hh}:${mm}`;
  const todayStamp = now.toISOString().slice(0, 10); // yyyy-mm-dd, avoids double-send

  let changed = false;

  for (const entry of db.subscriptions) {
    for (const reminder of entry.reminders) {
      if (reminder.time !== nowKey) continue;
      const alreadySentKey = `${reminder.id}-${todayStamp}`;
      if (entry.lastSentMinute[alreadySentKey]) continue; // already sent today

      const payload = JSON.stringify({
        title: reminder.label || 'Boost Yourself',
        body: `Time for your ${(reminder.label || 'habit').toLowerCase()} — stay on track today!`,
      });

      try {
        await webpush.sendNotification(entry.subscription, payload);
        entry.lastSentMinute[alreadySentKey] = true;
        changed = true;
      } catch (err) {
        // 410/404 means the subscription is dead (user uninstalled, etc.)
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.subscriptions = db.subscriptions.filter((s) => s !== entry);
          changed = true;
        } else {
          console.error('Push failed:', err.message);
        }
      }
    }
  }

  if (changed) writeDB(db);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Push server running on port ${PORT}`));
