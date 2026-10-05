import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Moon, RefreshCw, Plus, Trash2, MapPin } from 'lucide-react';
import MainContent from './MainContent';
import TrackingForm from './TrackingForm';
import { getStore } from '../lib/storage';
import { normalizeTrackingNumber } from '../lib/carriers';
import { trackPackage, trackBatch, ApiError, isMockMode, mockSamples } from '../lib/api';
import type { PackageStatus, TrackingPackage } from '../types/tracking';
import { ACTIVE_STATUSES } from '../types/tracking';
import styles from './App.module.css';

const DeliveryMap = lazy(() => import('./DeliveryMap'));

const REFRESH_PENDING_MS = 45 * 1000;
const REFRESH_ACTIVE_MS = 5 * 60 * 1000;
const SETTLE_DELAYS_MS = [12_000, 35_000, 90_000];

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [packages, setPackages] = useState<TrackingPackage[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageKind, setStorageKind] = useState('');
  const packagesRef = useRef<TrackingPackage[]>([]);
  packagesRef.current = packages;

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getStore()
      .then(async (store) => {
        const stored = await store.all();
        if (cancelled) return;
        setPackages(stored);
        setStorageKind(store.kind);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: TrackingPackage[]) => {
    packagesRef.current = next;
    setPackages(next);
    try {
      const store = await getStore();
      await store.replaceAll(next);
    } catch (error) {
      console.error('Failed to persist packages', error);
    }
  }, []);

  const refreshAll = useCallback(
    async (targets?: TrackingPackage[]) => {
      const list = targets ?? packagesRef.current;
      if (list.length === 0) return;

      setRefreshing(true);
      try {
        const updated = new Map<string, TrackingPackage>();

        const applyResults = (
          results: Array<Record<string, unknown>>,
          fallbackByNumber: Map<string, TrackingPackage>
        ) => {
          for (const raw of results) {
            const number = String(raw.trackingNumber ?? '');
            const base = fallbackByNumber.get(number);
            if (!base) continue;

            if (raw.error) {
              updated.set(number, { ...base, lastError: String(raw.error) });
              continue;
            }

            const coords = raw.coordinates as
              | { latitude: number; longitude: number }
              | undefined;

            updated.set(number, {
              ...base,
              status: (raw.status as PackageStatus) ?? base.status,
              lastUpdate: String(raw.lastUpdate ?? base.lastUpdate),
              destination: (raw.destination as string) ?? base.destination,
              estimatedDelivery:
                (raw.estimatedDelivery as string) ?? base.estimatedDelivery,
              estimatedDeliveryTo:
                (raw.estimatedDeliveryTo as string) ??
                base.estimatedDeliveryTo,
              coordinates: coords ?? base.coordinates,
              events: Array.isArray(raw.events)
                ? (raw.events as TrackingPackage['events'])
                : base.events,
              lastError: undefined,
            });
          }
        };

        const fallbackByNumber = new Map(list.map((p) => [p.trackingNumber, p]));

        const batches: TrackingPackage[][] = [];
        for (let i = 0; i < list.length; i += 40) {
          batches.push(list.slice(i, i + 40));
        }

        let usedBatch = false;

        for (const batch of batches) {
          try {
            const results = await trackBatch(
              batch.map((p) => ({
                trackingNumber: p.trackingNumber,
                carrier: p.carrier,
              }))
            );
            usedBatch = true;
            applyResults(
              results as unknown as Array<Record<string, unknown>>,
              fallbackByNumber
            );
          } catch {
            usedBatch = false;
            break;
          }
        }

        if (!usedBatch) {
          await Promise.all(
            list.map(async (pkg) => {
              try {
                const result = await trackPackage(pkg.trackingNumber, pkg.carrier);
                applyResults([result as unknown as Record<string, unknown>], fallbackByNumber);
              } catch (error) {
                const message =
                  error instanceof ApiError ? error.message : 'Refresh failed';
                updated.set(pkg.trackingNumber, { ...pkg, lastError: message });
              }
            })
          );
        }

        const nowIso = new Date().toISOString();
        const next = packagesRef.current.map((p) => {
          const fresh = updated.get(p.trackingNumber);
          return fresh ? { ...fresh, lastCheckedAt: nowIso } : p;
        });
        await persist(next);
      } finally {
        setRefreshing(false);
      }
    },
    [persist]
  );

  const refreshRef = useRef(refreshAll);
  refreshRef.current = refreshAll;

  const settleTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    let timer: number | undefined;

    const schedule = () => {
      const active = packagesRef.current.filter((p) =>
        ACTIVE_STATUSES.includes(p.status)
      );
      if (active.length === 0) return;

      const waiting = active.some((p) => p.status === 'pending');
      const delay = waiting ? REFRESH_PENDING_MS : REFRESH_ACTIVE_MS;

      timer = window.setTimeout(async () => {
        if (cancelled) return;
        try {
          await refreshRef.current(active);
        } catch {
          /* keep the schedule alive even if one pass fails */
        }
        if (!cancelled) schedule();
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loaded]);

  useEffect(
    () => () => {
      settleTimersRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const scheduleSettleChecks = useCallback((pkg: TrackingPackage) => {
    settleTimersRef.current.forEach((t) => window.clearTimeout(t));
    settleTimersRef.current = SETTLE_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        const current = packagesRef.current.find((p) => p.id === pkg.id);
        if (current) void refreshRef.current([current]);
      }, delay)
    );
  }, []);

  const addPackage = useCallback(
    async (result: {
      trackingNumber: string;
      carrier: string;
      status: PackageStatus;
      lastUpdate: string;
      destination?: string;
      estimatedDelivery?: string;
      estimatedDeliveryTo?: string;
      coordinates?: { latitude: number; longitude: number };
      events: TrackingPackage['events'];
    }) => {
      const now = new Date().toISOString();
      const canonical = normalizeTrackingNumber(result.trackingNumber);
      const existing = packagesRef.current.find(
        (p) => normalizeTrackingNumber(p.trackingNumber) === canonical
      );

      const pkg: TrackingPackage = {
        id: existing?.id ?? makeId(),
        trackingNumber: result.trackingNumber,
        carrier: result.carrier,
        status: result.status,
        lastUpdate: result.lastUpdate,
        addedAt: existing?.addedAt ?? now,
        destination: result.destination,
        estimatedDelivery: result.estimatedDelivery,
        estimatedDeliveryTo: result.estimatedDeliveryTo,
        coordinates: result.coordinates,
        events: result.events ?? [],
        lastCheckedAt: now,
        lastError: undefined,
      };

      const next = existing
        ? packagesRef.current.map((p) => (p.id === existing.id ? pkg : p))
        : [pkg, ...packagesRef.current];

      await persist(next);
      setSelectedId(pkg.id);
      scheduleSettleChecks(pkg);
      return pkg;
    },
    [persist, scheduleSettleChecks]
  );

  const removePackage = useCallback(
    async (id: string) => {
      const next = packagesRef.current.filter((p) => p.id !== id);
      await persist(next);

      try {
        const store = await getStore();
        await store.remove(id);
      } catch (error) {
        console.error('Failed to delete package', id, error);
      }

      if (selectedId === id) setSelectedId(null);
    },
    [persist, selectedId]
  );

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const activeCount = useMemo(
    () => packages.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    [packages]
  );

  const mappedPackages = useMemo(
    () => packages.filter((p) => p.coordinates),
    [packages]
  );

  const demoMode = isMockMode();

  const loadSamples = useCallback(async () => {
    const now = new Date().toISOString();
    const existing = packagesRef.current;
    const existingByNumber = new Map(existing.map((p) => [p.trackingNumber, p]));

    const seeded: TrackingPackage[] = mockSamples().map((r) => ({
      id: existingByNumber.get(r.trackingNumber)?.id ?? makeId(),
      trackingNumber: r.trackingNumber,
      carrier: r.carrier,
      status: r.status,
      lastUpdate: r.lastUpdate,
      addedAt: existingByNumber.get(r.trackingNumber)?.addedAt ?? now,
      destination: r.destination,
      estimatedDelivery: r.estimatedDelivery,
      estimatedDeliveryTo: r.estimatedDeliveryTo,
      coordinates: r.coordinates,
      events: r.events,
      lastCheckedAt: now,
    }));

    const seededNumbers = new Set(seeded.map((p) => p.trackingNumber));
    const kept = existing.filter((p) => !seededNumbers.has(p.trackingNumber));
    const next = [...seeded, ...kept].sort((a, b) =>
      b.addedAt.localeCompare(a.addedAt)
    );

    await persist(next);
  }, [persist]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <h1>HTMLTrack</h1>
            <span className={styles.tagline}>
              {loaded
                ? `${packages.length} parcel${packages.length === 1 ? '' : 's'} · ${activeCount} in transit`
                : 'Loading your parcels…'}
            </span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => setShowForm(true)}
            >
              <Plus size={18} />
              <span>Add parcel</span>
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => void refreshAll()}
              disabled={refreshing || packages.length === 0}
              aria-label="Refresh all parcels"
              title="Refresh all parcels"
            >
              <RefreshCw
                size={20}
                className={refreshing ? styles.spinning : undefined}
              />
            </button>
            <button
              className={styles.iconBtn}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <MainContent
          packages={packages}
          selectedId={selectedId}
          onRemovePackage={removePackage}
          onSelect={setSelectedId}
          banner={
            <>
              {mappedPackages.length > 0 && (
                <Suspense
                  fallback={
                    <div className={styles.mapPlaceholder}>Loading map…</div>
                  }
                >
                  <DeliveryMap
                    packages={mappedPackages}
                    selectedId={selectedId}
                    isDark={isDark}
                    onSelect={setSelectedId}
                  />
                </Suspense>
              )}

              {packages.length > 0 && mappedPackages.length === 0 && (
                <p className={styles.mapHint}>
                  <MapPin size={15} />
                  The map appears once a carrier reports destination
                  coordinates for a parcel.
                </p>
              )}

              {demoMode && (
                <button
                  type="button"
                  className={styles.demoBtn}
                  onClick={() => void loadSamples()}
                >
                  {packages.length === 0
                    ? 'Load 6 sample parcels'
                    : 'Reset samples'}
                </button>
              )}
            </>
          }
        />

        {showForm && (
          <TrackingForm
            onAdd={addPackage}
            onClose={() => setShowForm(false)}
          />
        )}
      </main>

      <footer className={styles.footer}>
        <span className={styles.storageNote}>
          Saved on this device
          {storageKind === 'indexeddb' ? ' (IndexedDB)' : ''}
        </span>
        {packages.length > 0 && (
          <button
            type="button"
            className={styles.dangerLink}
            onClick={() => void clearAll()}
          >
            <Trash2 size={14} /> Clear all
          </button>
        )}
      </footer>
    </div>
  );

  async function clearAll() {
    const store = await getStore();
    await store.clear();
    await persist([]);
    setSelectedId(null);
  }
}
