const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') ?? [
  'http://localhost:3000',
  'http://localhost:8080',
]

export const corsHeaders = (origin?: string | null): Record<string, string> => {
  const effectiveOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Expose-Headers':
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin')),
    })
  }
  return null
}
