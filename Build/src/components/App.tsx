import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import MainContent from './MainContent';
import styles from './App.module.css';

interface TrackingPackage {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  lastUpdate: Date;
  destination?: string;
  estimatedDelivery?: Date;
}

export default function App() {
  const [packages, setPackages] = useState<TrackingPackage[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    updateTheme(prefersDark);
  }, []);

  const updateTheme = (dark: boolean) => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    updateTheme(newDark);
  };

  const addPackage = (pkg: TrackingPackage) => {
    setPackages([...packages, pkg]);
  };

  const removePackage = (id: string) => {
    setPackages(packages.filter(p => p.id !== id));
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <h1>HTMLTrack</h1>
          </div>
          <button 
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <MainContent 
          packages={packages}
          onAddPackage={addPackage}
          onRemovePackage={removePackage}
        />
      </main>
    </div>
  );
}