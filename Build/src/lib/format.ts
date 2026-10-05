import type { PackageStatus } from '../types/tracking';

export const STATUS_COLORS: Record<PackageStatus, string> = {
  pending: '#94a3b8',
  in_transit: '#3b82f6',
  out_for_delivery: '#f59e0b',
  delivered: '#10b981',
  failed: '#ef4444',
};

export function statusColor(status: PackageStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDeliveryWindow(
  from?: string,
  to?: string,
): string | null {
  if (!from) return null;

  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (!to) {
    return start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  const end = new Date(to);
  if (Number.isNaN(end.getTime()) || sameDay(start, end)) {
    return start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return `${fmt(start)} to ${fmt(end)}`;
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}
