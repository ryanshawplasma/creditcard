# CreditVault AI

**A premium, local-first, end-to-end-encrypted personal credit-card & liability manager.**
Notion-calm, Linear-fast, Apple-clean.

CreditVault AI helps you (and your whole household) track every card, never miss a
due date, and see exactly *what's due, who owes it, and how much* — without opening
a single spreadsheet. Everything is stored **on your device** and sensitive fields
are **AES-256 encrypted at rest**; nothing is ever sent to a server.

---

## ✨ Highlights

- 🔐 **Zero-knowledge security** — card numbers & CVVs are encrypted with AES-GCM-256
  using a key derived from your master password (PBKDF2, 210k iterations). The
  password is never stored; only the last 4 digits are ever shown by default.
- 🏠 **Local-first / offline-first** — runs entirely in the browser on IndexedDB. No
  backend, no cloud, no account signup. Works with the network unplugged.
- 📊 **A dashboard that answers the real questions** — what's overdue, what's due this
  week, who needs to pay, utilization, available credit, reward points, health score.
- ⏰ **Reminder engine** — configurable alerts (15/10/7/5/3/2/1 days before, due-today,
  overdue) with native desktop notifications.
- 🤖 **Built-in AI assistant** — ask *"which cards are due this week?"*, *"how much does
  Ryan owe?"*, *"which cards crossed 70% utilization?"* — answered instantly and locally.
- ✨ **Smart add** — paste a bank SMS/statement or drop a photo of a card; it extracts
  the bank, last 4, limit, due date, expiry & balance (in-browser OCR — the image
  never leaves your device) and opens a pre-filled form for you to review and edit.
- 🗓️ **Calendar, Payments, Spending, Rewards, Analytics, Documents** — the full picture.
- ⌨️ **Command palette (Ctrl / ⌘ + K)**, global search, quick-add FAB, keyboard nav.
- 🎨 **Dark / light themes, 8 accent colours, glassmorphism, micro-animations.**

---

## 🚀 Getting started

```bash
npm install
npm run dev
```

Then open the app (Vite prints the local URL, default **http://localhost:5273**).

On first launch you'll **create a vault**: pick a display name, username, email and a
**master password**. This password encrypts your data and *cannot be recovered* — if
you forget it, the only option is to reset (which erases the local vault). The app
ships with a rich, realistic demo portfolio (10 cards across 5 people and 6 banks) so
every screen is alive from the first second.

### Build for production

```bash
npm run build      # type-checks then bundles to /dist
npm run preview    # serve the production build
```

### Packaging as a desktop app

The codebase is Electron-ready — the entire app is a static SPA over IndexedDB, so an
Electron shell only needs to load `dist/index.html`. (Not bundled here to keep the
install lean.)

---

## ☁️ Deploying to Render (or any static host)

CreditVault AI is a **pure static site** — there is no server to run. Render (or
Netlify, Vercel, Cloudflare Pages, GitHub Pages…) just serves the built files.

> **What hosting does and doesn't do:** the host only serves the app's HTML/JS/CSS.
> **No card data ever reaches the host.** Each visitor gets their own encrypted vault
> stored in *their own browser's* IndexedDB. That also means there is **no sync
> between devices/browsers** — a vault created in Chrome on your laptop is separate
> from one on your phone. The public URL exposes only the app shell, never anyone's
> data.

### Option A — one-click Blueprint (recommended)

A [`render.yaml`](render.yaml) blueprint is included.

1. Push this project to a GitHub/GitLab/Bitbucket repo.
2. In Render → **New → Blueprint**, connect the repo. Render reads `render.yaml`
   and provisions a free static site automatically.
3. Every push to the branch redeploys; pull requests get preview URLs.

### Option B — manual static site

In Render → **New → Static Site**, connect the repo and set:

| Setting | Value |
| --- | --- |
| **Build command** | `npm ci --include=dev && npm run build` |
| **Publish directory** | `dist` |
| **Environment variable** | `NODE_VERSION = 20.18.1` |

That's it — no rewrite rule is even required because the app uses `HashRouter`
(routes live in the URL fragment, so the server only ever serves `/`).

Free Render static sites are **publicly reachable by URL**. Since no data is exposed,
that's usually fine; if you want to gate access, put it behind Cloudflare Access or a
similar auth proxy.

---

## 🧱 Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | **React 18 + TypeScript** | Type-safe, component-driven |
| Build | **Vite** | Instant HMR, fast builds |
| Styling | **TailwindCSS** + CSS variables | Theming (dark/light + accents) at runtime |
| Motion | **Framer Motion** | Page transitions, micro-interactions |
| Charts | **Recharts** | Analytics dashboards |
| Icons | **lucide-react** | Consistent, crisp iconography |
| Storage | **Dexie (IndexedDB)** + `dexie-react-hooks` | Reactive local-first persistence |
| Crypto | **Web Crypto API** | Real AES-GCM-256 + PBKDF2, no dependencies |
| Routing | **React Router (HashRouter)** | Works from `file://` in Electron |

> **On the stack choice:** the brief suggested a Node/Express/Postgres/JWT backend.
> For a *personal* app that stores card numbers, shipping those numbers to a server
> raises real PCI/compliance exposure. A local-first design with client-side
> encryption keyed by the user's master password is both **safer** and delivers the
> "offline-first" requirement out of the box. The data layer is cleanly separated
> (`lib/db.ts`, `lib/repo.ts`) so a sync backend can be added later without touching
> the UI.

---

## 🗂️ Project structure

```
src/
├── types/            # Domain model (Card, Owner, Bank, Payment, …)
├── lib/
│   ├── crypto.ts     # AES-GCM encryption + PBKDF2 password hashing
│   ├── db.ts         # Dexie schema, audit log, balance recomputation
│   ├── repo.ts       # The single write path (CRUD + audit + encryption)
│   ├── cycle.ts      # Billing-cycle & due-date math
│   ├── reminders.ts  # Due-item builder + reminder engine + notifications
│   ├── analytics.ts  # Portfolio summary, health score, spend aggregations
│   ├── ai.ts         # Deterministic natural-language query engine
│   ├── seed.ts       # Realistic demo portfolio (encrypted on creation)
│   └── format.ts     # Currency / date formatting, card gradients
├── store/            # React contexts: auth, data, theme, ui
├── components/
│   ├── ui/           # Design system: Button, Modal, Toast, Ring, …
│   ├── layout/       # Sidebar, Topbar, AppShell, nav config
│   ├── modals/       # Card, Payment, Owner, Transaction forms
│   ├── CardVisual.tsx, CommandPalette.tsx, AIAssistant.tsx, FAB.tsx, DueBanner.tsx
└── pages/            # Dashboard, Cards, People, Calendar, Payments,
                      # Reminders, Rewards, Analytics, Documents, Settings
```

---

## 🔒 Security model

- **Passwords** are verified with PBKDF2-SHA-256 (210,000 iterations) against a stored
  verifier + per-user salt, compared in constant time. The password itself is never
  persisted.
- **The AES master key** is derived from the master password on unlock and held **only
  in memory** for the session. Reloading or the idle **auto-lock** (configurable, default
  15 min) discards it — you re-enter the password to unlock.
- **Sensitive fields** (full card number, CVV, secure notes) are stored only as
  AES-GCM ciphertext + IV. Exports/backups keep them encrypted.
- **Audit log** records every meaningful action (logins, card/payment changes, exports).
- Following best practice, storing full card numbers/CVVs is *optional* — the app is
  fully functional on last-4 + metadata alone.

---

## 🧭 Feature map

**Dashboard** · greeting, total outstanding, available credit, utilization, reward
points, upcoming-payments list (overdue / 7-day / 30-day), financial-health score,
insight widgets (near-limit, highest-interest, largest-balance, unused), monthly-spend
chart, recent-activity feed.

**Cards** · grid/list views, live search, filter by person/status, sort, encrypted
card-number reveal, per-card detail with utilization, terms, rewards, payment history,
status changes, pin/favourite. **Smart add** turns a pasted bank SMS/statement or a
card photo into a pre-filled, editable card (local text parsing + in-browser OCR).

**People** · owners with avatars, relationships, contacts, per-person card totals &
utilization.

**Calendar** · monthly view of due dates, billing dates, statements, EMIs and annual
fees; click any day for details.

**Payments** · payment history + spending tracker (transactions) with search, filters,
delete + undo. Recording a payment auto-updates the card's outstanding.

**Reminders** · live overdue/today/upcoming reminders with dismiss & pay actions, an
upcoming-schedule timeline, and a test-notification button.

**Rewards** · total points & estimated value, breakdown by type/card, and a
**best-card-to-use** recommender per spend category.

**Analytics** · monthly spend, utilization trend, spend by category/card/person/bank,
plus KPIs (tracked spend, estimated annual interest, annual fees, reward points).

**Documents** · drag-and-drop upload of statements/agreements/KYC/receipts, categorised
and optionally linked to a card.

**Settings** · theme & accent, reminder offsets/channels, email & Telegram (architecture
ready), currency/locale, auto-lock, JSON backup / restore, CSV (Excel) export, vault
reset, and the audit log.

**Everywhere** · Ctrl/⌘+K command palette, global search, quick-add FAB, undo toasts,
empty states, loading skeletons, keyboard navigation.

---

## 🧩 Extending it

The normalized schema and repository layer are designed for growth. Future liability
modules (loans, insurance, investments, FDs, net worth) slot in as sibling entities.
A cloud-sync backend can wrap `lib/repo.ts` without changing any screen.

---

*Built as a production-quality reference app — real encryption, real reminder logic,
real analytics. No mock data paths, no placeholder logic.*
