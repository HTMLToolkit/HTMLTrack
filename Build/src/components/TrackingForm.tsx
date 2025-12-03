import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import styles from './TrackingForm.module.css';

interface TrackingPackage {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  lastUpdate: Date;
  destination?: string;
  estimatedDelivery?: Date;
}

interface TrackingFormProps {
  onAdd: (pkg: TrackingPackage) => void;
  onClose: () => void;
}

const CARRIERS = [
  'UPS',
  'FedEx',
  'USPS',
  'DHL',
  'Amazon Logistics',
  'Other'
];

// Use environment variable, or relative path (for proxy), or fallback to production URL
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development, use relative URL to leverage Vite proxy
  if (import.meta.env.DEV) {
    return '';
  }
  // Production fallback
  return 'https://htmltrack-worker.neeljaiswal23.workers.dev';
};

const API_BASE_URL = getApiUrl();

export default function TrackingForm({ onAdd, onClose }: TrackingFormProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('UPS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trackingNumber.trim()) {
      setError('Please enter a tracking number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`${API_BASE_URL}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, carrier }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to track package');
      }

      const newPackage: TrackingPackage = {
        id: Math.random().toString(36).substr(2, 9),
        trackingNumber: trackingNumber.toUpperCase(),
        carrier,
        status: data.status || 'in_transit',
        lastUpdate: new Date(),
        destination: data.destination,
        estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : undefined
      };

      onAdd(newPackage);
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.');
        } else if (err.message === 'Failed to fetch') {
          setError('Unable to connect to server. Please check your connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Track New Package</h2>
          <button 
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="carrier">Carrier</label>
            <select
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className={styles.select}
            >
              {CARRIERS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tracking">Tracking Number</label>
            <input
              id="tracking"
              type="text"
              placeholder="Enter tracking number..."
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className={styles.input}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
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
                  <Loader size={18} />
                  Tracking...
                </>
              ) : (
                'Track Package'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}