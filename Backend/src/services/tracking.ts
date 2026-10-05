import type { PackageStatus, TrackingEvent, Coordinates } from '../types';

export interface TrackingResult {
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

export interface BatchItem {
  trackingNumber: string;
  carrier: string;
}

export type BatchResult =
  | ({ trackingNumber: string; carrier: string } & TrackingResult)
  | {
      trackingNumber: string;
      carrier: string;
      error: string;
      status: number;
    };

export interface TrackingService {
  trackPackage(
    trackingNumber: string,
    carrier: string,
    apiKey: string,
  ): Promise<TrackingResult>;
  trackBatch(items: BatchItem[], apiKey: string): Promise<BatchResult[]>;
}

export class TrackingError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = 'TrackingError';
    this.status = status;
    this.code = code;
  }
}

const API_BASE = 'https://api.17track.net/track/v2.2';

const CARRIER_CODES: Record<string, number> = {
  UPS: 100003,
  FedEx: 100002,
  USPS: 21051,
  DHL: 100001,
  'Amazon Logistics': 190271,
};

const NOT_REGISTERED_CODE = -18019902;

const ALREADY_REGISTERED =
  /has been registered|already registered|don't need to repeat registration/i;

function isBenignRejection(message: string): boolean {
  return ALREADY_REGISTERED.test(message);
}

const STATUS_MAP: Record<string, PackageStatus> = {
  InfoReceived: 'pending',
  InTransit: 'in_transit',
  OutForDelivery: 'out_for_delivery',
  AvailableForPickup: 'out_for_delivery',
  Delivered: 'delivered',
  Exception: 'failed',
  Expired: 'failed',
  NotFound: 'pending',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiEnvelope {
  code: number;
  data: {
    accepted?: Array<Record<string, any>>;
    rejected?: Array<{
      number: string;
      error: { code: number; message: string };
    }>;
  };
}

async function callApi(
  endpoint: string,
  payload: unknown,
  apiKey: string,
): Promise<ApiEnvelope> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      '17token': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[17Track] ${endpoint} failed`, response.status, text);
    throw new TrackingError('Tracking provider is unavailable', 502);
  }

  return (await response.json()) as ApiEnvelope;
}

function firstRejection(envelope: ApiEnvelope) {
  return envelope.data?.rejected?.[0];
}

function mapEvents(trackInfo: Record<string, any>): TrackingEvent[] {
  const providers = trackInfo.tracking?.providers ?? [];
  const events: TrackingEvent[] = [];

  for (const provider of providers) {
    for (const event of provider.events ?? []) {
      if (!event?.time_utc && !event?.time_iso) continue;
      events.push({
        timestamp: event.time_utc ?? event.time_iso,
        location: event.location ?? 'Unknown',
        description: event.description ?? 'Update',
      });
    }
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function buildResult(
  trackInfo: Record<string, any>,
  trackingNumber: string,
  carrier: string,
): TrackingResult {
  const latestStatus = trackInfo.latest_status?.status ?? 'NotFound';
  const status = STATUS_MAP[latestStatus] ?? 'pending';
  const latestEvent = trackInfo.latest_event;

  const result: TrackingResult = {
    trackingNumber,
    carrier,
    status,
    lastUpdate: latestEvent?.time_utc ?? new Date().toISOString(),
    events: mapEvents(trackInfo),
  };

  const recipient = trackInfo.shipping_info?.recipient_address;
  if (recipient?.city || recipient?.state || recipient?.country) {
    result.destination = [recipient.city, recipient.state, recipient.country]
      .filter(Boolean)
      .join(', ');
  }

  const { latitude, longitude } = recipient?.coordinates ?? {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    result.coordinates = { latitude, longitude };
  }

  const eta = trackInfo.time_metrics?.estimated_delivery_date;
  if (eta?.from) result.estimatedDelivery = eta.from;
  if (eta?.to) result.estimatedDeliveryTo = eta.to;

  return result;
}

async function register(
  normalized: string,
  carrierCode: number | undefined,
  apiKey: string,
): Promise<void> {
  const item: { number: string; carrier?: number } = { number: normalized };
  if (carrierCode) item.carrier = carrierCode;

  const envelope = await callApi('register', [item], apiKey);

  const rejection = firstRejection(envelope);
  if (rejection && !isBenignRejection(rejection.error.message)) {
    const message = rejection.error.message;
    const status = /policy restrictions/i.test(message) ? 403 : 400;
    throw new TrackingError(message, status, rejection.error.code);
  }
}

async function pollUntilReady(
  normalized: string,
  apiKey: string,
  attempts: number,
): Promise<Record<string, any> | null> {
  const backoff = [400, 900, 1800, 3000, 4500];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const envelope = await callApi(
      'gettrackinfo',
      [{ number: normalized }],
      apiKey,
    );
    const rejection = firstRejection(envelope);

    if (rejection && rejection.error.code !== NOT_REGISTERED_CODE) {
      throw new TrackingError(
        rejection.error.message,
        400,
        rejection.error.code,
      );
    }

    const accepted = envelope.data?.accepted?.[0];
    const trackInfo = accepted?.track_info;
    const hasData =
      trackInfo &&
      (trackInfo.latest_status?.status !== 'NotFound' ||
        mapEvents(trackInfo).length > 0);

    if (hasData) return trackInfo;

    if (attempt < attempts - 1) {
      await sleep(backoff[Math.min(attempt, backoff.length - 1)] ?? 2000);
    }
  }

  return null;
}

export const trackingService: TrackingService = {
  async trackPackage(trackingNumber, carrier, apiKey) {
    const normalized = trackingNumber.toUpperCase().trim();
    const code = CARRIER_CODES[carrier];

    try {
      await register(normalized, code, apiKey);

      const trackInfo = await pollUntilReady(normalized, apiKey, 4);

      if (!trackInfo) {
        return {
          trackingNumber: normalized,
          carrier,
          status: 'pending',
          lastUpdate: new Date().toISOString(),
          events: [],
        };
      }

      return buildResult(trackInfo, normalized, carrier);
    } catch (error) {
      if (error instanceof TrackingError) throw error;
      console.error('[17Track] unexpected error', error);
      throw new TrackingError(
        'Tracking provider is unreachable. Please try again shortly.',
        502,
      );
    }
  },

  async trackBatch(items, apiKey) {
    if (items.length === 0) return [];
    if (items.length > 40) {
      throw new TrackingError(
        'A maximum of 40 parcels can be refreshed at once',
        400,
      );
    }

    const normalized = items.map((item) => ({
      trackingNumber: item.trackingNumber.toUpperCase().trim(),
      carrier: item.carrier,
    }));

    const registerBody = normalized.map(({ trackingNumber, carrier }) => {
      const entry: { number: string; carrier?: number } = {
        number: trackingNumber,
      };
      const code = CARRIER_CODES[carrier];
      if (code) entry.carrier = code;
      return entry;
    });

    try {
      const registerEnvelope = await callApi('register', registerBody, apiKey);

      const failures = new Map<string, { message: string; status: number }>();
      for (const rejection of registerEnvelope.data?.rejected ?? []) {
        const message = rejection.error?.message ?? 'Registration rejected';
        if (isBenignRejection(message)) continue;
        const status = /policy restrictions/i.test(message) ? 403 : 400;
        failures.set(rejection.number, { message, status });
      }

      await sleep(1200);

      const infoEnvelope = await callApi(
        'gettrackinfo',
        normalized.map(({ trackingNumber }) => ({ number: trackingNumber })),
        apiKey,
      );

      for (const rejection of infoEnvelope.data?.rejected ?? []) {
        if (rejection.error?.code === NOT_REGISTERED_CODE) continue;
        failures.set(rejection.number, {
          message: rejection.error?.message ?? 'Tracking rejected',
          status: 400,
        });
      }

      const trackInfoByNumber = new Map<string, Record<string, any>>();
      for (const accepted of infoEnvelope.data?.accepted ?? []) {
        if (accepted?.number && accepted.track_info) {
          trackInfoByNumber.set(accepted.number, accepted.track_info);
        }
      }

      return normalized.map(({ trackingNumber, carrier }) => {
        const failure = failures.get(trackingNumber);
        if (failure) {
          return {
            trackingNumber,
            carrier,
            error: failure.message,
            status: failure.status,
          };
        }

        const trackInfo = trackInfoByNumber.get(trackingNumber);
        if (!trackInfo) {
          return {
            trackingNumber,
            carrier,
            status: 'pending' as const,
            lastUpdate: new Date().toISOString(),
            events: [],
          };
        }

        return buildResult(trackInfo, trackingNumber, carrier);
      });
    } catch (error) {
      if (error instanceof TrackingError) throw error;
      console.error('[17Track] batch error', error);
      throw new TrackingError(
        'Tracking provider is unreachable. Please try again shortly.',
        502,
      );
    }
  },
};
