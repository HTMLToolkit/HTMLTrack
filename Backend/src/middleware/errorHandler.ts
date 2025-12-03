const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export function errorHandler(error: unknown): Response {
  console.error('[Error]', error);

  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  const status = error instanceof Error && 'status' in error ? (error.status as number) : 500;

  return new Response(
    JSON.stringify({
      error: message,
      status
    }),
    {
      status,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}