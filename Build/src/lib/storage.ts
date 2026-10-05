import type { TrackingPackage } from '../types/tracking';

export interface PackageStore {
  all(): Promise<TrackingPackage[]>;
  put(pkg: TrackingPackage): Promise<void>;
  putMany(pkgs: TrackingPackage[]): Promise<void>;
  replaceAll(pkgs: TrackingPackage[]): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  readonly kind: string;
}

const DB_NAME = 'htmltrack';
const DB_VERSION = 1;
const STORE = 'packages';

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IndexedDbStore implements PackageStore {
  readonly kind = 'indexeddb';
  private db: IDBDatabase | null = null;

  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('addedAt', 'addedAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
    });
    return this.db;
  }

  async all(): Promise<TrackingPackage[]> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readonly');
    const items = await requestToPromise(
      tx.objectStore(STORE).getAll() as IDBRequest<TrackingPackage[]>
    );
    return items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async put(pkg: TrackingPackage): Promise<void> {
    await this.putMany([pkg]);
  }

  async putMany(pkgs: TrackingPackage[]): Promise<void> {
    if (pkgs.length === 0) return;
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    for (const pkg of pkgs) os.put(pkg);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async replaceAll(pkgs: TrackingPackage[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    for (const pkg of pkgs) tx.objectStore(STORE).put(pkg);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

const LS_KEY = 'htmltrack.packages';

class LocalStorageStore implements PackageStore {
  readonly kind = 'localstorage';

  private read(): TrackingPackage[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(items: TrackingPackage[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }

  async all(): Promise<TrackingPackage[]> {
    return this.read().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async put(pkg: TrackingPackage): Promise<void> {
    await this.putMany([pkg]);
  }

  async putMany(pkgs: TrackingPackage[]): Promise<void> {
    const items = this.read();
    for (const pkg of pkgs) {
      const i = items.findIndex((p) => p.id === pkg.id);
      if (i >= 0) items[i] = pkg;
      else items.push(pkg);
    }
    this.write(items);
  }

  async replaceAll(pkgs: TrackingPackage[]): Promise<void> {
    this.write(pkgs);
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((p) => p.id !== id));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(LS_KEY);
  }
}

let store: PackageStore | null = null;

export async function getStore(): Promise<PackageStore> {
  if (store) return store;
  try {
    const candidate = new IndexedDbStore();
    await candidate.all();
    store = candidate;
  } catch {
    store = new LocalStorageStore();
  }
  return store;
}
