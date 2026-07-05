import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleHighlightRoutes(req: Request, path: string): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const user = await getUser(req)
  if (!user) return unauthorizedResponse(req)

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('integer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return unauthorizedResponse(req)
  const userId = profile.integer_id

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '0')
  const perpage = Math.min(parseInt(url.searchParams.get('perpage') ?? '25'), 50)

  // GET highlights/{collectionId} or GET highlights (all)
  const collectionMatch = path.match(/^highlights\/(-?\d+)$/)
  const collectionId = collectionMatch ? parseInt(collectionMatch[1]) : null

  let query = service
    .from('raindrops')
    .select('_id, title, link, highlights')
    .eq('user_id', userId)
    .not('highlights', 'eq', '[]')

  if (collectionId !== null) {
    if (collectionId === 0) {
      query = query.neq('collection_id', -99)
    } else {
      query = query.eq('collection_id', collectionId)
    }
  }

  query = query.order('last_update', { ascending: false })

  const { data } = await query

  // Flatten highlights across raindrops
  const allHighlights: Record<string, unknown>[] = []
  for (const raindrop of data ?? []) {
    const highlights = (raindrop.highlights ?? []) as Record<string, unknown>[]
    for (const h of highlights) {
      if (!h.text) continue
      allHighlights.push({
        _id: h._id ?? crypto.randomUUID(),
        text: h.text,
        color: h.color ?? 'yellow',
        note: h.note ?? '',
        created: h.created ?? '',
        tags: h.tags ?? [],
        raindropRef: raindrop._id,
        link: raindrop.link,
        title: raindrop.title,
      })
    }
  }

  const from = page * perpage
  const paged = allHighlights.slice(from, from + perpage)

  return jsonResponse({ result: true, items: paged, count: allHighlights.length }, req)
}
