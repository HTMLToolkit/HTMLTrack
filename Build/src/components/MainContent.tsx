import React, { useState } from 'react';
import { Plus, Search, Trash2, MapPin, Clock, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import TrackingForm from './TrackingForm';
import TrackingCard from './TrackingCard';
import styles from './MainContent.module.css';

interface TrackingPackage {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  lastUpdate: Date;
  destination?: string;
  estimatedDelivery?: Date;
}

interface MainContentProps {
  packages: TrackingPackage[];
  onAddPackage: (pkg: TrackingPackage) => void;
  onRemovePackage: (id: string) => void;
}

export default function MainContent({ 
  packages, 
  onAddPackage, 
  onRemovePackage 
}: MainContentProps) {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_transit' | 'delivered' | 'failed'>('all');

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.carrier.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' || pkg.status === filter;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 size={20} className={styles.statusIconSuccess} />;
      case 'in_transit':
        return <Loader size={20} className={styles.statusIconActive} />;
      case 'failed':
        return <AlertCircle size={20} className={styles.statusIconError} />;
      default:
        return <Clock size={20} className={styles.statusIconPending} />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'Pending',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'failed': 'Failed'
    };
    return labels[status] || status;
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by tracking number or carrier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          {(['all', 'in_transit', 'delivered', 'failed'] as const).map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {getStatusLabel(f)}
            </button>
          ))}
        </div>

        <button 
          className={styles.addBtn}
          onClick={() => setShowForm(true)}
        >
          <Plus size={20} />
          Add Package
        </button>
      </div>

      {showForm && (
        <TrackingForm 
          onAdd={(pkg) => {
            onAddPackage(pkg);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total</span>
          <span className={styles.statValue}>{packages.length}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>In Transit</span>
          <span className={styles.statValue}>{packages.filter(p => p.status === 'in_transit').length}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Delivered</span>
          <span className={styles.statValue}>{packages.filter(p => p.status === 'delivered').length}</span>
        </div>
      </div>

      <div className={styles.grid}>
        {filteredPackages.length > 0 ? (
          filteredPackages.map(pkg => (
            <div key={pkg.id} className={styles.packageWrapper}>
              <TrackingCard package={pkg} />
              <button
                className={styles.deleteBtn}
                onClick={() => onRemovePackage(pkg.id)}
                title="Remove package"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            <MapPin size={48} />
            <h3>No packages found</h3>
            <p>
              {packages.length === 0 
                ? 'Add your first package to start tracking'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}