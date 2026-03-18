import { corsHeaders } from '../../_shared/cors.ts'
import { errorResponse } from '../../_shared/response.ts'
import { createSignedThumbnailUrl } from '../../_shared/thumbnail.ts'

export async function handleThumbnailRoutes(req: Request, path: string): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const prefix = 'thumbnail/render/'
  if (!path.startsWith(prefix)) {
    return errorResponse(req, 404, 'not_found', `Thumbnail route not found: ${path}`)
  }

  const encodedTarget = path.slice(prefix.length)
  if (!encodedTarget) {
    return errorResponse(req, 400, 'missing_url', 'Missing encoded target URL')
  }

  let targetUrl = ''
  try {
    targetUrl = decodeURIComponent(encodedTarget)
  } catch {
    return errorResponse(req, 400, 'invalid_url', 'Invalid encoded target URL')
  }

  const url = new URL(req.url)
  const signedUrl = await createSignedThumbnailUrl(targetUrl, {
    mode: url.searchParams.get('mode') ?? undefined,
    fill: url.searchParams.get('fill') ?? undefined,
    format: url.searchParams.get('format') ?? undefined,
    width: url.searchParams.get('width') ?? undefined,
    height: url.searchParams.get('height') ?? undefined,
    ar: url.searchParams.get('ar') ?? undefined,
    dpr: url.searchParams.get('dpr') ?? undefined,
    quality: url.searchParams.get('quality') ?? undefined,
  })

  try {
    const upstream = await fetch(signedUrl)
    if (!upstream.ok) {
      return errorResponse(req, upstream.status, 'thumbnail_error', 'Thumbnail service error')
    }

    const headers: Record<string, string> = {
      ...corsHeaders(req.headers.get('origin')),
      'Cache-Control': 'public, max-age=86400',
    }
    const ct = upstream.headers.get('content-type')
    if (ct) headers['Content-Type'] = ct

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return errorResponse(req, 502, 'thumbnail_error', 'Failed to fetch thumbnail')
  }
}
