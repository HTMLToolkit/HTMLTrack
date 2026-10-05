export type PackageStatus =
  'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  description: string;
}

export interface TrackingPackage {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: PackageStatus;
  lastUpdate: string;
  addedAt: string;
  destination?: string;
  estimatedDelivery?: string;
  estimatedDeliveryTo?: string;
  coordinates?: Coordinates;
  events: TrackingEvent[];
  lastCheckedAt?: string;
  lastError?: string;
}

export interface TrackResponse {
  trackingNumber: string;
  carrier: string;
  status: PackageStatus;
  lastUpdate: string;
  destination?: string;
  estimatedDelivery?: string;
  estimatedDeliveryTo?: string;
  coordinates?: Coordinates;
  events: TrackingEvent[];
}

export const STATUS_LABELS: Record<PackageStatus, string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed: 'Failed',
};

export const ACTIVE_STATUSES: PackageStatus[] = [
  'pending',
  'in_transit',
  'out_for_delivery',
];
