import { Router } from 'itty-router';
import { trackingService } from './services/tracking';
import { errorHandler } from './middleware/errorHandler';

interface Env {
  TRACK_API_KEY: string;
}

const router = Router();

router.post('/api/track', async (req: Request, env: Env) => {
  try {
    if (!env.TRACK_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { trackingNumber, carrier } = await req.json();

    if (!trackingNumber || !carrier) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: trackingNumber, carrier' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await trackingService.trackPackage(
      trackingNumber,
      carrier,
      env.TRACK_API_KEY
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return errorHandler(error);
  }
});

router.options('*', () => new Response(null, {
  status: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}));

export default {
  fetch: (req: Request, env: Env) => router.handle(req, env)
};