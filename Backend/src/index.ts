import { Router } from 'itty-router';
import { trackingService } from './services/tracking';
import { errorHandler } from './middleware/errorHandler';

interface Env {
  TRACK_API_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const jsonResponse = (data: unknown, status = 200) => new Response(
  JSON.stringify(data),
  { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    } 
  }
);

const router = Router();

// Health check endpoint
router.get('/api/health', () => jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }));

router.post('/api/track', async (req: Request, env: Env) => {
  try {
    if (!env.TRACK_API_KEY) {
      return jsonResponse({ error: 'API key not configured' }, 500);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { trackingNumber, carrier } = body;

    if (!trackingNumber || !carrier) {
      return jsonResponse({ error: 'Missing required fields: trackingNumber, carrier' }, 400);
    }

    const result = await trackingService.trackPackage(
      trackingNumber,
      carrier,
      env.TRACK_API_KEY
    );

    return jsonResponse(result);
  } catch (error) {
    return errorHandler(error);
  }
});

router.options('*', () => new Response(null, {
  status: 204,
  headers: corsHeaders
}));

router.all('*', () => jsonResponse({ error: 'Not Found' }, 404));

export default {
  fetch: (req: Request, env: Env) => router.handle(req, env)
};