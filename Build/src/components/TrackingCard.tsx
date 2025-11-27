import React from 'react';
import { CheckCircle2, Loader, AlertCircle, Clock, MapPin, Calendar } from 'lucide-react';
import styles from './TrackingCard.module.css';

interface TrackingPackage {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  lastUpdate: Date;
  destination?: string;
  estimatedDelivery?: Date;
}

interface TrackingCardProps {
  package: TrackingPackage;
}

export default function TrackingCard({ package: pkg }: TrackingCardProps) {
  const getStatusIcon = () => {
    switch (pkg.status) {
      case 'delivered':
        return <CheckCircle2 size={24} className={styles.statusIconSuccess} />;
      case 'in_transit':
        return <Loader size={24} className={styles.statusIconActive} />;
      case 'failed':
        return <AlertCircle size={24} className={styles.statusIconError} />;
      default:
        return <Clock size={24} className={styles.statusIconPending} />;
    }
  };

  const getStatusLabel = () => {
    const labels: Record<string, string> = {
      'pending': 'Pending',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'failed': 'Failed'
    };
    return labels[pkg.status] || pkg.status;
  };

  const getStatusColor = () => {
    switch (pkg.status) {
      case 'delivered':
        return styles.statusDelivered;
      case 'in_transit':
        return styles.statusInTransit;
      case 'failed':
        return styles.statusFailed;
      default:
        return styles.statusPending;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`${styles.card} ${getStatusColor()}`}>
      <div className={styles.header}>
        <div className={styles.statusBadge}>
          {getStatusIcon()}
          <span>{getStatusLabel()}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.trackingSection}>
          <label className={styles.label}>Tracking Number</label>
          <code className={styles.trackingNumber}>{pkg.trackingNumber}</code>
        </div>

        <div className={styles.carrierSection}>
          <label className={styles.label}>Carrier</label>
          <p className={styles.carrier}>{pkg.carrier}</p>
        </div>

        {pkg.destination && (
          <div className={styles.infoRow}>
            <MapPin size={16} />
            <div>
              <label className={styles.label}>Destination</label>
              <p className={styles.info}>{pkg.destination}</p>
            </div>
          </div>
        )}

        {pkg.estimatedDelivery && (
          <div className={styles.infoRow}>
            <Calendar size={16} />
            <div>
              <label className={styles.label}>Est. Delivery</label>
              <p className={styles.info}>{formatDate(pkg.estimatedDelivery)}</p>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.lastUpdate}>
            Updated {formatDate(pkg.lastUpdate)}
          </span>
        </div>
      </div>
    </div>
  );
}