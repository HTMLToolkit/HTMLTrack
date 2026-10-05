# HTMLTrack

A parcel tracking web app. Add tracking numbers, see live status, delivery
windows and a map of every destination.

- **Frontend** (`Build/`): React 18 + Vite, installable as a PWA
- **Backend** (`Backend/`): Cloudflare Worker that proxies the
  [17Track](https://api.17track.net/en/doc) API so the API key stays server-side

## Features

- **Persistence**: parcels live in IndexedDB (with a `localStorage` fallback),
  so they survive a refresh. Swappable for a hosted store behind the same
  `PackageStore` interface in `Build/src/lib/storage.ts`.
- **Delivery map**: MapLibre GL with Esri's Canvas Light/Dark Gray basemaps. No
  API key or billing required. Markers are colour-coded by status and follow the
  app theme.
- **Delivery estimates**: estimated delivery window with a relative countdown
  ("tomorrow", "in 3 days").
- **Event timeline**: full scan history per parcel, not just the latest status.
- **Carrier auto-detect**: infers UPS/FedEx/USPS/DHL/Amazon from the number
  format. Ambiguous numbers fall back to letting 17Track decide.
- **Auto-refresh**: active parcels re-check every 5 minutes via a single
  batched request instead of one request per parcel.

## Getting started

You need a 17Track API key. Copy the env template and add it:

```bash
cd Backend
cp .dev.vars.example .dev.vars   # then set TRACK_API_KEY=...
```

Run both halves in separate terminals:

```bash
cd Backend  && npm install && npm run dev   # http://127.0.0.1:8787
cd Build    && npm install && npm run dev   # http://127.0.0.1:5173
```

The Vite dev server proxies `/api` to the worker, so there is nothing else to
configure locally.

### Working on the UI without an API key

```bash
cd Build && VITE_MOCK_API=true npm run dev
```

This renders realistic sample parcels and makes no network calls.

## API

| Method | Path                 | Purpose                                    |
| ------ | -------------------- | ------------------------------------------ |
| `GET`  | `/api/health`        | Liveness check                             |
| `POST` | `/api/track`         | Track a single parcel                      |
| `POST` | `/api/track/batch`   | Track up to 40 parcels in one request      |

`/api/track/batch` returns `{ results: [...] }`, where each entry is either a
tracking result or `{ trackingNumber, error, status }` if that parcel failed.
Per-parcel failures do not fail the whole batch.

## Deploying

`Build/` is deployed to GitHub Pages by `.github/workflows/build.yml`.

The **backend is not deployed by CI**. Run `cd Backend && npm run deploy`
(wrangler) yourself, then point `VITE_API_URL` at the deployed worker.

## Notes

- Carriers can be restricted per account by 17Track. If registration fails with
  a policy message, that carrier is unavailable on your key, and the app surfaces
  the provider's own wording rather than a generic error.
- Map tiles come from Esri's public Canvas basemap endpoints. They need no key,
  but they are Esri's free public service and are not covered by an SLA.
- CARTO is available as an alternative by setting `VITE_CARTO_API_KEY`. Without
  that key CARTO's endpoints now return a placeholder tile rather than map data.

## License

MIT
