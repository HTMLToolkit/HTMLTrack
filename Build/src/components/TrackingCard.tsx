import { useState } from 'react';
import {
  CheckCircle2,
  Truck,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  ChevronDown,
  Trash2,
  Navigation,
} from 'lucide-react';
import type { PackageStatus, TrackingPackage } from '../types/tracking';
import { STATUS_LABELS } from '../types/tracking';
import {
  statusColor,
  formatRelative,
  formatDeliveryWindow,
  daysUntil,
} from '../lib/format';
import styles from './TrackingCard.module.css';

const ICONS: Record<PackageStatus, typeof Clock> = {
  pending: Clock,
  in_transit: Truck,
  out_for_delivery: Navigation,
  delivered: CheckCircle2,
  failed: AlertCircle,
};

interface TrackingCardProps {
  package: TrackingPackage;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export default function TrackingCard({
  package: pkg,
  selected,
  onSelect,
  onRemove,
}: TrackingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[pkg.status] ?? Clock;
  const color = statusColor(pkg.status);
  const window = formatDeliveryWindow(
    pkg.estimatedDelivery,
    pkg.estimatedDeliveryTo,
  );
  const days = daysUntil(pkg.estimatedDelivery);
  const waiting = pkg.status === 'pending';
  const checked = formatRelative(pkg.lastCheckedAt ?? pkg.lastUpdate);

  return (
    <article
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      style={{ ['--accent' as string]: color }}
    >
      <button
        type="button"
        className={styles.summary}
        onClick={onSelect}
        aria-expanded={selected}
      >
        <span className={styles.iconWrap} style={{ background: color }}>
          <Icon size={18} />
        </span>

        <span className={styles.meta}>
          <span className={styles.carrier}>{pkg.carrier}</span>
          <code className={styles.trackingNumber}>{pkg.trackingNumber}</code>
        </span>

        <span className={styles.statusGroup}>
          <span className={styles.badge} style={{ color, borderColor: color }}>
            {waiting ? 'Waiting' : STATUS_LABELS[pkg.status]}
          </span>
          <span className={styles.updated}>{checked}</span>
        </span>
      </button>

      <div className={styles.body}>
        {waiting ? (
          <p className={styles.waitingNote}>
            No scans reported yet. This refreshes automatically every 45 seconds
            until the carrier reports movement.
          </p>
        ) : (
          <>
            {pkg.destination && (
              <div className={styles.infoRow}>
                <MapPin size={15} />
                <span className={styles.info}>{pkg.destination}</span>
                {pkg.coordinates && (
                  <span className={styles.mapped} title="Shown on the map">
                    mapped
                  </span>
                )}
              </div>
            )}

            {window && (
              <div className={styles.infoRow}>
                <Calendar size={15} />
                <span className={styles.info}>{window}</span>
                {days !== null && days >= 0 && (
                  <span className={styles.eta}>
                    {days === 0
                      ? 'today'
                      : days === 1
                        ? 'tomorrow'
                        : `in ${days} days`}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {pkg.lastError && (
          <p className={styles.error} role="alert">
            {pkg.lastError}
          </p>
        )}

        {pkg.events.length > 0 && (
          <>
            <button
              type="button"
              className={styles.timelineToggle}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {pkg.events.length} event{pkg.events.length === 1 ? '' : 's'}
              <ChevronDown
                size={15}
                className={expanded ? styles.chevronOpen : undefined}
              />
            </button>

            {expanded && (
              <ol className={styles.timeline}>
                {pkg.events.slice(0, 12).map((event, index) => (
                  <li
                    key={`${event.timestamp}-${index}`}
                    className={styles.event}
                  >
                    <span className={styles.eventDot} />
                    <div>
                      <p className={styles.eventDesc}>{event.description}</p>
                      <p className={styles.eventMeta}>
                        {event.location} · {formatRelative(event.timestamp)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={`Remove parcel ${pkg.trackingNumber}`}
        title="Remove parcel"
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}
