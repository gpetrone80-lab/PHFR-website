# Palm Harbor Fire Rescue — SOP & EMS Reference Hub

A mobile-first Progressive Web App (PWA) for department personnel to review
**County SOPs (600 series)**, **Department SOPs**, and **EMS Medical SOPs (MOMs)**,
and to test knowledge with customizable interactive quizzes.

Built as a static site: `index.html` + `app.js` (Tailwind via CDN) + `manifest.json` + `sw.js`.

## Quick start

Any static host works (or just open it locally for a demo):

```bash
cd phfr-sop-ems-hub
python3 -m http.server 8080
# open http://localhost:8080
```

For installability and the service worker to register, serve over `http://localhost`
or HTTPS.

## Features

- **Home** — Quick Access card grid (County SOPs, Department SOPs, MOMs, Quiz, Progress, Admin).
- **Library** — three tabs with every County 600-series SOP, Department SOPs, and MOMs;
  each entry opens a study summary with a "Study & Quiz on this topic" button.
- **Auth** — create a profile with first name + 4-digit PIN (PINs are SHA-256 hashed
  with a per-profile salt via `crypto.subtle`). Sign-in, sign-out, guest browsing.
  Quizzes require a signed-in profile.
- **Quiz engine** — category (County / Department / MOMs / Mixed), 5–100 questions,
  randomized order and options, instant feedback with explanations, progress bar,
  80% pass threshold, missed-question review, results saved to the profile.
- **My Progress** — totals, averages, best score, per-category bars, recent-scores
  chart (inline SVG), full history table, clear-history.
- **Admin Portal** (training captains):
  - First visit forces creation of an admin password (min 8 chars, salted hash).
  - **Dashboard** — per-user quiz counts, averages, last test date, expandable history.
  - **Users** — add member (name + PIN), reset PIN, remove member (+ their history).
  - **Documents** — upload `.txt`/`.md` (or `.pdf` with in-browser PDF.js text
    extraction); generate draft quiz questions from the text; review/edit/delete
    each draft before publishing to a category bank.
  - **Data** — export/import JSON backup (merge on import), export scores CSV,
    reset all data (double-confirmed).
- **Dark/light mode** toggle, persisted. Fully responsive.

## Question banks (built in)

| Bank | Questions |
|---|---|
| County SOPs (600 series) | 40 |
| Department SOPs (SOP 100 + general) | 25 |
| EMS MOMs (general protocol knowledge) | 30 |

All questions are written in original words for training purposes. SOP numbers and
titles are factual references; no passages are quoted from source documents.

## Admin: how question generation works

1. Upload a reference (`.txt`, `.md`, or `.pdf`) in **Admin → Documents**.
2. Click **Generate questions** on the uploaded document.
3. The generator finds sentences containing repeated key terms, blanks the term,
   and builds 3 distractors from other key terms in the same document
   (up to 10 drafts).
4. Review each draft: edit the wording/options/explanation, pick the correct
   answer, or delete it. Then **Publish to question bank** — published questions
   join that category's bank and appear in future quizzes.

## Updating the MOM link

The "Open current MOM document" button in the MOMs tab uses the constant `MOM_URL`
at the top of `app.js`. If the county changes the file location, update that one
line and redeploy:

```js
const MOM_URL = 'https://pcemsomd.com/...';
```

## Firebase cloud sync (optional)

The app is local-first (everything in `localStorage` under key `phfr_hub_v1`) and
works with no backend. To sync profiles, quiz results, and deletion tombstones
to Firestore (so members keep progress across devices and the Admin Portal sees
everyone):

1. Create a Firebase project at https://console.firebase.google.com and add a
   Web App (`</>`); copy the config values into `firebase-config.js`
   (replace the `PASTE_…` placeholders).
2. In the console: **Build > Firestore Database > Create database**.
3. **Build > Authentication > Sign-in method** > enable **Anonymous**.
4. **Firestore Database > Rules**: paste the contents of `firestore.rules`
   (in this repo) and **Publish**. The app uses collections `phfr_profiles`,
   `phfr_results`, and `phfr_tombstones` — they are created automatically on
   first sync; no manual collection setup needed.
5. Redeploy — `app.js` detects the config, loads the Firebase compat SDKs,
   signs in anonymously, pulls cloud records once at startup (additive merge
   by id, honoring deletion tombstones), and pushes local changes with a
   short debounce. The Admin Portal's **☁️ Cloud** tab shows sync status,
   cloud counts, and a manual "Sync now" button.

> Privacy trade-off: any signed-in app session can read member names and quiz
> scores (that's what makes cross-device sign-in and the admin dashboard work).
> PINs are salted SHA-256 hashes verified on-device — the raw PIN never leaves
> the member's phone.

## PWA / offline notes

- `manifest.json` uses icons generated from the department shield
  (`assets/icon-192.png`, `assets/icon-512.png`).
- `sw.js` caches the app shell (HTML/JS/manifest/assets) with a versioned cache
  (`phfr-hub-v1` — bump it when shipping updates) and serves `index.html` for
  navigations when offline.
- Tailwind CSS and PDF.js load from CDNs, so those features need a network
  connection on first use; everything else works offline after the first load.
  For a fully offline build, the Tailwind CDN could be replaced with a compiled
  stylesheet as a future build step.

## Data & privacy

- Profiles, PIN hashes, quiz results, uploads, and custom questions live in the
  browser's `localStorage` on the device. Clearing site data erases them.
- PINs and the admin password are never stored in plain text (SHA-256 + salt).
- Export JSON from **Admin → Data** for backups before switching devices.

## Disclaimer

For official Palm Harbor Fire Rescue use only. Always defer to current SOPs and
Pinellas County EMS protocols. This is a training aid, not a substitute for the
official documents.
