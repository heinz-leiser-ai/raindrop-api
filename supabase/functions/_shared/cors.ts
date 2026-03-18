import { getEnv } from './env.ts'

const DEFAULT_ORIGINS = [
  'http://localhost:2000',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://project-fijck.vercel.app',
]

const ALLOWED_ORIGINS: string[] = (() => {
  const raw = getEnv('ALLOWED_ORIGINS')
  if (!raw) return DEFAULT_ORIGINS
  const parsed = raw.split(',').map((o) => o.trim()).filter((o) => o && o !== '*')
  return parsed.length ? parsed : DEFAULT_ORIGINS
})()

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (origin.startsWith('chrome-extension://')) return true
  if (origin.startsWith('moz-extension://')) return true
  if (origin.startsWith('safari-web-extension://')) return true
  return false
}

export const corsHeaders = (origin?: string | null): Record<string, string> => {
  const effectiveOrigin =
    origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]

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
