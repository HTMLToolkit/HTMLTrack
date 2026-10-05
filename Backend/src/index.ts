import { Router } from 'itty-router';
import { trackingService } from './services/tracking';
import { errorHandler } from './middleware/errorHandler';

interface Env {
  TRACK_API_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });

const MAX_TRACKING_LENGTH = 40;

function readTrackingNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TRACKING_LENGTH) return null;
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function readCarrier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const router = Router();

router.get('/api/health', () =>
  jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }),
);

router.post('/api/track', async (req: Request, env: Env) => {
  try {
    if (!env.TRACK_API_KEY) {
      return jsonResponse({ error: 'API key not configured' }, 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const trackingNumber = readTrackingNumber(body.trackingNumber);
    const carrier = readCarrier(body.carrier);

    if (!trackingNumber || !carrier) {
      return jsonResponse(
        { error: 'A valid trackingNumber and carrier are required' },
        400,
      );
    }

    const result = await trackingService.trackPackage(
      trackingNumber,
      carrier,
      env.TRACK_API_KEY,
    );

    return jsonResponse(result);
  } catch (error) {
    return errorHandler(error);
  }
});

router.post('/api/track/batch', async (req: Request, env: Env) => {
  try {
    if (!env.TRACK_API_KEY) {
      return jsonResponse({ error: 'API key not configured' }, 500);
    }

    let body: { parcels?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!Array.isArray(body.parcels) || body.parcels.length === 0) {
      return jsonResponse({ error: 'parcels must be a non-empty array' }, 400);
    }

    const parcels: Array<{ trackingNumber: string; carrier: string }> = [];
    for (const entry of body.parcels) {
      const item = entry as Record<string, unknown>;
      const trackingNumber = readTrackingNumber(item?.trackingNumber);
      const carrier = readCarrier(item?.carrier);
      if (!trackingNumber || !carrier) {
        return jsonResponse(
          { error: 'Every parcel needs a valid trackingNumber and carrier' },
          400,
        );
      }
      parcels.push({ trackingNumber, carrier });
    }

    const results = await trackingService.trackBatch(
      parcels,
      env.TRACK_API_KEY,
    );
    return jsonResponse({ results });
  } catch (error) {
    return errorHandler(error);
  }
});

router.options(
  '*',
  () => new Response(null, { status: 204, headers: corsHeaders }),
);

router.all('*', () => jsonResponse({ error: 'Not Found' }, 404));

export default {
  fetch: (req: Request, env: Env) => router.handle(req, env),
};
