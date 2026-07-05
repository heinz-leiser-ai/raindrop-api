import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleTagRoutes(req: Request, path: string): Promise<Response> {
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

  // GET tags/recent
  if (path === 'tags/recent') {
    return await getRecentTags(req, service, userId)
  }

  // GET/PUT/DEL tags/{collectionId}
  const tagsMatch = path.match(/^tags\/(-?\d+)$/)
  if (tagsMatch) {
    const collectionId = parseInt(tagsMatch[1])
    if (req.method === 'GET') return await getTags(req, service, userId, collectionId)
    if (req.method === 'PUT') return await renameTags(req, service, userId, collectionId)
    if (req.method === 'DELETE') return await removeTags(req, service, userId, collectionId)
  }

  // DEL tag?tag=name (Frontend-Format)
  if (path === 'tag' && req.method === 'DELETE') {
    const url = new URL(req.url)
    const tagName = url.searchParams.get('tag')
    if (!tagName) return errorResponse(req, 400, 'missing_tag', 'Tag name required')
    return await removeTagByName(req, service, userId, tagName)
  }

  // GET filters/{collectionId}?params
  const filtersMatch = path.match(/^filters\/(-?\d+)$/)
  if (filtersMatch) {
    const collectionId = parseInt(filtersMatch[1])
    return await getFilters(req, service, userId, collectionId)
  }

  return errorResponse(req, 404, 'not_found', `Tag route not found: ${path}`)
}

async function getTags(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const tags = await aggregateTags(service, userId, collectionId)
  return jsonResponse({ result: true, items: tags }, req)
}

async function getRecentTags(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data } = await service
    .from('raindrops')
    .select('tags, last_update')
    .eq('user_id', userId)
    .not('tags', 'eq', '{}')
    .order('last_update', { ascending: false })
    .limit(50)

  const tagSet = new Set<string>()
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? [])) {
      tagSet.add(tag)
      if (tagSet.size >= 30) break
    }
    if (tagSet.size >= 30) break
  }

  const items = [...tagSet].map(tag => ({ _id: tag, count: 0 }))
  return jsonResponse({ result: true, items }, req)
}

async function renameTags(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const body = await req.json()
  const replace: string = body.replace
  const oldTags: string[] = body.tags ?? (body.tag ? [body.tag] : [])

  if (!replace || !oldTags.length) {
    return errorResponse(req, 400, 'missing_fields', 'tags/tag and replace required')
  }

  for (const oldTag of oldTags) {
    let query = service
      .from('raindrops')
      .select('_id, tags')
      .eq('user_id', userId)
      .contains('tags', [oldTag])

    if (collectionId > 0) {
      query = query.eq('collection_id', collectionId)
    }

    const { data: affected } = await query

    for (const row of affected ?? []) {
      const newTags = (row.tags as string[])
        .map((t: string) => (t === oldTag ? replace : t))
        .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i)

      await service
        .from('raindrops')
        .update({ tags: newTags })
        .eq('_id', row._id)
    }
  }

  return jsonResponse({ result: true }, req)
}

async function removeTags(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const body = await req.json()
  const tagsToRemove: string[] = body.tags ?? []

  if (!tagsToRemove.length) {
    return errorResponse(req, 400, 'missing_tags', 'tags array required')
  }

  for (const tag of tagsToRemove) {
    await removeTagByName({ headers: { get: () => null } } as unknown as Request, service, userId, tag, collectionId)
  }

  return jsonResponse({ result: true }, req)
}

async function removeTagByName(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  tagName: string,
  collectionId?: number
): Promise<Response> {
  let query = service
    .from('raindrops')
    .select('_id, tags')
    .eq('user_id', userId)
    .contains('tags', [tagName])

  if (collectionId && collectionId > 0) {
    query = query.eq('collection_id', collectionId)
  }

  const { data: affected } = await query

  for (const row of affected ?? []) {
    const newTags = (row.tags as string[]).filter((t: string) => t !== tagName)
    await service
      .from('raindrops')
      .update({ tags: newTags })
      .eq('_id', row._id)
  }

  return jsonResponse({ result: true }, req)
}

async function getFilters(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const tagsSort = url.searchParams.get('tagsSort') ?? 'count'

  let query = service
    .from('raindrops')
    .select('tags, type, domain, important, broken')
    .eq('user_id', userId)

  if (collectionId === 0) {
    query = query.neq('collection_id', -99)
  } else if (collectionId > 0) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.eq('collection_id', collectionId)
  }

  if (search) {
    query = query.textSearch('search_vector', search.split(/\s+/).join(' & '), { type: 'plain' })
  }

  const { data } = await query

  // Aggregate tags
  const tagCounts: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}
  const domainCounts: Record<string, number> = {}
  let importantCount = 0
  let brokenCount = 0

  for (const row of data ?? []) {
    for (const tag of (row.tags ?? [])) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
    if (row.type) {
      typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1
    }
    if (row.domain) {
      domainCounts[row.domain] = (domainCounts[row.domain] ?? 0) + 1
    }
    if (row.important) importantCount++
    if (row.broken) brokenCount++
  }

  let tags = Object.entries(tagCounts).map(([_id, count]) => ({ _id, count }))

  if (tagsSort === '-count' || tagsSort === 'count') {
    tags.sort((a, b) => b.count - a.count)
  } else {
    tags.sort((a, b) => a._id.localeCompare(b._id))
  }

  const types = Object.entries(typeCounts)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => b.count - a.count)

  const domains = Object.entries(domainCounts)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  return jsonResponse({
    result: true,
    tags,
    types,
    domains,
    important: importantCount,
    broken: brokenCount,
    duplicates: 0,
    notag: (data ?? []).filter((r) => !(r.tags as string[])?.length).length,
  }, req)
}

async function aggregateTags(
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<{ _id: string; count: number }[]> {
  let query = service
    .from('raindrops')
    .select('tags')
    .eq('user_id', userId)
    .not('tags', 'eq', '{}')

  if (collectionId > 0) {
    query = query.eq('collection_id', collectionId)
  } else if (collectionId === 0) {
    query = query.neq('collection_id', -99)
  } else {
    query = query.eq('collection_id', collectionId)
  }

  const { data } = await query

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? [])) {
      counts[tag] = (counts[tag] ?? 0) + 1
    }
  }

  return Object.entries(counts)
    .map(([_id, count]) => ({ _id, count }))
    .sort((a, b) => b.count - a.count)
}
