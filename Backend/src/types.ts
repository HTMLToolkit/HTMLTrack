export type PackageStatus =
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  description: string;
}
