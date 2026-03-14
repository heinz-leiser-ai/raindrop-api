import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleRaindropRoutes(req: Request, path: string): Promise<Response> {
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

  // import/url/parse?url=
  if (path === 'import/url/parse') {
    return await parseUrl(req)
  }

  // POST raindrop/suggest  |  GET raindrop/{id}/suggest
  if (path === 'raindrop/suggest' || path.match(/^raindrop\/\d+\/suggest$/)) {
    return suggestStub(req)
  }

  // PUT raindrop/file
  if (path === 'raindrop/file' && req.method === 'PUT') {
    return await uploadRaindropFile(req, service, userId, user.id)
  }

  // PUT raindrop/{id}/cover
  const coverMatch = path.match(/^raindrop\/(\d+)\/cover$/)
  if (coverMatch && req.method === 'PUT') {
    return await uploadRaindropCover(req, service, userId, user.id, parseInt(coverMatch[1]))
  }

  // GET raindrop/{id}/cache
  const cacheMatch = path.match(/^raindrop\/(\d+)\/cache$/)
  if (cacheMatch) {
    return errorResponse(req, 501, 'not_implemented', 'Permanent copy not yet available')
  }

  // Single raindrop: GET/PUT/DEL raindrop/{id}
  const singleMatch = path.match(/^raindrop\/(\d+)$/)
  if (singleMatch) {
    const id = parseInt(singleMatch[1])
    if (req.method === 'GET') return await getRaindrop(req, service, userId, id)
    if (req.method === 'PUT') return await updateRaindrop(req, service, userId, id)
    if (req.method === 'DELETE') return await deleteRaindrop(req, service, userId, id)
  }

  // POST raindrop (create single)
  if (path === 'raindrop' && req.method === 'POST') {
    return await createRaindrop(req, service, userId)
  }

  // GET/DEL raindrops/recent/search
  if (path === 'raindrops/recent/search') {
    if (req.method === 'GET') return await getRecentSearches(req, service, userId)
    if (req.method === 'DELETE') return await clearRecentSearches(req, service, userId)
  }

  // POST raindrops (batch create)
  if (path === 'raindrops' && req.method === 'POST') {
    return await batchCreateRaindrops(req, service, userId)
  }

  // GET/PUT/DEL raindrops/{collectionId}
  const batchMatch = path.match(/^raindrops\/(-?\d+)(.*)$/)
  if (batchMatch) {
    const collectionId = parseInt(batchMatch[1])
    if (req.method === 'GET') return await listRaindrops(req, service, userId, collectionId)
    if (req.method === 'PUT') return await batchUpdateRaindrops(req, service, userId, collectionId)
    if (req.method === 'DELETE') return await batchDeleteRaindrops(req, service, userId, collectionId)
  }

  return errorResponse(req, 404, 'not_found', `Raindrop route not found: ${path}`)
}

// ─── Format ──────────────────────────────────────────────

function formatRaindrop(row: Record<string, unknown>) {
  return {
    _id: row._id,
    link: row.link ?? '',
    title: row.title ?? '',
    excerpt: row.excerpt ?? '',
    note: row.note ?? '',
    type: row.type ?? 'link',
    cover: row.cover ?? '',
    media: row.media ?? [],
    tags: row.tags ?? [],
    domain: row.domain ?? '',
    important: row.important ?? false,
    order: row.order ?? 0,
    removed: row.removed ?? false,
    highlights: row.highlights ?? [],
    reminder: row.reminder ?? null,
    file: row.file ?? null,
    collectionId: row.collection_id ?? -1,
    collection: { '$id': row.collection_id ?? -1 },
    user: { '$id': row.user_id },
    created: row.created,
    lastUpdate: row.last_update,
    pleaseParse: row.pleaseparse ?? null,
  }
}

// ─── Single CRUD ─────────────────────────────────────────

async function getRaindrop(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  const { data, error } = await service
    .from('raindrops')
    .select('*')
    .eq('_id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return errorResponse(req, 404, 'not_found', 'Raindrop not found')

  return jsonResponse({ result: true, item: formatRaindrop(data) }, req)
}

async function createRaindrop(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()

  const insert: Record<string, unknown> = {
    user_id: userId,
    link: body.link ?? '',
    title: body.title ?? body.link ?? '',
    excerpt: body.excerpt ?? '',
    note: body.note ?? '',
    type: body.type ?? detectType(body.link ?? ''),
    cover: body.cover ?? '',
    collection_id: body.collectionId ?? body['collection.$id'] ?? -1,
    important: body.important ?? false,
    order: body.order ?? 0,
  }

  if (body.tags) insert.tags = body.tags
  if (body.media) insert.media = body.media
  if (body.highlights) insert.highlights = body.highlights
  if (body.reminder) insert.reminder = body.reminder
  if (body.pleaseParse) insert.pleaseparse = body.pleaseParse

  const { data, error } = await service
    .from('raindrops')
    .insert(insert)
    .select()
    .single()

  if (error) return errorResponse(req, 400, 'create_failed', error.message)

  return jsonResponse({ result: true, item: formatRaindrop(data) }, req)
}

async function updateRaindrop(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) updates.title = body.title
  if (body.excerpt !== undefined) updates.excerpt = body.excerpt
  if (body.note !== undefined) updates.note = body.note
  if (body.link !== undefined) updates.link = body.link
  if (body.type !== undefined) updates.type = body.type
  if (body.cover !== undefined) updates.cover = body.cover
  if (body.media !== undefined) updates.media = body.media
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.important !== undefined) updates.important = body.important
  if (body.order !== undefined) updates.order = body.order
  if (body.removed !== undefined) updates.removed = body.removed
  if (body.reminder !== undefined) updates.reminder = body.reminder
  if (body.file !== undefined) updates.file = body.file
  if (body.pleaseParse !== undefined) updates.pleaseparse = body.pleaseParse

  if (body.collectionId !== undefined) {
    updates.collection_id = body.collectionId
    if (body.collectionId === -1) updates.removed = false
  }
  if (body['collection.$id'] !== undefined) {
    updates.collection_id = body['collection.$id']
  }

  // Highlights merge logic: add/update/remove based on _id and text fields
  if (body.highlights !== undefined) {
    const incoming = body.highlights as Record<string, unknown>[]
    const { data: existing } = await service
      .from('raindrops')
      .select('highlights')
      .eq('_id', id)
      .eq('user_id', userId)
      .single()

    let current = ((existing?.highlights ?? []) as Record<string, unknown>[])

    for (const h of incoming) {
      if (h._id) {
        if (h.text === '') {
          // Remove
          current = current.filter((c) => c._id !== h._id)
        } else {
          // Update
          current = current.map((c) =>
            c._id === h._id ? { ...c, ...h, lastUpdate: new Date().toISOString() } : c
          )
        }
      } else {
        // Add
        current.push({
          ...h,
          _id: crypto.randomUUID(),
          created: new Date().toISOString(),
          lastUpdate: new Date().toISOString(),
        })
      }
    }
    updates.highlights = current
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(req, 400, 'no_changes', 'No fields to update')
  }

  const { data, error } = await service
    .from('raindrops')
    .update(updates)
    .eq('_id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return errorResponse(req, 400, 'update_failed', error.message)
  if (!data) return errorResponse(req, 404, 'not_found', 'Raindrop not found')

  return jsonResponse({ result: true, item: formatRaindrop(data) }, req)
}

async function deleteRaindrop(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  const { data: existing } = await service
    .from('raindrops')
    .select('collection_id')
    .eq('_id', id)
    .eq('user_id', userId)
    .single()

  if (!existing) return errorResponse(req, 404, 'not_found', 'Raindrop not found')

  // Already in trash -> permanent delete
  if (existing.collection_id === -99) {
    await service.from('raindrops').delete().eq('_id', id).eq('user_id', userId)
  } else {
    // Move to trash
    await service
      .from('raindrops')
      .update({ collection_id: -99, removed: true })
      .eq('_id', id)
      .eq('user_id', userId)
  }

  return jsonResponse({ result: true }, req)
}

// ─── Listing ─────────────────────────────────────────────

async function listRaindrops(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const sort = url.searchParams.get('sort') ?? '-created'
  const page = parseInt(url.searchParams.get('page') ?? '0')
  const perpage = Math.min(parseInt(url.searchParams.get('perpage') ?? '25'), 50)
  const nested = url.searchParams.get('nested') === 'true'

  let query = service
    .from('raindrops')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  // Collection filter
  if (collectionId === 0) {
    // All (except trash)
    query = query.neq('collection_id', -99)
  } else if (collectionId === -99) {
    query = query.eq('collection_id', -99)
  } else if (collectionId === -1) {
    query = query.eq('collection_id', -1)
  } else if (nested) {
    const childIds = await getCollectionDescendantIds(service, userId, collectionId)
    query = query.in('collection_id', [collectionId, ...childIds])
  } else {
    query = query.eq('collection_id', collectionId)
  }

  // Save search to recent (fire and forget)
  if (search) {
    service.from('recent_searches').insert({ user_id: userId, query: search }).then(() => {})
  }

  // Search
  if (search) {
    if (search.startsWith('#')) {
      query = query.contains('tags', [search.slice(1)])
    } else if (search.startsWith('type:')) {
      query = query.eq('type', search.slice(5))
    } else if (search.startsWith('domain:')) {
      query = query.eq('domain', search.slice(7))
    } else if (search.startsWith('important:')) {
      query = query.eq('important', search.slice(10) === 'true')
    } else {
      query = query.textSearch('search_vector', search.split(/\s+/).join(' & '), { type: 'plain' })
    }
  }

  // Sort
  const desc = sort.startsWith('-')
  const sortField = sort.replace(/^-/, '')
  const sortMap: Record<string, string> = {
    created: 'created',
    sort: 'order',
    title: 'title',
    domain: 'domain',
    score: 'created',
  }
  const dbField = sortMap[sortField] ?? 'created'
  query = query.order(dbField, { ascending: !desc })

  // Pagination
  const from = page * perpage
  query = query.range(from, from + perpage - 1)

  const { data, count, error } = await query

  if (error) return errorResponse(req, 500, 'db_error', error.message)

  const items = (data ?? []).map(formatRaindrop)

  return jsonResponse({ result: true, items, count: count ?? 0 }, req)
}

// ─── Batch Create ────────────────────────────────────────

async function batchCreateRaindrops(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()
  console.log('POST /raindrops body:', JSON.stringify(body))
  let items: Record<string, unknown>[] = body.items ?? []

  // Fallback: einzelnes Item ohne items-Wrapper
  if (!items.length && body.link) {
    items = [body]
  }

  if (!items.length) {
    return errorResponse(req, 400, 'missing_items', `No items. Keys: ${Object.keys(body).join(',')}`)
  }

  const inserts = items.slice(0, 100).map((item) => ({
    user_id: userId,
    link: item.link ?? '',
    title: item.title ?? item.link ?? '',
    excerpt: item.excerpt ?? '',
    note: item.note ?? '',
    type: item.type ?? detectType((item.link as string) ?? ''),
    cover: item.cover ?? '',
    collection_id: item.collectionId ?? item['collection.$id'] ?? -1,
    important: item.important ?? false,
    order: item.order ?? 0,
    tags: item.tags ?? [],
    media: item.media ?? [],
    pleaseparse: item.pleaseParse ?? null,
  }))

  const { data, error } = await service
    .from('raindrops')
    .insert(inserts)
    .select()

  if (error) return errorResponse(req, 400, 'create_failed', error.message)

  return jsonResponse({
    result: true,
    items: (data ?? []).map(formatRaindrop),
  }, req)
}

// ─── Batch Update ────────────────────────────────────────

async function batchUpdateRaindrops(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const body = await req.json()
  const ids: number[] | undefined = body.ids

  const updates: Record<string, unknown> = {}
  if (body.important !== undefined) updates.important = body.important
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.media !== undefined) updates.media = body.media
  if (body.cover !== undefined) updates.cover = body.cover
  if (body.collectionId !== undefined) {
    updates.collection_id = body.collectionId
    if (body.collectionId === -1) updates.removed = false
  }
  if (body.excerpt !== undefined) updates.excerpt = body.excerpt
  if (body.pleaseParse !== undefined) updates.pleaseparse = body.pleaseParse

  let query = service
    .from('raindrops')
    .update(updates)
    .eq('user_id', userId)

  if (ids?.length) {
    query = query.in('_id', ids)
  } else if (collectionId !== 0) {
    query = query.eq('collection_id', collectionId)
  }

  const { error } = await query

  if (error) return errorResponse(req, 400, 'update_failed', error.message)

  return jsonResponse({ result: true }, req)
}

// ─── Batch Delete ────────────────────────────────────────

async function batchDeleteRaindrops(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const ids: number[] | undefined = body.ids

  if (collectionId === -99) {
    // Permanent delete from trash
    let query = service.from('raindrops').delete().eq('user_id', userId).eq('collection_id', -99)
    if (ids?.length) query = query.in('_id', ids)
    const { error } = await query
    if (error) return errorResponse(req, 400, 'delete_failed', error.message)
  } else {
    // Move to trash
    let query = service
      .from('raindrops')
      .update({ collection_id: -99, removed: true })
      .eq('user_id', userId)

    if (ids?.length) {
      query = query.in('_id', ids)
    } else if (collectionId !== 0) {
      query = query.eq('collection_id', collectionId)
    }

    const { error } = await query
    if (error) return errorResponse(req, 400, 'delete_failed', error.message)
  }

  return jsonResponse({ result: true }, req)
}

// ─── Suggest (Stub) ──────────────────────────────────────

function suggestStub(req: Request): Response {
  return jsonResponse({
    result: true,
    item: { collections: [], tags: [], new_tags: [] },
  }, req)
}

// ─── URL Parse ───────────────────────────────────────────

async function parseUrl(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return errorResponse(req, 400, 'missing_url', 'url parameter required')
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RaindropBot/1.0)' },
      redirect: 'follow',
    })

    const html = await response.text()
    const title = extractMeta(html, 'title') ?? extractTagContent(html, 'title') ?? ''
    const excerpt = extractMeta(html, 'description') ?? ''
    const cover = extractMeta(html, 'image') ?? ''
    const type = detectTypeFromHtml(html, targetUrl)

    const domain = new URL(targetUrl).hostname.replace(/^www\./, '')

    return jsonResponse({
      result: true,
      item: {
        title,
        excerpt,
        cover,
        type,
        domain,
        link: targetUrl,
        media: cover ? [{ link: cover }] : [],
      },
    }, req)
  } catch {
    return jsonResponse({
      result: true,
      item: {
        title: targetUrl,
        excerpt: '',
        cover: '',
        type: 'link',
        domain: '',
        link: targetUrl,
        media: [],
      },
    }, req)
  }
}

// ─── Helpers ─────────────────────────────────────────────

function detectType(link: string): string {
  const ext = link.split('.').pop()?.toLowerCase().split('?')[0] ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document'
  return 'link'
}

function detectTypeFromHtml(html: string, url: string): string {
  if (html.includes('og:type') && html.includes('article')) return 'article'
  if (html.includes('og:type') && html.includes('video')) return 'video'
  return detectType(url)
}

function extractMeta(html: string, property: string): string | null {
  const ogMatch = html.match(new RegExp(
    `<meta[^>]+(?:property|name)=["'](?:og:|twitter:)${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  ))
  if (ogMatch) return ogMatch[1]

  const reverseMatch = html.match(new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:|twitter:)${property}["']`,
    'i'
  ))
  if (reverseMatch) return reverseMatch[1]

  if (property === 'description') {
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )
    if (descMatch) return descMatch[1]
  }

  return null
}

function extractTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

// ─── File Upload ─────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_COVER_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_COVER_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/bmp', 'image/tiff']

async function uploadRaindropFile(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  authUid: string
): Promise<Response> {
  const formData = await req.formData().catch(() => null)
  if (!formData) return errorResponse(req, 400, '-1', 'no file')

  const file = formData.get('file') as File | null
  if (!file) return errorResponse(req, 400, '-1', 'no file')

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(req, 400, 'file_size_limit', 'File size limit')
  }

  const collectionId = parseInt(formData.get('collectionId') as string) || -1
  const ext = file.name.split('.').pop() ?? ''
  const storagePath = `${authUid}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await service.storage
    .from('raindrop-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return errorResponse(req, 400, 'file_invalid', uploadError.message)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const fileUrl = `${supabaseUrl}/storage/v1/object/raindrop-files/${storagePath}`
  const fileType = detectType(file.name)

  const { data: raindrop, error: createError } = await service
    .from('raindrops')
    .insert({
      user_id: userId,
      link: fileUrl,
      title: file.name.replace(/\.[^.]+$/, ''),
      type: fileType,
      collection_id: collectionId,
      domain: 'upload',
      file: { name: file.name, size: file.size, type: file.type },
    })
    .select()
    .single()

  if (createError) {
    return errorResponse(req, 400, 'create_failed', createError.message)
  }

  return jsonResponse({ result: true, item: formatRaindrop(raindrop) }, req)
}

async function uploadRaindropCover(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  authUid: string,
  raindropId: number
): Promise<Response> {
  const formData = await req.formData().catch(() => null)
  if (!formData) return errorResponse(req, 400, '-1', 'no file')

  const file = formData.get('cover') as File | null
  if (!file) return errorResponse(req, 400, '-1', 'no file')

  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    return errorResponse(req, 400, 'file_invalid', 'File is invalid')
  }

  if (file.size > MAX_COVER_SIZE) {
    return errorResponse(req, 400, 'file_size_limit', 'File size limit')
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${authUid}/${raindropId}.${ext}`

  const { error: uploadError } = await service.storage
    .from('raindrop-covers')
    .upload(storagePath, file, { contentType: file.type, upsert: true })

  if (uploadError) {
    return errorResponse(req, 400, 'file_invalid', uploadError.message)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const coverUrl = `${supabaseUrl}/storage/v1/object/public/raindrop-covers/${storagePath}`

  const { data, error } = await service
    .from('raindrops')
    .update({
      cover: coverUrl,
      media: [{ link: coverUrl }],
    })
    .eq('_id', raindropId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    return errorResponse(req, 400, 'update_failed', error?.message ?? 'Raindrop not found')
  }

  return jsonResponse({ result: true, item: formatRaindrop(data) }, req)
}

// ─── Recent Searches ─────────────────────────────────────

async function getRecentSearches(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data } = await service
    .from('recent_searches')
    .select('query, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const items = (data ?? []).map((r) => ({
    query: r.query,
    created: r.created_at,
  }))

  return jsonResponse({ result: true, items }, req)
}

async function clearRecentSearches(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { count } = await service
    .from('recent_searches')
    .delete()
    .eq('user_id', userId)

  return jsonResponse({ result: true, modified: count ?? 0 }, req)
}

// ─── Helpers ─────────────────────────────────────────────

async function getCollectionDescendantIds(
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  parentId: number
): Promise<number[]> {
  const { data } = await service
    .from('collections')
    .select('_id')
    .eq('parent_id', parentId)
    .eq('user_id', userId)

  if (!data?.length) return []

  const ids = data.map((c) => c._id)
  const nested = await Promise.all(
    ids.map((id) => getCollectionDescendantIds(service, userId, id))
  )
  return [...ids, ...nested.flat()]
}
