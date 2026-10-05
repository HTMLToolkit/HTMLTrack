import { useMemo, useState } from 'react';
import { X, Loader } from 'lucide-react';
import { trackPackage, ApiError, isMockMode, mockTrack } from '../lib/api';
import {
  CARRIERS,
  OTHER_CARRIER,
  detectCarrier,
  normalizeTrackingNumber,
} from '../lib/carriers';
import type { PackageStatus } from '../types/tracking';
import styles from './TrackingForm.module.css';

interface TrackResult {
  trackingNumber: string;
  carrier: string;
  status: PackageStatus;
  lastUpdate: string;
  destination?: string;
  estimatedDelivery?: string;
  estimatedDeliveryTo?: string;
  coordinates?: { latitude: number; longitude: number };
  events: Array<{
    timestamp: string;
    location: string;
    description: string;
  }>;
}

interface TrackingFormProps {
  onAdd: (result: TrackResult) => Promise<unknown> | void;
  onClose: () => void;
}

const mock = isMockMode();

export default function TrackingForm({ onAdd, onClose }: TrackingFormProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState(OTHER_CARRIER);
  const [carrierTouched, setCarrierTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalized = useMemo(
    () => normalizeTrackingNumber(trackingNumber),
    [trackingNumber],
  );

  const detected = useMemo(
    () => (normalized.length >= 6 ? detectCarrier(normalized) : null),
    [normalized],
  );

  const effectiveCarrier = carrierTouched
    ? carrier
    : (detected?.name ?? OTHER_CARRIER);

  const handleNumberChange = (value: string) => {
    setTrackingNumber(value);
    setError('');
    if (!carrierTouched) {
      const next = detectCarrier(normalizeTrackingNumber(value));
      if (next) setCarrier(next.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalized) {
      setError('Enter a tracking number to continue.');
      return;
    }
    if (normalized.length < 6) {
      setError('That tracking number looks too short.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      const result = mock
        ? await new Promise<TrackResult>((resolve) =>
            window.setTimeout(
              () =>
                resolve({
                  ...mockTrack(normalized, effectiveCarrier),
                  carrier: effectiveCarrier,
                }),
              650,
            ),
          )
        : await trackPackage(normalized, effectiveCarrier, controller.signal);

      window.clearTimeout(timeout);
      await onAdd(result);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The tracking provider took too long to respond. Try again.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(
          err.message === 'Failed to fetch'
            ? 'Cannot reach the tracking service. Is the backend running?'
            : err.message,
        );
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-title"
      >
        <div className={styles.header}>
          <h2 id="track-title">Track a parcel</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {mock && (
          <p className={styles.mockNotice}>
            Demo mode with sample data, no API calls.
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="tracking">Tracking number</label>
            <input
              id="tracking"
              className={styles.input}
              value={trackingNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              placeholder="1Z999AA10123456784"
              disabled={loading}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {detected && (
              <span className={styles.hint}>
                Looks like a {detected.name} number
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="carrier">Carrier</label>
            <select
              id="carrier"
              className={styles.select}
              value={effectiveCarrier}
              onChange={(e) => {
                setCarrierTouched(true);
                setCarrier(e.target.value);
              }}
              disabled={loading}
            >
              <option value={OTHER_CARRIER}>Auto-detect</option>
              {CARRIERS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              {CARRIERS.find((c) => c.name === effectiveCarrier)?.hint ??
                'Let the carrier guess from the number'}
            </span>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={16} className={styles.spin} />
                  Tracking…
                </>
              ) : (
                'Add parcel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
