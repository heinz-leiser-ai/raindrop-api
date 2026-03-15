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

export async function createSignedThumbnailUrl(
  targetUrl: string,
  overrides: ThumbnailOverrides = {}
): Promise<string> {
  const secret = getEnv('THUMBNAIL_SIGNING_SECRET')
  if (!secret) {
    throw new Error('THUMBNAIL_SIGNING_SECRET is not set')
  }

  const expires = Date.now() + 15 * 60 * 1000

  const params: ThumbnailParams = {
    url: targetUrl,
    mode: overrides.mode ?? 'crop',
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

  return `${THUMBNAIL_ENDPOINT}?${searchParams.toString()}`
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
