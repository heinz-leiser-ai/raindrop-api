import { getEnv } from './env.ts'
const THUMBNAIL_ENDPOINT = 'https://toolbox-six-tau.vercel.app/api/v1/thumbnail'

type ThumbnailParams = {
  url: string
  mode: string
  fill: string
  format: string
  width: string
  height: string
  ar: string
  dpr: string
  quality: string
  expires: string
}

type ThumbnailOverrides = Partial<
  Omit<ThumbnailParams, 'url' | 'expires'>
>

const VALID_MODES = ['fit', 'crop'] as const
type ValidMode = typeof VALID_MODES[number]

function sanitizeMode(mode?: string): ValidMode {
  if (mode && (VALID_MODES as readonly string[]).includes(mode)) return mode as ValidMode
  return 'crop'
}

function extractOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export async function createSignedThumbnailUrl(
  targetUrl: string,
  overrides: ThumbnailOverrides = {}
): Promise<string> {
  const secret = getEnv('THUMBNAIL_SIGNING_SECRET')
  if (!secret) {
    throw new Error('THUMBNAIL_SIGNING_SECRET is not set')
  }

  // #region agent log
  fetch('http://127.0.0.1:7930/ingest/3e15f807-ca65-47b7-8783-7b9371ab37ba',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'34130b'},body:JSON.stringify({sessionId:'34130b',location:'thumbnail.ts:createSignedThumbnailUrl',message:'input params',data:{targetUrl,overrideMode:overrides.mode,sanitizedMode:sanitizeMode(overrides.mode)},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
  // #endregion


  const expires = Date.now() + 15 * 60 * 1000
  const origin = extractOrigin(targetUrl)

  const params: ThumbnailParams = {
    url: origin,
    mode: sanitizeMode(overrides.mode),
    fill: overrides.fill ?? 'solid',
    format: overrides.format ?? 'webp',
    width: overrides.width ?? '56',
    height: overrides.height ?? '96',
    ar: overrides.ar ?? '7:6',
    dpr: overrides.dpr ?? '2',
    quality: overrides.quality ?? '90',
    expires: String(expires),
  }

  const canonicalString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const token = await signHmacSha256Hex(secret, canonicalString)

  const searchParams = new URLSearchParams(params)
  searchParams.set('token', token)

  const finalUrl = `${THUMBNAIL_ENDPOINT}?${searchParams.toString()}`

  // #region agent log
  fetch('http://127.0.0.1:7930/ingest/3e15f807-ca65-47b7-8783-7b9371ab37ba',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'34130b'},body:JSON.stringify({sessionId:'34130b',location:'thumbnail.ts:finalUrl',message:'signed url generated',data:{origin,canonicalString,finalUrl},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return finalUrl
}

async function signHmacSha256Hex(secret: string, input: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret)
  const payload = new TextEncoder().encode(input)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payload)
  return bytesToHex(new Uint8Array(signature))
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}
