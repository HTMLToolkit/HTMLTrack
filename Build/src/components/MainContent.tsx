import { useMemo, useState, type ReactNode } from 'react';
import { Search, PackageOpen } from 'lucide-react';
import TrackingCard from './TrackingCard';
import type { PackageStatus, TrackingPackage } from '../types/tracking';
import { STATUS_LABELS } from '../types/tracking';
import styles from './MainContent.module.css';

type Filter = 'all' | PackageStatus;

const FILTERS: Filter[] = [
  'all',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
];

interface MainContentProps {
  packages: TrackingPackage[];
  selectedId: string | null;
  onRemovePackage: (id: string) => void;
  onSelect: (id: string | null) => void;
  banner?: ReactNode;
}

export default function MainContent({
  packages,
  selectedId,
  onRemovePackage,
  onSelect,
  banner,
}: MainContentProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return packages.filter((pkg) => {
      const matchesFilter = filter === 'all' || pkg.status === filter;
      if (!matchesFilter) return false;
      if (!term) return true;

      return (
        pkg.trackingNumber.toLowerCase().includes(term) ||
        pkg.carrier.toLowerCase().includes(term) ||
        (pkg.destination ?? '').toLowerCase().includes(term)
      );
    });
  }, [packages, search, filter]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>();
    for (const f of FILTERS) {
      map.set(
        f,
        f === 'all'
          ? packages.length
          : packages.filter((p) => p.status === f).length
      );
    }
    return map;
  }, [packages]);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search parcel, carrier or destination"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search parcels"
          />
        </div>

        <div className={styles.filters} role="tablist" aria-label="Filter parcels">
          {FILTERS.map((f) => {
            const count = counts.get(f) ?? 0;
            if (f !== 'all' && count === 0) return null;

            return (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
                <span className={styles.filterCount}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {banner}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <PackageOpen size={40} />
          <h3>{packages.length === 0 ? 'No parcels yet' : 'Nothing matches'}</h3>
          <p>
            {packages.length === 0
              ? 'Add a tracking number to see it here.'
              : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((pkg) => (
            <TrackingCard
              key={pkg.id}
              package={pkg}
              selected={pkg.id === selectedId}
              onSelect={() => onSelect(selectedId === pkg.id ? null : pkg.id)}
              onRemove={() => onRemovePackage(pkg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
