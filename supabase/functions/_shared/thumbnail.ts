import { createHmac } from 'node:crypto'

const THUMBNAIL_ENDPOINT = 'https://html2pdf-theta.vercel.app/api/v1/thumbnail'

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

export function createSignedThumbnailUrl(
  targetUrl: string,
  overrides: ThumbnailOverrides = {}
): string {
  const secret = Deno.env.get('THUMBNAIL_SIGNING_SECRET')
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

  const token = createHmac('sha256', secret).update(canonicalString).digest('hex')

  const searchParams = new URLSearchParams(params)
  searchParams.set('token', token)

  return `${THUMBNAIL_ENDPOINT}?${searchParams.toString()}`
}
