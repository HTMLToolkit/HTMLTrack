import type {
  TrackResponse,
  TrackingEvent,
  PackageStatus,
} from '../types/tracking';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return 'https://htmltrack-worker.neeljaiswal23.workers.dev';
}

export const isMockMode = (): boolean =>
  import.meta.env.VITE_MOCK_API === 'true' ||
  import.meta.env.VITE_MOCK_API === '1';

export async function trackPackage(
  trackingNumber: string,
  carrier: string,
  signal?: AbortSignal,
): Promise<TrackResponse> {
  const response = await fetch(`${getApiBase()}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingNumber, carrier }),
    signal,
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('Server returned an unreadable response', 502);
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return normalizeTrackResponse(data as Record<string, unknown>);
}

export type BatchEntry =
  | TrackResponse
  | {
      trackingNumber: string;
      carrier: string;
      error: string;
      status: number;
    };

export async function trackBatch(
  parcels: Array<{ trackingNumber: string; carrier: string }>,
  signal?: AbortSignal,
): Promise<BatchEntry[]> {
  const response = await fetch(`${getApiBase()}/api/track/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parcels }),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(
      `Batch refresh failed (${response.status})`,
      response.status,
    );
  }

  const data = (await response.json()) as { results?: BatchEntry[] };
  return data.results ?? [];
}

function normalizeTrackResponse(raw: Record<string, unknown>): TrackResponse {
  const events = Array.isArray(raw.events) ? raw.events : [];
  return {
    trackingNumber: String(raw.trackingNumber ?? ''),
    carrier: String(raw.carrier ?? ''),
    status: (raw.status as PackageStatus) ?? 'pending',
    lastUpdate: String(raw.lastUpdate ?? new Date().toISOString()),
    destination: raw.destination ? String(raw.destination) : undefined,
    estimatedDelivery: raw.estimatedDelivery
      ? String(raw.estimatedDelivery)
      : undefined,
    estimatedDeliveryTo: raw.estimatedDeliveryTo
      ? String(raw.estimatedDeliveryTo)
      : undefined,
    coordinates: raw.coordinates as TrackResponse['coordinates'],
    events: events.map((e: Record<string, unknown>) => ({
      timestamp: String(e.timestamp ?? ''),
      location: String(e.location ?? 'Unknown'),
      description: String(e.description ?? e.status ?? 'Update'),
    })),
  };
}

const DEMO_PARCELS: Array<{
  trackingNumber: string;
  carrier: string;
  status: PackageStatus;
  city: string;
  lat: number;
  lng: number;
  etaInDays: number | null;
  events: Array<[string, string, string]>;
}> = [
  {
    trackingNumber: '1Z999AA10123456784',
    carrier: 'UPS',
    status: 'out_for_delivery',
    city: 'Seattle, WA, US',
    lat: 47.6062,
    lng: -122.3321,
    etaInDays: 0,
    events: [
      ['4h ago', 'Seattle, WA, US', 'Out for delivery'],
      ['11h ago', 'Kent, WA, US', 'Arrived at facility'],
      ['26h ago', 'Portland, OR, US', 'Departed carrier facility'],
    ],
  },
  {
    trackingNumber: '794658123456',
    carrier: 'FedEx',
    status: 'in_transit',
    city: 'Chicago, IL, US',
    lat: 41.8781,
    lng: -87.6298,
    etaInDays: 2,
    events: [
      ['7h ago', 'Chicago, IL, US', 'In transit to destination'],
      ['30h ago', 'Memphis, TN, US', 'Departed carrier facility'],
    ],
  },
  {
    trackingNumber: 'JD0146000038281520',
    carrier: 'DHL',
    status: 'in_transit',
    city: 'New York, NY, US',
    lat: 40.7128,
    lng: -74.006,
    etaInDays: 4,
    events: [
      ['1d ago', 'New York, NY, US', 'Customs clearance completed'],
      ['3d ago', 'Leipzig, DE', 'Departed origin facility'],
    ],
  },
  {
    trackingNumber: '9274892200000000000000',
    carrier: 'FedEx',
    status: 'delivered',
    city: 'Austin, TX, US',
    lat: 30.2672,
    lng: -97.7431,
    etaInDays: null,
    events: [
      ['2d ago', 'Austin, TX, US', 'Delivered to front door'],
      ['2d ago', 'Austin, TX, US', 'Out for delivery'],
    ],
  },
  {
    trackingNumber: 'TBA303919175005',
    carrier: 'Amazon Logistics',
    status: 'pending',
    city: 'Denver, CO, US',
    lat: 39.7392,
    lng: -104.9903,
    etaInDays: 5,
    events: [
      ['2h ago', 'Denver, CO, US', 'Shipment information sent to carrier'],
    ],
  },
  {
    trackingNumber: '1Z888RR10123456784',
    carrier: 'UPS',
    status: 'failed',
    city: 'Los Angeles, CA, US',
    lat: 34.0522,
    lng: -118.2437,
    etaInDays: null,
    events: [
      ['8h ago', 'Los Angeles, CA, US', 'Delivery attempted, address issue'],
      ['1d ago', 'Ontario, CA, US', 'Arrived at facility'],
    ],
  },
];

export function mockSamples(): TrackResponse[] {
  const now = Date.now();

  return DEMO_PARCELS.map((d) => {
    const ago = (label: string) => {
      const h = Number.parseFloat(label);
      return new Date(now - h * 3600_000).toISOString();
    };
    const eta =
      d.etaInDays === null
        ? undefined
        : new Date(
            now + d.etaInDays * 86_400_000 + 18 * 3600_000,
          ).toISOString();

    return {
      trackingNumber: d.trackingNumber,
      carrier: d.carrier,
      status: d.status,
      lastUpdate: ago(d.events[0][0]),
      destination: d.city,
      estimatedDelivery: eta,
      estimatedDeliveryTo: eta
        ? new Date(new Date(eta).getTime() + 86_400_000).toISOString()
        : undefined,
      coordinates: { latitude: d.lat, longitude: d.lng },
      events: d.events.map(([when, location, description]) => ({
        timestamp: ago(when),
        location,
        description,
      })),
    };
  });
}

const CITIES: Array<{ city: string; lat: number; lng: number }> = [
  { city: 'New York, NY, US', lat: 40.7128, lng: -74.006 },
  { city: 'Los Angeles, CA, US', lat: 34.0522, lng: -118.2437 },
  { city: 'Chicago, IL, US', lat: 41.8781, lng: -87.6298 },
  { city: 'Seattle, WA, US', lat: 47.6062, lng: -122.3321 },
  { city: 'Austin, TX, US', lat: 30.2672, lng: -97.7431 },
  { city: 'Denver, CO, US', lat: 39.7392, lng: -104.9903 },
];

function seedFrom(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

export function mockTrack(
  trackingNumber: string,
  carrier: string,
): TrackResponse {
  const seed = seedFrom(trackingNumber);
  const place = CITIES[seed % CITIES.length];
  const statusRoll = seed % 10;
  const status: PackageStatus =
    statusRoll < 2
      ? 'delivered'
      : statusRoll < 4
        ? 'out_for_delivery'
        : statusRoll < 6
          ? 'pending'
          : statusRoll < 9
            ? 'in_transit'
            : 'failed';

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

  const events: TrackingEvent[] = [
    {
      timestamp: hoursAgo(4),
      location: place.city,
      description: 'Out for delivery',
    },
    {
      timestamp: hoursAgo(11),
      location: 'Louisville, KY, US',
      description: 'Arrived at facility',
    },
    {
      timestamp: hoursAgo(26),
      location: 'Dallas, TX, US',
      description: 'Departed carrier facility',
    },
    {
      timestamp: hoursAgo(52),
      location: 'Origin scan',
      description: 'Shipment information sent to carrier',
    },
  ];

  const eta =
    status === 'delivered'
      ? undefined
      : new Date(now + (seed % 5) * 86_400_000 + 3600_000).toISOString();

  return {
    trackingNumber,
    carrier,
    status,
    lastUpdate: hoursAgo(4),
    destination: place.city,
    estimatedDelivery: eta,
    estimatedDeliveryTo: eta
      ? new Date(new Date(eta).getTime() + 86_400_000).toISOString()
      : undefined,
    coordinates: { latitude: place.lat, longitude: place.lng },
    events,
  };
}
