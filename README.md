# NextBus – Barrie Transit Real-Time Departures

## Overview
NextBus is a Next.js web app for displaying real-time and scheduled departure times for Barrie Transit stops. It prioritizes real-time GTFS data, falls back to static schedules, and uses paired-route logic to maximize live coverage. Users can save and load custom stop configurations.

---

## Features
- **Real-time departures** (GTFS-RT TripUpdates feed)
- **Static schedule fallback** (GTFS static data)
- **Paired-direction estimation** for A/B routes (e.g., 2A/2B, 7A/7B, 12A/12B, 8A/8B)
- **One row per trip/route/stop** (no duplicates)
- **Save/load/delete stop configurations** (localStorage)
- **Suggested presets** (e.g., Georgian College)
- **Auto-refresh** (every 15s – value centralised in `APP_CONFIG`)
- **Visual indicators** for real-time, static, paired estimates
- **Virtual scrolling** via `react-window` for large stop sets
- **Offline-friendly** – service-worker caches GTFS-static & app shell
- **Type-safe API layer** – generic `APIResponse<T>` everywhere
- **Full lint/format/test toolchain** (ESLint + Prettier + Jest + RTL)
- **Debug/test scripts** for data validation

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```sh
npm install
```

### Running Locally
First install deps (includes git hooks / lint-staged):
```sh
npm install
# optional – set up Husky hooks (if not auto-run)
npx husky install
```

Start the dev server on port 3020 (the app will auto-open in your browser):
```sh
start http://localhost:3020 && npm run dev -- -p 3020
```
Then open [http://localhost:3020](http://localhost:3020) if it does not open automatically.

> **Note:** If you see an error like `Invalid project directory provided`, use `npm run dev -- -p 3010` (with double dashes before `-p`).

---

## Usage
- Enter stop codes to view departures.
- Use the suggested configuration (e.g., "Georgian College") for quick access.
- Save/load/delete your favorite stop sets (stored in your browser).
- Real-time rows are shown in blue, static in gray, paired estimates with a `~paired` label.

---

## Configuration
- **Stop codes**: Input as a comma-separated list.
- **Presets**: See `SUGGESTED_CONFIGS` in `src/app/page.tsx`.
- **Pairing logic**: See `ROUTE_PAIRS` and direction inference in `src/components/TransitBoard.tsx`.

---

## Data Sources
- **Real-time**: [myridebarrie.ca/gtfs/GTFS_TripUpdates.pb](http://www.myridebarrie.ca/gtfs/GTFS_TripUpdates.pb)
- **Static**: GTFS static files (see `src/lib/gtfs-static.ts`)

---

## Troubleshooting
- **Port in use**: If port 3010 is busy, kill the process or use another port: `npm run dev -- -p 3020`
- **No real-time data**: Check GTFS feed status; stale data is flagged in the UI.
- **Too much static**: The app always prefers real-time; static is only shown if no real-time is available for a trip/route/stop.

---

## Testing & Debugging

### Automated tests
```sh
npm test        # Jest (unit + integration via jsdom)
npm run lint    # ESLint & Prettier checks
```
• Unit tests live in `tests/services/*` (e.g. route-pairing logic).  
• Integration/component tests use **React Testing Library** under `tests/components/*`.

### Manual / debug scripts
- **Debug scripts**: See `debug-route-400-stop-330.js`, `test-data.js` for validating data and pairing logic.
- **Manual testing**: 
  - Try stops with known real-time (e.g., 330, 331, 335, 329).
  - Confirm that real-time rows always override static.
  - Check that paired estimates are labeled and only appear when direct real-time is missing.

---

## Development Notes
- **Key files**:
  - `src/components/TransitBoard.tsx`: UI + orchestration (heavy logic extracted)
  - `src/services/gtfs/routePairing.ts`: Business logic for paired-route estimation
  - `src/config/app.ts`: Central app constants (refresh rate, cache duration, etc.)

---

## Contributing
- Fork, branch, and PR as usual.
- Please document any new pairing or fallback logic.

---

## License
MIT (or specify)

## Acknowledgments

- Barrie Transit for providing GTFS data
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first CSS framework

## Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/nextbus/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about the issue and steps to reproduce

---

**Note**: This is an unofficial application and is not affiliated with the City of Barrie or Barrie Transit. Transit data is provided by Barrie Transit's public GTFS feeds.

---

## Areas for Improvement

- **README Enhancements**
  - [ ] Add real GitHub repository URL (currently placeholder)
  - [ ] Expand API documentation (endpoints, request/response examples)
  - [ ] Document required environment variables or configuration
  - [ ] Add details on caching strategies and performance/rate limiting

- **Technical Concerns**
  - [ ] Improve error handling for GTFS feed downtime or malformed data
  - [ ] Consider rate limiting or backoff for 15s auto-refresh (especially for public APIs)
  - [ ] Address browser storage limitations (localStorage can be cleared; consider backup/export)
  - [ ] Add accessibility (a11y) notes and improvements

- **Development Workflow**
  - [ ] Add automated test coverage (unit/integration)
  - [ ] Document or implement CI/CD and deployment process
  - [ ] Add code quality tools (linting, formatting, type checks)

  - **(Done)** Automated unit + integration tests (Jest + RTL)
  - Document or implement CI/CD and deployment process
  - **(Done)** Code quality tooling (ESLint, Prettier, lint-staged, Husky)

--- 